# Production Deployment Checklist

## 🔐 Pre-Deployment Setup

### 1. Crossmint Account Configuration
- [ ] Log into Crossmint Dashboard: https://app.crossmint.com
- [ ] Navigate to Settings → Billing
- [ ] Add payment method (credit card) for transaction fees
- [ ] Go to API Keys section
- [ ] Copy Production Client ID: `_________________`
- [ ] Copy Production API Key: `_________________`
- [ ] Save webhook signing secret: `_________________`

### 2. Environment Configuration
- [ ] Copy `.env.production` to `.env`
- [ ] Update `CROSSMINT_CLIENT_ID` with production value
- [ ] Update `CROSSMINT_API_KEY` with production value
- [ ] Generate secure `SESSION_SECRET` (use: `openssl rand -base64 32`)
- [ ] Generate secure `JWT_SECRET` (use: `openssl rand -base64 32`)
- [ ] Update `BASE_URL` with your domain (e.g., https://payments.yourdomain.com)

### 3. Domain & SSL Setup
- [ ] Register domain name (if not already done)
- [ ] Point domain to hosting provider
- [ ] Obtain SSL certificate (Let's Encrypt recommended)
- [ ] Configure HTTPS redirect
- [ ] Test SSL configuration: https://www.ssllabs.com/ssltest/

## 🚀 Deployment Options

### Option A: Heroku Deployment (Recommended for Quick Start)

```bash
# 1. Install Heroku CLI
# 2. Login to Heroku
heroku login

# 3. Create new app
heroku create your-crypto-gateway

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CROSSMINT_CLIENT_ID=your_client_id
heroku config:set CROSSMINT_API_KEY=your_api_key
heroku config:set CROSSMINT_ENVIRONMENT=production
heroku config:set BASE_URL=https://your-crypto-gateway.herokuapp.com

# 5. Deploy
git push heroku main

# 6. Open app
heroku open
```

### Option B: AWS EC2 Deployment

```bash
# 1. Launch EC2 instance (Ubuntu 20.04 LTS recommended)
# 2. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Install dependencies
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# 4. Clone repository
git clone https://github.com/your-repo/crypto-payment-gateway.git
cd crypto-payment-gateway

# 5. Install packages and build
npm install
npm run build

# 6. Configure environment
cp .env.production .env
nano .env  # Update with your values

# 7. Start with PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 8. Configure Nginx
sudo nano /etc/nginx/sites-available/crypto-gateway
# Add configuration (see DEPLOYMENT.md)
sudo ln -s /etc/nginx/sites-available/crypto-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 9. Setup SSL
sudo certbot --nginx -d your-domain.com
```

### Option C: Docker Deployment

```bash
# 1. Build Docker image
docker build -t crypto-payment-gateway .

# 2. Run with environment file
docker run -d \
  --name crypto-gateway \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  crypto-payment-gateway

# 3. Or use Docker Compose
docker-compose up -d
```

## ⚙️ Post-Deployment Configuration

### 1. Crossmint Webhook Setup
- [ ] Go to Crossmint Dashboard → Webhooks
- [ ] Add webhook endpoint: `https://your-domain.com/api/crossmint/webhook`
- [ ] Select events:
  - [ ] payment.completed
  - [ ] payment.failed
  - [ ] payment.pending
- [ ] Copy webhook signing secret
- [ ] Update `WEBHOOK_SECRET` in production environment

### 2. Monitoring Setup
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring (New Relic, DataDog)
- [ ] Create alerts for:
  - [ ] High error rate (>1%)
  - [ ] Slow response times (>2s)
  - [ ] Failed payments
  - [ ] Low success rate (<95%)

### 3. Security Hardening
- [ ] Enable firewall (UFW on Ubuntu)
- [ ] Configure fail2ban
- [ ] Set up log rotation
- [ ] Enable automated security updates
- [ ] Configure backup strategy

## ✅ Verification Testing

### 1. Health Check
```bash
curl https://your-domain.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. API Documentation
```bash
# Visit: https://your-domain.com/api/v1
# Verify Swagger documentation loads
```

### 3. Checkout Page
```bash
# Visit: https://your-domain.com/checkout
# Verify checkout page loads with Crossmint widget
```

### 4. Test Transaction
- [ ] Go to checkout page
- [ ] Enter test amount: $10.00
- [ ] Select Ethereum network
- [ ] Enter email: test@example.com
- [ ] Use test card: 4242 4242 4242 4242
- [ ] Complete payment
- [ ] Verify webhook received
- [ ] Check crypto settlement

### 5. Production Transaction
- [ ] Process real $1 transaction
- [ ] Verify crypto received in wallet
- [ ] Check transaction in Crossmint dashboard
- [ ] Confirm webhook notifications

## 📊 Monitoring Dashboard

### Key Metrics to Track
- [ ] Total transaction volume
- [ ] Success rate percentage
- [ ] Average settlement time
- [ ] Error rate by type
- [ ] Geographic distribution
- [ ] Payment method breakdown

### Create Monitoring Views
```bash
# Crossmint Dashboard
https://app.crossmint.com/analytics

# Application Logs
pm2 logs crypto-payment-gateway

# Error Tracking
https://sentry.io/organizations/your-org/issues/

# Performance Monitoring
https://newrelic.com/your-app
```

## 🚨 Emergency Procedures

### Payment Issues
1. Check Crossmint status: https://status.crossmint.com
2. Review application logs: `pm2 logs`
3. Check webhook delivery status
4. Verify API credentials
5. Contact Crossmint support if needed

### High Error Rate
1. Check error logs for patterns
2. Verify external service availability
3. Review recent deployments
4. Rollback if necessary: `pm2 reload ecosystem.config.js --update-env`

### Security Incident
1. Enable maintenance mode
2. Review access logs
3. Rotate API keys
4. Update security groups
5. Notify affected users

## 📈 Go-Live Checklist

### Final Verification
- [ ] All environment variables configured
- [ ] SSL certificate valid and installed
- [ ] Webhooks configured and tested
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Documentation updated
- [ ] Support process defined

### Launch Steps
1. [ ] Enable production mode
2. [ ] Process test transaction
3. [ ] Monitor first hour closely
4. [ ] Send launch announcement
5. [ ] Monitor metrics for 24 hours

### Success Criteria
- [ ] 99%+ uptime in first 24 hours
- [ ] <1% error rate
- [ ] <5 second page load time
- [ ] Successful transaction processing
- [ ] No critical errors

## 📞 Support Contacts

### Technical Support
- **Crossmint Support**: support@crossmint.com
- **Crossmint Docs**: https://docs.crossmint.com
- **System Admin**: your-email@domain.com
- **Emergency**: +1-XXX-XXX-XXXX

### Escalation Path
1. Application logs and monitoring
2. Technical documentation
3. Crossmint support
4. Development team

---

**Last Updated**: January 2025
**Checklist Version**: 1.0
**Next Review**: After first production transaction