# ThaliumX Internal Staging Environment Setup
==========================================

This guide provides step-by-step instructions for deploying ThaliumX to an internal staging environment for testing with real integrations before public launch.

## Prerequisites

### 1. Staging Server Requirements
- **OS:** Ubuntu 22.04 LTS
- **CPU:** 4+ cores
- **RAM:** 8GB+
- **Storage:** 50GB+ SSD
- **Network:** Stable internet connection

### 2. Domain Configuration
- **Staging Domain:** `staging.thaliumx.com` or `test.thaliumx.com`
- **SSL:** Let's Encrypt certificates (free)

### 3. Test Accounts Setup
- Create test user accounts for internal team
- Set up test wallets with small amounts
- Configure test payment methods

## Step 1: Server Provisioning

### 1.1 Choose Cloud Provider
**Recommended for Staging:**
- **DigitalOcean:** $12/month (2GB RAM, 1 vCPU)
- **AWS Lightsail:** $10/month (1GB RAM, 0.5 vCPU)
- **Hetzner:** €3.29/month (2GB RAM, 1 vCPU)

### 1.2 Server Setup
```bash
# Provision server and SSH in
ssh root@YOUR_STAGING_IP

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y docker.io docker-compose-plugin git curl wget htop

# Configure Docker
systemctl enable docker
systemctl start docker

# Clone repository
git clone https://github.com/Kooban64/thaliumx.git
cd thaliumx
```

## Step 2: Staging Environment Configuration

### 2.1 Create Staging Environment File
```bash
# Copy and modify environment file for staging
cp .env.production .env.staging

# Edit staging configuration
nano .env.staging
```

**Staging Environment Variables:**
```bash
# Staging Configuration
NODE_ENV=staging
DOMAIN=staging.thaliumx.com
API_DOMAIN=api.staging.thaliumx.com
AUTH_DOMAIN=auth.staging.thaliumx.com

# Use testnet/sandbox APIs where available
ETHEREUM_NETWORK=testnet
BSC_NETWORK=testnet
USE_SANDBOX_APIS=true

# Reduced resource limits for staging
RATE_LIMIT_REQUESTS_PER_MINUTE=100
MAX_CONCURRENT_USERS=50

# Staging-specific settings
ENABLE_DEBUG_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
ALLOW_TEST_USERS=true
```

### 2.2 Configure Testnet/Sandbox APIs

**Update API endpoints to use test networks:**

```bash
# In your .env.staging file
# Use testnet RPC endpoints
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/

# Use sandbox payment APIs (if available)
NEDBANK_SANDBOX=true
PAYSHAP_TEST_MODE=true

# Use test email service
SMTP_SERVER=smtp.mailtrap.io
SMTP_PORT=2525
```

## Step 3: Staging Deployment

### 3.1 Run Staging Deployment Script
```bash
cd /home/ubuntu/thaliumx

# Create staging deployment script
cat > deploy-staging.sh << 'EOF'
#!/bin/bash

# ThaliumX Staging Deployment Script

echo "🚀 Deploying ThaliumX to Staging Environment..."

# Load staging environment
export $(cat .env.staging | xargs)

# Update docker-compose for staging
cp docker-compose.production.yml docker-compose.staging.yml

# Modify for staging resources
sed -i 's/replicas: 3/replicas: 1/g' docker-compose.staging.yml
sed -i 's/cpu: 2/cpu: 0.5/g' docker-compose.staging.yml
sed -i 's/memory: 4GB/memory: 1GB/g' docker-compose.staging.yml

# Deploy services
docker-compose -f docker-compose.staging.yml up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 60

# Run health checks
echo "🔍 Running health checks..."
curl -s http://localhost:3002/health | jq .
curl -s http://localhost:3000 | head -5

echo "✅ Staging deployment complete!"
echo "🌐 Access at: http://localhost:3000"
echo "📊 Monitoring: http://localhost:3001"

EOF

chmod +x deploy-staging.sh
./deploy-staging.sh
```

### 3.2 Domain and SSL Setup
```bash
# Install Certbot
apt install -y certbot

# Get SSL certificate for staging domain
certbot certonly --standalone \
  -d staging.thaliumx.com \
  -d api.staging.thaliumx.com \
  -d auth.staging.thaliumx.com \
  --email admin@thaliumx.com \
  --agree-tos \
  --non-interactive

# Copy certificates
cp /etc/letsencrypt/live/staging.thaliumx.com/fullchain.pem certs/ssl/
cp /etc/letsencrypt/live/staging.thaliumx.com/privkey.pem certs/ssl/
```

