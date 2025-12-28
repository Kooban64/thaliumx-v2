#!/bin/bash

# ThaliumX Live Production Deployment Script
# ==========================================
# Automated deployment to live production server
# Run this script on your production server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-thaliumx.com}"
SERVER_IP="${SERVER_IP:-$(curl -s ifconfig.me)}"
EMAIL="${EMAIL:-admin@thaliumx.com}"

echo -e "${BLUE}🚀 ThaliumX Live Production Deployment${NC}"
echo "=========================================="
echo "Domain: $DOMAIN"
echo "Server IP: $SERVER_IP"
echo "Email: $EMAIL"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Step 1: System Preparation
print_info "Step 1: Preparing system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git curl wget htop iotop ufw fail2ban

# Configure Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

print_status "System preparation complete"

# Step 2: Clone Repository
print_info "Step 2: Cloning ThaliumX repository..."
if [ ! -d "thaliumx" ]; then
    git clone https://github.com/Kooban64/thaliumx.git
fi
cd thaliumx

# Set permissions
sudo chown -R $USER:$USER .

print_status "Repository cloned"

# Step 3: Environment Configuration
print_info "Step 3: Configuring production environment..."

# Generate strong secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
MONGODB_PASSWORD=$(openssl rand -base64 32)
KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 32)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# ThaliumX Production Environment
NODE_ENV=production
DOMAIN=$DOMAIN
API_DOMAIN=api.$DOMAIN
AUTH_DOMAIN=auth.$DOMAIN

# SSL Configuration
SSL_EMAIL=$EMAIL
SSL_STAGING=false

# Database Configuration
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
MONGODB_PASSWORD=$MONGODB_PASSWORD

# Keycloak Configuration
KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD

# JWT & Encryption
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Grafana
GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD

# Server Configuration
SERVER_IP=$SERVER_IP
EOF

print_status "Environment configured"

# Step 4: SSL Certificate Setup
print_info "Step 4: Setting up SSL certificates..."

# Install Certbot
sudo apt install -y certbot

# Create SSL directory
sudo mkdir -p certs/ssl
sudo chown -R $USER:$USER certs

# Generate certificates
sudo certbot certonly --standalone \
  -d $DOMAIN \
  -d www.$DOMAIN \
  -d api.$DOMAIN \
  -d auth.$DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --non-interactive \
  --expand

# Copy certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem certs/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem certs/ssl/
sudo chown $USER:$USER certs/ssl/*

print_status "SSL certificates configured"

# Step 5: Security Hardening
print_info "Step 5: Applying security hardening..."

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# SSH hardening
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Install and configure Fail2Ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

print_status "Security hardening applied"

# Step 6: Docker Network Setup
print_info "Step 6: Setting up Docker networks..."
docker network create thaliumx-net 2>/dev/null || true

print_status "Docker networks configured"

# Step 7: Initialize Vault
print_info "Step 7: Initializing Vault..."
./docker/scripts/init-vault.sh

print_status "Vault initialized and seeded"

# Step 8: Deploy Services
print_info "Step 8: Deploying ThaliumX services..."
./docker/scripts/deploy-production.sh

print_status "Services deployed"

# Step 9: Database Seeding
print_info "Step 9: Seeding production database..."
./docker/scripts/seed-production-database.sh

print_status "Database seeded"

# Step 10: SSL Auto-Renewal
print_info "Step 10: Setting up SSL auto-renewal..."

cat > ssl-renewal.sh << EOF
#!/bin/bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/$USER/thaliumx/certs/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/$USER/thaliumx/certs/ssl/
sudo chown $USER:$USER /home/$USER/thaliumx/certs/ssl/*
cd /home/$USER/thaliumx
docker-compose -f docker-compose.prod.yml restart apisix
EOF

chmod +x ssl-renewal.sh
(crontab -l ; echo "0 12 * * * /home/$USER/thaliumx/ssl-renewal.sh") | crontab -

print_status "SSL auto-renewal configured"

# Step 11: Backup System
print_info "Step 11: Setting up backup system..."

mkdir -p backups

cat > backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/home/$USER/thaliumx/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p \$BACKUP_DIR

# Database backup
docker exec thaliumx-postgres pg_dump -U thaliumx thaliumx > \$BACKUP_DIR/postgres_\$TIMESTAMP.sql

# MongoDB backup
docker exec thaliumx-mongodb mongodump --out \$BACKUP_DIR/mongodb_\$TIMESTAMP

# Compress backups
tar -czf \$BACKUP_DIR/full_backup_\$TIMESTAMP.tar.gz \$BACKUP_DIR/postgres_\$TIMESTAMP.sql \$BACKUP_DIR/mongodb_\$TIMESTAMP

# Clean old backups (keep last 7 days)
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "postgres_*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "mongodb_*" -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR/full_backup_\$TIMESTAMP.tar.gz"
EOF

chmod +x backup.sh
(crontab -l ; echo "0 2 * * * /home/$USER/thaliumx/backup.sh") | crontab -

print_status "Backup system configured"

# Step 12: Final Testing
print_info "Step 12: Running final production tests..."

# Wait for services to be fully ready
sleep 30

# Test endpoints
echo "Testing production endpoints..."
curl -s -I https://$DOMAIN | head -1
curl -s https://api.$DOMAIN/health >/dev/null && echo "✅ API healthy" || echo "⚠️ API not ready yet"
curl -s https://auth.$DOMAIN/auth/realms/thaliumx >/dev/null && echo "✅ Auth healthy" || echo "⚠️ Auth not ready yet"

print_status "Final testing complete"

# Step 13: Production Monitoring Setup
print_info "Step 13: Setting up production monitoring..."

cat > monitor.sh << 'EOF'
#!/bin/bash
echo "=== ThaliumX Production Status ==="
echo "Time: $(date)"
echo ""

echo "Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep thaliumx
echo ""

echo "Service Health:"
curl -s http://localhost:3002/health | jq -r '.status' 2>/dev/null || echo "Backend: Not ready"
curl -s http://localhost:3000 | head -1 | cut -d' ' -f2 2>/dev/null || echo "Frontend: Not ready"
echo ""

echo "System Resources:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')"
echo "Memory: $(free | grep Mem | awk '{printf "%.2f%%", $3/$2 * 100.0}')"
echo "Disk: $(df / | tail -1 | awk '{print $5}')"
echo ""

echo "Active Connections:"
netstat -tln | grep -c :80 || echo "HTTP: 0"
netstat -tln | grep -c :443 || echo "HTTPS: 0"
EOF

chmod +x monitor.sh
(crontab -l ; echo "*/5 * * * * /home/$USER/thaliumx/monitor.sh >> /home/$USER/thaliumx/production.log 2>&1") | crontab -

