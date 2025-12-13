# ThaliumX Live Production Deployment Guide
==========================================

This guide provides step-by-step instructions for deploying ThaliumX to live production for real user testing.

## Prerequisites

### 1. Production Server Requirements
- **OS:** Ubuntu 22.04 LTS or later
- **CPU:** 8+ cores (16+ recommended)
- **RAM:** 32GB+ (64GB recommended)
- **Storage:** 500GB+ SSD
- **Network:** 1Gbps+ bandwidth

### 2. Domain & SSL
- ✅ Domain: `thaliumx.com` (already registered)
- SSL certificates will be auto-generated via Let's Encrypt

### 3. Cloud Provider Options
- **AWS EC2:** t3.2xlarge or c6i.4xlarge
- **DigitalOcean:** 16GB/8CPU droplet
- **Linode:** Dedicated CPU instances
- **Hetzner:** CPX51 or AX41

## Step 1: Server Setup

### 1.1 Provision Production Server
```bash
# Example: AWS EC2 setup
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type c6i.4xlarge \
  --key-name your-key-pair \
  --security-groups thaliumx-prod \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":500,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ThaliumX-Production}]'
```

### 1.2 Initial Server Configuration
```bash
# SSH into your server
ssh ubuntu@YOUR_SERVER_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y docker.io docker-compose-plugin git curl wget htop iotop

# Configure Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Install Docker Compose v2
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reboot to apply changes
sudo reboot
```

### 1.3 Clone Repository
```bash
# SSH back in after reboot
ssh ubuntu@YOUR_SERVER_IP

# Clone the repository
git clone https://github.com/Kooban64/thaliumx.git
cd thaliumx

# Set correct permissions
sudo chown -R ubuntu:ubuntu .
```

## Step 2: Environment Configuration

### 2.1 Production Environment Variables
```bash
# Copy and configure production environment
cp .env.production .env

# Edit with your production values
nano .env
```

**Required Production Environment Variables:**
```bash
# Domain Configuration
DOMAIN=thaliumx.com
API_DOMAIN=api.thaliumx.com
AUTH_DOMAIN=auth.thaliumx.com

# SSL Configuration
SSL_EMAIL=admin@thaliumx.com
SSL_STAGING=false

# Database Configuration
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
REDIS_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
MONGODB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# Keycloak Configuration
KEYCLOAK_ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# JWT & Encryption
JWT_SECRET=CHANGE_THIS_256_BIT_SECRET
ENCRYPTION_KEY=CHANGE_THIS_256_BIT_KEY

# External Services (if needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring
GRAFANA_ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
```

### 2.2 Generate Strong Secrets
```bash
# Generate cryptographically secure secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -base64 32  # For passwords
```

## Step 3: DNS Configuration

### 3.1 Update DNS Records
Configure these DNS records for `thaliumx.com`:

```
# A Records
thaliumx.com        A    YOUR_SERVER_IP
www.thaliumx.com    A    YOUR_SERVER_IP
api.thaliumx.com    A    YOUR_SERVER_IP
auth.thaliumx.com   A    YOUR_SERVER_IP

# Optional: CDN/CloudFlare
# Configure CloudFlare for additional security and performance
```

### 3.2 Verify DNS Propagation
```bash
# Check DNS propagation
nslookup thaliumx.com
dig thaliumx.com
```

## Step 4: SSL Certificate Setup

### 4.1 Install Certbot
```bash
# Install Certbot for Let's Encrypt
sudo apt install -y certbot

# Create SSL directory
sudo mkdir -p /etc/ssl/thaliumx
sudo chown ubuntu:ubuntu /etc/ssl/thaliumx
```

### 4.2 Generate SSL Certificates
```bash
# Generate certificates for all domains
sudo certbot certonly --standalone \
  -d thaliumx.com \
  -d www.thaliumx.com \
  -d api.thaliumx.com \
  -d auth.thaliumx.com \
  --email admin@thaliumx.com \
  --agree-tos \
  --non-interactive

# Copy certificates to ThaliumX directory
sudo cp /etc/letsencrypt/live/thaliumx.com/fullchain.pem ./certs/ssl/
sudo cp /etc/letsencrypt/live/thaliumx.com/privkey.pem ./certs/ssl/
sudo chown ubuntu:ubuntu ./certs/ssl/*
```