## Step 4: Test Data Setup

### 4.1 Create Internal Test Users
```bash
# Run database seeding for staging
./docker/scripts/seed-production-database.sh

# Add additional staging-specific test users
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "
INSERT INTO users (email, password_hash, status, kyc_status, roles, created_at)
VALUES
('admin@staging.thaliumx.com', '\$2b\$10\$test_hash', 'active', 'approved', '["platform_admin"]', NOW()),
('trader@staging.thaliumx.com', '\$2b\$10\$test_hash', 'active', 'approved', '["trader"]', NOW()),
('user@staging.thaliumx.com', '\$2b\$10\$test_hash', 'active', 'approved', '["user"]', NOW())
ON CONFLICT (email) DO NOTHING;
"
```

### 4.2 Set Up Test Wallets
```bash
# Create test wallets with small amounts for testing
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "
INSERT INTO wallets (user_id, currency, type, balance, available_balance, status)
SELECT
    u.id,
    'USDT',
    'spot',
    1000.00,
    1000.00,
    'active'
FROM users u
WHERE u.email LIKE '%@staging.thaliumx.com'
ON CONFLICT (user_id, currency, type) DO NOTHING;
"
```

## Step 5: Internal Testing Checklist

### 5.1 Pre-Testing Setup
- [ ] **Team Access:** Share staging URLs with internal team
- [ ] **Test Accounts:** Distribute test user credentials
- [ ] **Documentation:** Share testing guidelines
- [ ] **Monitoring:** Set up alerts for staging environment
- [ ] **Backup:** Configure staging data backup

### 5.2 Core Functionality Testing

#### **Authentication & User Management**
- [ ] **Registration:** Test user signup flow
- [ ] **Login/Logout:** Test authentication across devices
- [ ] **Password Reset:** Test email-based password recovery
- [ ] **Profile Management:** Test user profile updates
- [ ] **Role-Based Access:** Verify permissions for different user types

#### **Trading Interface**
- [ ] **Market Data:** Verify real-time price feeds
- [ ] **Order Placement:** Test buy/sell orders (use small amounts)
- [ ] **Order Types:** Test market, limit, stop orders
- [ ] **Order History:** Check order execution and history
- [ ] **Portfolio View:** Verify balance updates

#### **Wallet Integration**
- [ ] **Web3 Connection:** Test MetaMask wallet connection
- [ ] **Balance Display:** Verify wallet balance accuracy
- [ ] **Transaction History:** Check deposit/withdrawal history
- [ ] **Network Switching:** Test different blockchain networks

#### **Payment Processing**
- [ ] **Bank Transfer:** Test Nedbank integration (if sandbox available)
- [ ] **PayShap:** Test PayShap payment resolution
- [ ] **Transaction Status:** Monitor payment confirmations
- [ ] **Fee Calculation:** Verify fee structures

#### **Token Presale**
- [ ] **Presale Interface:** Test token purchase flow
- [ ] **Payment Integration:** Test USDT/bank transfer payments
- [ ] **Token Allocation:** Verify token receipt
- [ ] **Vesting Logic:** Test token release schedules

### 5.3 Security Testing

#### **Input Validation**
- [ ] **SQL Injection:** Test for injection vulnerabilities
- [ ] **XSS Attempts:** Verify XSS prevention
- [ ] **CSRF Protection:** Test cross-site request forgery prevention
- [ ] **Rate Limiting:** Verify API rate limiting works

#### **Authentication Security**
- [ ] **Session Management:** Test session timeouts
- [ ] **Token Security:** Verify JWT token handling
- [ ] **Password Policies:** Test password requirements
- [ ] **MFA Setup:** Test multi-factor authentication

#### **API Security**
- [ ] **Endpoint Protection:** Verify API authentication
- [ ] **Data Validation:** Test input sanitization
- [ ] **Error Handling:** Check error message security
- [ ] **Audit Logging:** Verify security event logging

### 5.4 Performance Testing

#### **Load Testing**
- [ ] **Concurrent Users:** Test with 10-20 simultaneous users
- [ ] **API Response Times:** Verify <500ms response times
- [ ] **Page Load Times:** Check <3 second page loads
- [ ] **Database Queries:** Monitor query performance

#### **Resource Usage**
- [ ] **CPU Usage:** Monitor during peak load
- [ ] **Memory Usage:** Check for memory leaks
- [ ] **Disk I/O:** Verify database performance
- [ ] **Network I/O:** Monitor API traffic