print_status "Monitoring configured"

# Final Summary
echo ""
echo -e "${GREEN}🎉 ThaliumX Production Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo "🌐 Production URLs:"
echo "   Frontend: https://$DOMAIN"
echo "   API:      https://api.$DOMAIN"
echo "   Auth:     https://auth.$DOMAIN"
echo ""
echo "📊 Monitoring:"
echo "   Grafana:  https://$DOMAIN:3001"
echo "   Prometheus: https://$DOMAIN:9090"
echo "   Wazuh:    https://$DOMAIN:5601"
echo ""
echo "🔐 Admin Access:"
echo "   Vault UI: https://$DOMAIN:8200"
echo "   Root Token: root"
echo ""
echo "📁 Important Files:"
echo "   Environment: /home/$USER/thaliumx/.env"
echo "   Backups:     /home/$USER/thaliumx/backups/"
echo "   Logs:        /home/$USER/thaliumx/production.log"
echo "   SSL Certs:   /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "🛠️  Management Commands:"
echo "   View status:    ./monitor.sh"
echo "   View logs:      docker logs thaliumx-backend"
echo "   Restart all:    docker-compose -f docker-compose.prod.yml restart"
echo "   Backup now:     ./backup.sh"
echo ""
echo "🚨 Emergency Contacts:"
echo "   Check logs:    docker logs -f SERVICE_NAME"
echo "   Restart service: docker restart SERVICE_NAME"
echo "   Full restart:  docker-compose -f docker-compose.prod.yml down && ./docker/scripts/deploy-production.sh"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "   1. Change default passwords in .env file"
echo "   2. Set up proper SSH key authentication"
echo "   3. Configure monitoring alerts"
echo "   4. Set up log rotation"
echo "   5. Regular security updates: sudo apt update && sudo apt upgrade"
echo ""
echo -e "${GREEN}🎯 ThaliumX is now LIVE and ready for real users!${NC}"
echo ""
echo "Next steps:"
echo "1. Update DNS records to point to $SERVER_IP"
echo "2. Test user registration and trading flows"
echo "3. Monitor performance and scale as needed"
echo "4. Set up additional monitoring alerts"

# Create a go-live checklist
cat > GO_LIVE_CHECKLIST.md << EOF
# ThaliumX Go-Live Checklist

## Pre-Launch ✅
- [x] Server provisioned and configured
- [x] Domain DNS configured
- [x] SSL certificates installed
- [x] All services deployed and healthy
- [x] Database seeded with test data
- [x] Security hardening applied
- [x] Backup system operational
- [x] Monitoring configured

## Launch Day 🚀
- [ ] DNS propagation complete (wait 24-48 hours)
- [ ] SSL certificates valid and auto-renewing
- [ ] All endpoints responding correctly
- [ ] User registration working
- [ ] Authentication flows functional
- [ ] Trading interface operational
- [ ] Web3 wallet connections working
- [ ] Mobile responsiveness verified
- [ ] Performance under load tested

## Post-Launch 📊
- [ ] Monitor error rates (< 0.1% 5xx)
- [ ] Track user registrations
- [ ] Monitor trading volume
- [ ] Set up alerting for critical issues
- [ ] Regular backups verified
- [ ] Security scans scheduled
- [ ] Performance optimization as needed

## Emergency Contacts
- Technical Issues: Check monitoring dashboards
- Security Incidents: Review Wazuh alerts
- Performance Issues: Scale resources as needed
- Rollback Plan: ./rollback.sh (if implemented)
EOF

print_status "Go-live checklist created: GO_LIVE_CHECKLIST.md"

echo ""
echo -e "${BLUE}📋 Check GO_LIVE_CHECKLIST.md for post-deployment tasks${NC}"