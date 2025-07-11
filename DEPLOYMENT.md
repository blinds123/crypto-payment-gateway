# Crypto Payment Gateway - Production Deployment Guide

## 🚀 Deployment Options

### Option 1: Direct Node.js Deployment

```bash
# 1. Clone and setup
git clone <repository-url>
cd crypto-payment-gateway
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your production values

# 3. Build and deploy
./deploy.sh
```

### Option 2: Docker Deployment

```bash
# 1. Build Docker image
docker build -t crypto-payment-gateway .

# 2. Run with Docker Compose
docker-compose up -d

# 3. View logs
docker-compose logs -f crypto-gateway
```

### Option 3: Cloud Platform Deployment

#### Heroku
```bash
# 1. Create Heroku app
heroku create your-crypto-gateway

# 2. Set environment variables
heroku config:set CROSSMINT_CLIENT_ID=your_client_id
heroku config:set CROSSMINT_API_KEY=your_api_key
heroku config:set CROSSMINT_ENVIRONMENT=production
heroku config:set BASE_URL=https://your-crypto-gateway.herokuapp.com

# 3. Deploy
git push heroku main
```

#### Vercel
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod
```

#### AWS EC2
```bash
# 1. SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-instance

# 2. Install Node.js and PM2
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
sudo npm install -g pm2

# 3. Clone and setup
git clone <repository-url>
cd crypto-payment-gateway
npm install

# 4. Configure and deploy
cp .env.example .env
# Edit .env
./deploy.sh
```

## 🔧 Production Configuration

### Required Environment Variables

```bash
# Crossmint Configuration
CROSSMINT_CLIENT_ID=your_production_client_id
CROSSMINT_API_KEY=your_production_api_key
CROSSMINT_ENVIRONMENT=production

# Application Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com

# Security
CORS_ORIGIN=https://your-frontend.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### SSL/TLS Configuration

#### Using Let's Encrypt with Nginx

```bash
# 1. Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 2. Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 3. Auto-renewal
sudo certbot renew --dry-run
```

#### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Monitoring & Maintenance

### Health Monitoring

```bash
# Check application health
curl https://your-domain.com/health

# Monitor with PM2
pm2 monit

# View logs
pm2 logs crypto-payment-gateway --lines 100
```

### Performance Monitoring

1. **Application Metrics**
   - Response times
   - Error rates
   - Transaction success rates

2. **Infrastructure Metrics**
   - CPU usage
   - Memory usage
   - Network I/O

### Backup Strategy

```bash
# Backup environment configuration
cp .env .env.backup-$(date +%Y%m%d)

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

## 🔒 Security Checklist

- [ ] SSL/TLS certificate installed
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Firewall rules set
- [ ] Regular security updates
- [ ] Log rotation configured
- [ ] Backup procedures in place

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill process
   kill -9 <PID>
   ```

2. **Permission Errors**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER .
   ```

3. **Memory Issues**
   ```bash
   # Increase Node.js memory
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start
```

## 📈 Scaling Considerations

### Horizontal Scaling

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'crypto-gateway',
    script: './dist/index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster'
  }]
};
```

### Load Balancing

Use Nginx or AWS ELB for distributing traffic across multiple instances.

### Database Optimization

Consider implementing:
- Connection pooling
- Query optimization
- Caching layer (Redis)

## 🎯 Post-Deployment Steps

1. **Configure Crossmint Webhook**
   - Dashboard → Settings → Webhooks
   - URL: `https://your-domain.com/api/crossmint/webhook`

2. **Test Live Transaction**
   - Small amount test payment
   - Verify crypto settlement
   - Check webhook notifications

3. **Monitor First 24 Hours**
   - Watch logs for errors
   - Monitor performance metrics
   - Check transaction success rates

4. **Documentation**
   - Update API documentation
   - Document any custom configurations
   - Create runbook for common issues

## 📞 Support Contacts

- **Technical Issues**: your-email@domain.com
- **Crossmint Support**: support@crossmint.com
- **Emergency**: +1-XXX-XXX-XXXX

---

**Last Updated**: January 2025
**Version**: 1.0.0