### 4.3 Set Up Auto-Renewal
```bash
# Create renewal script
cat > /home/ubuntu/ssl-renewal.sh << 'EOF'
#!/bin/bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/thaliumx.com/fullchain.pem /home/ubuntu/thaliumx/certs/ssl/
sudo cp /etc/letsencrypt/live/thaliumx.com/privkey.pem /home/ubuntu/thaliumx/certs/ssl/
sudo chown ubuntu:ubuntu /home/ubuntu/thaliumx/certs/ssl/*
docker-compose -f /home/ubuntu/thaliumx/docker-compose.prod.yml restart apisix
EOF

# Make executable and add to crontab
chmod +x /home/ubuntu/ssl-renewal.sh
(crontab -l ; echo "0 12 * * * /home/ubuntu/ssl-renewal.sh") | crontab -
```

## Step 5: Production Deployment

### 5.1 Run Production Deployment Script
```bash
cd /home/ubuntu/thaliumx

# Make deployment script executable
chmod +x docker/scripts/deploy-production.sh

# Run production deployment
./docker/scripts/deploy-production.sh
```

### 5.2 Monitor Deployment Progress
```bash
# Monitor container status
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check service health
curl -s http://localhost:3002/health | jq .
curl -s http://localhost:3000 | head -5

# View logs if needed
docker logs thaliumx-backend --tail 50
docker logs thaliumx-frontend --tail 50
```

### 5.3 Configure Reverse Proxy (Optional)
If you want to use a reverse proxy instead of APISIX:

```bash
# Install Nginx
sudo apt install -y nginx

# Configure Nginx
sudo tee /etc/nginx/sites-available/thaliumx << EOF
server {
    listen 80;
    server_name thaliumx.com www.thaliumx.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name thaliumx.com www.thaliumx.com;

    ssl_certificate /etc/letsencrypt/live/thaliumx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thaliumx.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name api.thaliumx.com;

    ssl_certificate /etc/letsencrypt/live/thaliumx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thaliumx.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name auth.thaliumx.com;

    ssl_certificate /etc/letsencrypt/live/thaliumx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thaliumx.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/thaliumx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Database Initialization

### 6.1 Initialize Production Database
```bash
# Run database seeding
cd /home/ubuntu/thaliumx
./docker/scripts/seed-production-database.sh

# Verify database is seeded
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "SELECT COUNT(*) FROM users;"
```

### 6.2 Backup Configuration
```bash
# Create backup script
cat > /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker exec thaliumx-postgres pg_dump -U thaliumx thaliumx > $BACKUP_DIR/postgres_$TIMESTAMP.sql

# MongoDB backup
docker exec thaliumx-mongodb mongodump --out $BACKUP_DIR/mongodb_$TIMESTAMP

# Compress backups
tar -czf $BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz $BACKUP_DIR/postgres_$TIMESTAMP.sql $BACKUP_DIR/mongodb_$TIMESTAMP

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "postgres_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "mongodb_*" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz"
EOF

# Make executable and schedule
chmod +x /home/ubuntu/backup.sh
(crontab -l ; echo "0 2 * * * /home/ubuntu/backup.sh") | crontab -
```

## Step 7: Security Hardening

### 7.1 Firewall Configuration
```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw --force enable

# Verify firewall status
sudo ufw status
```

### 7.2 SSH Hardening
```bash
# Disable password authentication
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Disable root login
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart ssh

# Add your public key to authorized_keys
echo "YOUR_PUBLIC_SSH_KEY" >> ~/.ssh/authorized_keys
```

### 7.3 Fail2Ban Setup
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for SSH
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

## Step 8: Monitoring & Alerting

### 8.1 Set Up Monitoring
```bash
# Access Grafana
echo "Grafana: http://YOUR_SERVER_IP:3001"
echo "Username: admin"
echo "Password: YOUR_GRAFANA_PASSWORD"

# Access Prometheus
echo "Prometheus: http://YOUR_SERVER_IP:9090"

# Access Loki (logs)
echo "Loki: http://YOUR_SERVER_IP:3100"
```

### 8.2 Configure Alerts
```bash
# Edit Prometheus alert rules
nano docker/observability/config/prometheus/alerts.yml

