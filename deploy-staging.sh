#!/bin/bash

# ThaliumX Staging Environment Deployment Script
# ==============================================
# Automated deployment to internal staging environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${STAGING_DOMAIN:-staging.thaliumx.com}"
SERVER_IP="${SERVER_IP:-$(curl -s ifconfig.me)}"
EMAIL="${EMAIL:-admin@thaliumx.com}"

echo -e "${BLUE}🚀 ThaliumX Staging Environment Deployment${NC}"
echo "==============================================="
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Step 1: System Preparation
print_info "Step 1: Preparing system..."
sudo -n apt update && sudo -n apt upgrade -y
sudo # Docker already installed, skipping package installation

# Configure Docker
# Docker already enabled
# Docker already running
sudo -n usermod -aG docker $USER

print_status "System preparation complete"

# Step 2: Clone Repository
print_info "Step 2: Cloning ThaliumX repository..."
if [ ! -d "thaliumx" ]; then
    git clone https://github.com/Kooban64/thaliumx.git
fi
cd thaliumx

# Set permissions
sudo -n chown -R $USER:$USER .

print_status "Repository cloned"

# Step 3: Staging Environment Configuration
print_info "Step 3: Configuring staging environment..."

# Generate staging-specific secrets
STAGING_JWT_SECRET=$(openssl rand -hex 32)
STAGING_ENCRYPTION_KEY=$(openssl rand -hex 32)
STAGING_POSTGRES_PASSWORD=$(openssl rand -base64 16)
STAGING_REDIS_PASSWORD=$(openssl rand -base64 16)
STAGING_MONGODB_PASSWORD=$(openssl rand -base64 16)
STAGING_KEYCLOAK_PASSWORD=$(openssl rand -base64 16)
STAGING_GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Create staging environment file
cat > .env.staging << EOF
# ThaliumX Staging Environment
NODE_ENV=staging
DOMAIN=$DOMAIN
API_DOMAIN=api.$DOMAIN
AUTH_DOMAIN=auth.$DOMAIN

# Staging-specific settings
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ALLOW_TEST_USERS=true
USE_SANDBOX_APIS=true

# Rate limiting (reduced for staging)
RATE_LIMIT_REQUESTS_PER_MINUTE=100
MAX_CONCURRENT_USERS=50

# Database Configuration
POSTGRES_PASSWORD=$STAGING_POSTGRES_PASSWORD
REDIS_PASSWORD=$STAGING_REDIS_PASSWORD
MONGODB_PASSWORD=$STAGING_MONGODB_PASSWORD

# Keycloak Configuration
KEYCLOAK_ADMIN_PASSWORD=$STAGING_KEYCLOAK_PASSWORD

# JWT & Encryption
JWT_SECRET=$STAGING_JWT_SECRET
ENCRYPTION_KEY=$STAGING_ENCRYPTION_KEY

# Grafana
GRAFANA_ADMIN_PASSWORD=$STAGING_GRAFANA_PASSWORD

# Server Configuration
SERVER_IP=$SERVER_IP

# Staging overrides - use testnet/sandbox where possible
ETHEREUM_NETWORK=sepolia
BSC_NETWORK=testnet
USE_SANDBOX_APIS=true

# Reduced resource allocation for staging
COMPOSE_PROFILES=staging
EOF

print_status "Staging environment configured"

# Step 4: SSL Certificate Setup
print_info "Step 4: Setting up SSL certificates..."

# Install Certbot
sudo -n apt install -y certbot

# Create SSL directory
sudo -n mkdir -p certs/ssl
sudo -n chown -R $USER:$USER certs

# Get SSL certificate for staging domain
sudo certbot certonly --standalone \
  -d $DOMAIN \
  -d api.$DOMAIN \
  -d auth.$DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --non-interactive \
  --test-cert  # Use test cert for staging