### 5.5 Integration Testing

#### **External API Testing**
- [ ] **Exchange APIs:** Test real trading with small amounts
- [ ] **Blockchain APIs:** Verify transaction data accuracy
- [ ] **Payment APIs:** Test payment processing flows
- [ ] **Email Service:** Verify email delivery
- [ ] **KYC Service:** Test identity verification

#### **Cross-Service Integration**
- [ ] **Trading to Wallet:** Verify balance updates after trades
- [ ] **Payment to Wallet:** Test fiat-to-crypto conversion
- [ ] **KYC to Trading:** Verify trading restrictions
- [ ] **Email Notifications:** Test automated notifications

## Step 6: Monitoring & Debugging

### 6.1 Access Monitoring Dashboards
```bash
# Grafana Dashboard
echo "Grafana: http://staging.thaliumx.com:3001"
echo "Username: admin"
echo "Password: YOUR_GRAFANA_PASSWORD"

# Prometheus Metrics
echo "Prometheus: http://staging.thaliumx.com:9090"

# Application Logs
docker logs -f thaliumx-backend
docker logs -f thaliumx-frontend
```

### 6.2 Common Issues & Solutions

#### **Service Not Starting**
```bash
# Check service status
docker ps -a

# View service logs
docker logs SERVICE_NAME

# Restart service
docker restart SERVICE_NAME
```

#### **Database Connection Issues**
```bash
# Check database connectivity
docker exec thaliumx-postgres pg_isready -U thaliumx

# Verify database tables
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "\dt"
```

#### **API Endpoint Issues**
```bash
# Test API endpoints
curl -v http://localhost:3002/health
curl -v http://localhost:3002/api/auth/status

# Check API logs
docker logs thaliumx-backend --tail 50
```

## Step 7: Staging Environment Maintenance

### 7.1 Regular Maintenance Tasks
```bash
# Update SSL certificates
certbot renew

# Update application
cd /home/ubuntu/thaliumx
git pull origin main
docker-compose -f docker-compose.staging.yml up -d --build

# Clean up old containers
docker system prune -f

# Backup staging data
./backup.sh
```

### 7.2 Monitoring Alerts Setup
- Set up alerts for:
  - Service downtime
  - High error rates
  - Resource usage spikes
  - Security incidents

## Step 8: Go/No-Go Decision

### 8.1 Success Criteria
- [ ] **All Core Features Working:** 95%+ functionality operational
- [ ] **Security Testing Passed:** No critical vulnerabilities
- [ ] **Performance Acceptable:** Response times within limits
- [ ] **Integration Testing Complete:** All APIs functioning
- [ ] **User Experience Good:** Intuitive and bug-free interface

### 8.2 Go Decision
**If all criteria met:**
- ✅ Proceed to production deployment
- ✅ Schedule production launch
- ✅ Prepare user communication
- ✅ Set up production monitoring

### 8.3 No-Go Decision
**If issues found:**
- 🔄 Fix identified issues
- 🔄 Re-test problematic areas
- 🔄 Extend staging testing period
- 🔄 Re-evaluate when issues resolved

## Step 9: Production Deployment Preparation

### 9.1 Final Production Checklist
- [ ] **Code Freeze:** No more changes to staging
- [ ] **Database Migration:** Prepare production database scripts
- [ ] **Environment Variables:** Finalize production configuration
- [ ] **SSL Certificates:** Obtain production certificates
- [ ] **Domain Configuration:** Set up production DNS
- [ ] **Monitoring Setup:** Configure production alerts
- [ ] **Backup Strategy:** Implement production backups

### 9.2 Production Deployment
```bash
# Use the production deployment script
./deploy-to-production.sh

# Verify production deployment
TEST_TARGET=https://thaliumx.com ./docker/scripts/run-seeded-tests.sh
```

---

## Staging Environment URLs

```
🌐 Frontend: https://staging.thaliumx.com
🔗 API: https://api.staging.thaliumx.com
🔐 Auth: https://auth.staging.thaliumx.com
📊 Monitoring: https://staging.thaliumx.com:3001
🔍 Logs: https://staging.thaliumx.com:3100
🛡️ Security: https://staging.thaliumx.com:5601
```

## Emergency Contacts

- **Technical Issues:** Check monitoring dashboards first
- **Service Down:** Restart with `docker-compose restart`
- **Data Issues:** Restore from backup with `./restore.sh`
- **Security Incident:** Review Wazuh alerts and logs

---

**🎯 Staging environment ready for comprehensive internal testing!**