# Example alerts:
# - Service down
# - High CPU usage
# - Low disk space
# - Database connection issues
```

### 8.3 Log Aggregation
```bash
# Verify Loki is collecting logs
curl -s "http://localhost:3100/loki/api/v1/query?query={job=\"thaliumx\"}" | jq .
```

## Step 9: Performance Optimization

### 9.1 Docker Resource Limits
```bash
# Configure Docker daemon
sudo tee /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
EOF

sudo systemctl restart docker
```

### 9.2 System Tuning
```bash
# Increase file descriptors
echo "ubuntu soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "ubuntu hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Configure sysctl for better performance
sudo tee -a /etc/sysctl.conf << EOF
# Network tuning
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.ip_local_port_range = 1024 65535

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOF

sudo sysctl -p
```

## Step 10: Final Testing & Go-Live

### 10.1 Run Production Tests
```bash
cd /home/ubuntu/thaliumx

# Run comprehensive tests
TEST_TARGET=https://thaliumx.com ./docker/scripts/run-seeded-tests.sh

# Test individual endpoints
curl -I https://thaliumx.com
curl -s https://api.thaliumx.com/health | jq .
curl -s https://auth.thaliumx.com/auth/realms/thaliumx
```

### 10.2 Load Testing
```bash
# Install k6 for load testing
sudo apt install -y k6

# Run load tests
k6 run docker/tests/load/auth-load-test.js
k6 run docker/tests/load/trading-load-test.js
```

### 10.3 Go-Live Checklist
- [ ] DNS propagation complete
- [ ] SSL certificates valid
- [ ] All services healthy
- [ ] Database seeded with test data
- [ ] Monitoring alerts configured
- [ ] Backup system operational
- [ ] Security hardening applied
- [ ] Load testing passed
- [ ] Admin access verified

### 10.4 Emergency Rollback Plan
```bash
# Quick rollback script
cat > /home/ubuntu/rollback.sh << 'EOF'
#!/bin/bash
echo "Rolling back to previous version..."

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
# (Implement backup restoration logic)

# Restart with previous configuration
git checkout PREVIOUS_TAG
docker-compose -f docker-compose.prod.yml up -d

echo "Rollback complete"
EOF

chmod +x /home/ubuntu/rollback.sh
```

## Step 11: Post-Launch Monitoring

### 11.1 Monitor Key Metrics
```bash
# Check system resources
htop
iotop
docker stats

# Monitor application logs
docker logs -f thaliumx-backend
docker logs -f thaliumx-frontend

# Check error rates
curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])" | jq .
```

### 11.2 User Acceptance Testing
1. **Registration Flow:** Test user registration and email verification
2. **Authentication:** Test login/logout with different user types
3. **Trading Interface:** Test order placement and execution
4. **Wallet Integration:** Test Web3 wallet connections
5. **Mobile Responsiveness:** Test on various devices
6. **Performance:** Test under real user load

## Emergency Contacts & Support

### Production Support
- **Primary Contact:** admin@thaliumx.com
- **Monitoring:** https://thaliumx.com:3001 (Grafana)
- **Logs:** https://thaliumx.com:3100 (Loki)
- **Security:** https://thaliumx.com:5601 (Wazuh)

### Critical Incident Response
1. Check service health: `docker ps`
2. Review logs: `docker logs SERVICE_NAME`
3. Check monitoring dashboards
4. Scale resources if needed
5. Contact development team if required

## Success Metrics

### Performance Targets
- **Response Time:** <500ms for API calls
- **Uptime:** 99.9% availability
- **Error Rate:** <0.1% 5xx errors
- **Concurrent Users:** Support 10,000+ users

### Security Compliance
- **Data Encryption:** All sensitive data encrypted
- **Access Control:** Role-based permissions enforced
- **Audit Logging:** All actions logged and monitored
- **Compliance:** GDPR and financial regulations met

---

## 🚀 Launch Command

Once all steps are complete:

```bash
# Final go-live command
cd /home/ubuntu/thaliumx
echo "🚀 ThaliumX is now LIVE at https://thaliumx.com"

# Monitor initial traffic
docker logs -f thaliumx-frontend | head -20
docker logs -f thaliumx-backend | head -20
```

**Congratulations! ThaliumX is now live in production! 🎉**