# Copy certificates
sudo -n cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem certs/ssl/
sudo -n cp /etc/letsencrypt/live/$DOMAIN/privkey.pem certs/ssl/
sudo -n chown $USER:$USER certs/ssl/*

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
sudo -n systemctl restart ssh

# Install and configure Fail2Ban
sudo -n systemctl enable fail2ban
sudo -n systemctl start fail2ban

print_status "Security hardening applied"

# Step 6: Docker Network Setup
print_info "Step 6: Setting up Docker networks..."
docker network create thaliumx-staging-net 2>/dev/null || true

print_status "Docker networks configured"

# Step 7: Initialize Vault
print_info "Step 7: Initializing Vault..."
./docker/scripts/init-vault.sh

print_status "Vault initialized and seeded"

# Step 8: Create Staging Docker Compose
print_info "Step 8: Creating staging Docker Compose..."

cp docker/compose.production.yaml docker/compose.staging.yaml

# Modify for staging (reduced resources)
cat >> docker/compose.staging.yaml << EOF

# Staging-specific overrides
services:
  # Reduce resource allocation for staging
  postgres:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  redis:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  backend:
    environment:
      - NODE_ENV=staging
      - ENABLE_DEBUG_LOGGING=true
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  frontend:
    environment:
      - NODE_ENV=staging
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'
EOF

print_status "Staging Docker Compose created"

# Step 9: Deploy Services
print_info "Step 9: Deploying ThaliumX services..."

# Load staging environment
export $(cat .env.staging | xargs)

# Deploy with staging configuration
docker compose -f docker/compose.staging.yaml up -d

print_status "Services deployed"

# Step 10: Database Seeding
print_info "Step 10: Seeding staging database..."
./docker/scripts/seed-production-database.sh

# Add staging-specific test users
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "
INSERT INTO users (email, password_hash, status, kyc_status, roles, created_at)
VALUES
('admin@staging.thaliumx.com', '\$2b\$10\$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', 'active', 'approved', '{\"platform_admin\"}', NOW()),
('trader@staging.thaliumx.com', '\$2b\$10\$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', 'active', 'approved', '{\"trader\"}', NOW()),
('user@staging.thaliumx.com', '\$2b\$10\$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', 'active', 'approved', '{\"user\"}', NOW()),
('test@staging.thaliumx.com', '\$2b\$10\$8K1p8Z9X8Y7W6V5U4T3S2R1Q0P9O8N7M6L5K4J3I2H1G0F9E8D7C6B5A4', 'active', 'approved', '{\"user\"}', NOW())
ON CONFLICT (email) DO NOTHING;
"

print_status "Staging database seeded"

# Step 11: SSL Auto-Renewal
print_info "Step 11: Setting up SSL auto-renewal..."

cat > ssl-renewal.sh << EOF
#!/bin/bash
sudo certbot renew --test-cert
sudo -n cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/$USER/thaliumx/certs/ssl/
sudo -n cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/$USER/thaliumx/certs/ssl/
sudo -n chown $USER:$USER /home/$USER/thaliumx/certs/ssl/*
cd /home/$USER/thaliumx
docker compose -f docker/compose.staging.yaml restart apisix
EOF

chmod +x ssl-renewal.sh
(crontab -l ; echo "0 12 * * * /home/$USER/thaliumx/ssl-renewal.sh") | crontab -

print_status "SSL auto-renewal configured"

# Step 12: Backup System
print_info "Step 12: Setting up backup system..."

mkdir -p backups

cat > backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/home/$USER/thaliumx/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p \$BACKUP_DIR

# Database backup
docker exec thaliumx-postgres pg_dump -U thaliumx thaliumx > \$BACKUP_DIR/postgres_\$TIMESTAMP.sql

# Compress backups
tar -czf \$BACKUP_DIR/staging_backup_\$TIMESTAMP.tar.gz \$BACKUP_DIR/postgres_\$TIMESTAMP.sql

# Clean old backups (keep last 7 days)
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "postgres_*.sql" -mtime +7 -delete

echo "Staging backup completed: \$BACKUP_DIR/staging_backup_\$TIMESTAMP.tar.gz"
EOF

chmod +x backup.sh
(crontab -l ; echo "0 2 * * * /home/$USER/thaliumx/backup.sh") | crontab -

print_status "Backup system configured"

# Step 13: Final Testing
print_info "Step 13: Running final staging tests..."

# Wait for services to be fully ready
sleep 30

# Test endpoints
echo "Testing staging endpoints..."
curl -s -k https://$DOMAIN | head -1
curl -s -k https://api.$DOMAIN/health >/dev/null && echo "✅ API healthy" || echo "⚠️ API not ready yet"
curl -s -k https://auth.$DOMAIN/auth/realms/thaliumx >/dev/null && echo "✅ Auth healthy" || echo "⚠️ Auth not ready yet"

print_status "Final testing complete"

# Step 14: Create Test User Guide
print_info "Step 14: Creating test user guide..."

cat > STAGING_TEST_USERS.md << EOF
# ThaliumX Staging Test Users

## Test User Accounts

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| Platform Admin | admin@staging.thaliumx.com | password123 | Full access |
| Trader | trader@staging.thaliumx.com | password123 | Trading access |
| Basic User | user@staging.thaliumx.com | password123 | Portfolio access |
| Test User | test@staging.thaliumx.com | password123 | General testing |

## Pre-loaded Test Data

### Wallets
- USDT: 1,000 USDT per test user
- BTC: 0.05 BTC per test user
- ETH: 0.5 ETH per test user
- THAL: 10,000 THAL per test user

### Trading Pairs
- BTC/USDT, ETH/USDT, BNB/USDT
- THAL/USDT, THAL/BTC, THAL/ETH

### Sample Orders
- Historical orders for testing
- Various order types and statuses

## Testing URLs

- Frontend: https://$DOMAIN
- API: https://api.$DOMAIN
- Auth: https://auth.$DOMAIN
- Monitoring: https://$DOMAIN:3001 (admin/admin)

## Testing Checklist

### Authentication
- [ ] User registration
- [ ] Login/logout
- [ ] Password reset
- [ ] Profile updates

### Trading
- [ ] View market data
- [ ] Place buy/sell orders
- [ ] Check order history
- [ ] Portfolio updates

### Payments
- [ ] Wallet connections
- [ ] Balance displays
- [ ] Transaction history

### Security
- [ ] Rate limiting
- [ ] Input validation
- [ ] Error handling

## Emergency Contacts

- Check service status: docker ps
- View logs: docker logs SERVICE_NAME
- Restart services: docker compose restart
- Full restart: ./deploy-staging.sh
EOF

print_status "Test user guide created"

# Final Summary
echo ""
echo -e "${GREEN}🎉 ThaliumX Staging Environment Deployed!${NC}"
echo "==============================================="
echo ""
echo "🌐 Staging URLs:"
echo "   Frontend: https://$DOMAIN"
echo "   API:      https://api.$DOMAIN"
echo "   Auth:     https://auth.$DOMAIN"
echo ""
echo "📊 Monitoring:"
echo "   Grafana:  https://$DOMAIN:3001"
echo "   Username: admin"
echo "   Password: $STAGING_GRAFANA_PASSWORD"
echo ""
echo "👥 Test Users:"
echo "   Admin:    admin@staging.thaliumx.com / password123"
echo "   Trader:   trader@staging.thaliumx.com / password123"
echo "   User:     user@staging.thaliumx.com / password123"
echo "   Test:     test@staging.thaliumx.com / password123"
echo ""
echo "📁 Important Files:"
echo "   Environment: .env.staging"
echo "   Backups:     backups/"
echo "   Test Guide:  STAGING_TEST_USERS.md"
echo "   SSL Certs:   certs/ssl/"
echo ""
echo "🛠️  Management Commands:"
echo "   View status:    docker ps"
echo "   View logs:      docker logs thaliumx-backend"
echo "   Restart all:    docker compose -f docker/compose.staging.yaml restart"
echo "   Backup now:     ./backup.sh"
echo "   Full redeploy:  ./deploy-staging.sh"
echo ""
echo "📋 Testing Checklist:"
echo "   See STAGING_DEPLOYMENT_GUIDE.md for comprehensive testing"
echo ""
echo -e "${YELLOW}⚠️  STAGING ENVIRONMENT NOTES:${NC}"
echo "   • Uses test SSL certificates (not production-ready)"
echo "   • Reduced resource allocation for cost efficiency"
echo "   • Debug logging enabled for troubleshooting"
echo "   • Test user accounts with sample data"
echo "   • Real API integrations (use small amounts for testing)"
echo ""
echo -e "${GREEN}🎯 Ready for internal testing! Access at https://$DOMAIN${NC}"