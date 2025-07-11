# Crypto Payment Gateway - Operations Runbook

## 🚨 Emergency Contacts

| Role | Contact | When to Contact |
|------|---------|-----------------|
| **Primary On-Call** | your-email@domain.com | First point of contact |
| **Crossmint Support** | support@crossmint.com | Payment processing issues |
| **Infrastructure** | devops@your-domain.com | Server/network issues |
| **Security** | security@your-domain.com | Security incidents |

## 🔧 Common Operations

### Starting the Application

```bash
# Using PM2
pm2 start ecosystem.config.js --env production

# Using Docker
docker-compose up -d

# Direct Node.js
NODE_ENV=production npm start
```

### Stopping the Application

```bash
# Graceful shutdown with PM2
pm2 stop crypto-payment-gateway

# Docker
docker-compose down

# Emergency stop
pm2 kill
```

### Restarting the Application

```bash
# Zero-downtime reload
pm2 reload crypto-payment-gateway

# Hard restart
pm2 restart crypto-payment-gateway

# Docker restart
docker-compose restart
```

### Viewing Logs

```bash
# Real-time logs
pm2 logs crypto-payment-gateway

# Last 100 lines
pm2 logs crypto-payment-gateway --lines 100

# Error logs only
pm2 logs crypto-payment-gateway --err

# Docker logs
docker-compose logs -f crypto-gateway
```

## 🚨 Incident Response

### Payment Processing Failures

**Symptoms:**
- Customers report payment failures
- High error rate in monitoring
- Crossmint webhooks not received

**Actions:**
1. Check Crossmint status: https://status.crossmint.com
2. Verify API credentials:
   ```bash
   grep CROSSMINT .env
   ```
3. Check application logs:
   ```bash
   pm2 logs crypto-payment-gateway --lines 200 | grep ERROR
   ```
4. Test API connectivity:
   ```bash
   curl -H "X-CLIENT-SECRET: $CROSSMINT_API_KEY" \
        -H "X-PROJECT-ID: $CROSSMINT_CLIENT_ID" \
        https://api.crossmint.com/api/2022-06-09/checkout/sessions
   ```
5. If Crossmint is down, enable maintenance mode:
   ```bash
   echo "ENABLE_MAINTENANCE_MODE=true" >> .env
   pm2 reload crypto-payment-gateway
   ```

### High Error Rate

**Symptoms:**
- Error rate >1% in monitoring
- Multiple failed transactions
- Slow response times

**Actions:**
1. Check error patterns:
   ```bash
   pm2 logs crypto-payment-gateway --err --lines 500 | grep -E "ERROR|CRITICAL"
   ```
2. Check system resources:
   ```bash
   free -h
   df -h
   top -n 1
   ```
3. Check rate limits:
   ```bash
   redis-cli
   > KEYS rate_limit:*
   > TTL rate_limit:suspicious_ip
   ```
4. Scale if needed:
   ```bash
   pm2 scale crypto-payment-gateway +2
   ```

### Security Incident

**Symptoms:**
- Suspicious activity in logs
- Unauthorized access attempts
- Abnormal traffic patterns

**Actions:**
1. Enable emergency mode:
   ```bash
   echo "ENABLE_MAINTENANCE_MODE=true" >> .env
   pm2 reload crypto-payment-gateway
   ```
2. Block suspicious IPs:
   ```bash
   sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP
   ```
3. Rotate API keys:
   - Log into Crossmint dashboard
   - Generate new API keys
   - Update .env file
   - Reload application
4. Review access logs:
   ```bash
   grep "SUSPICIOUS_PATTERN" /var/log/nginx/access.log
   ```
5. Document incident and notify security team

### Database Issues

**Symptoms:**
- Connection errors in logs
- Slow query performance
- Transaction history unavailable

**Actions:**
1. Check database connectivity:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```
2. Check connection pool:
   ```bash
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
   ```
3. Kill long-running queries:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   AND query_start < now() - interval '5 minutes';
   ```
4. Emergency database restart:
   ```bash
   sudo systemctl restart postgresql
   ```

## 📊 Monitoring Procedures

### Daily Checks

1. **Transaction Volume**
   ```bash
   # Check daily transaction count
   curl -s http://localhost:3000/api/metrics | jq '.daily_transactions'
   ```

2. **Success Rate**
   ```bash
   # Check payment success rate
   curl -s http://localhost:3000/api/metrics | jq '.success_rate'
   ```

3. **System Health**
   ```bash
   ./scripts/monitor.sh
   ```

4. **Backup Verification**
   ```bash
   ls -la /var/backups/crypto-gateway/ | tail -5
   ```

### Weekly Tasks

1. **Performance Review**
   - Check average response times
   - Review error patterns
   - Analyze traffic trends

2. **Security Audit**
   - Review access logs
   - Check for failed login attempts
   - Verify SSL certificate expiry

3. **Capacity Planning**
   - Monitor resource usage trends
   - Plan for scaling if needed
   - Review rate limit settings

### Monthly Tasks

1. **Full System Backup**
   ```bash
   ./scripts/backup.sh
   ```

2. **Dependency Updates**
   ```bash
   npm audit
   npm update --save
   ```

3. **Performance Optimization**
   - Analyze slow queries
   - Review caching effectiveness
   - Optimize resource usage

## 🛠️ Maintenance Procedures

### Scheduled Maintenance

1. **Pre-Maintenance**
   ```bash
   # Announce maintenance
   echo "Maintenance scheduled for $(date)" | mail -s "Maintenance Notice" users@list.com
   
   # Enable maintenance mode
   echo "ENABLE_MAINTENANCE_MODE=true" >> .env
   pm2 reload crypto-payment-gateway
   ```

2. **During Maintenance**
   ```bash
   # Backup current state
   ./scripts/backup.sh
   
   # Perform updates
   git pull origin main
   npm install
   npm run build
   
   # Run migrations if needed
   npm run migrate
   ```

3. **Post-Maintenance**
   ```bash
   # Disable maintenance mode
   sed -i '/ENABLE_MAINTENANCE_MODE/d' .env
   
   # Reload application
   pm2 reload crypto-payment-gateway
   
   # Verify functionality
   curl http://localhost:3000/health
   ```

### Emergency Rollback

```bash
# Stop current version
pm2 stop crypto-payment-gateway

# Restore previous version
cd /home/ubuntu/crypto-payment-gateway
git checkout HEAD~1
npm install
npm run build

# Restart with previous version
pm2 start ecosystem.config.js --env production

# Verify rollback
curl http://localhost:3000/health
```

## 📈 Performance Tuning

### Application Optimization

1. **Increase Worker Processes**
   ```javascript
   // ecosystem.config.js
   instances: 'max', // Use all CPU cores
   ```

2. **Memory Limits**
   ```javascript
   max_memory_restart: '2G', // Increase if needed
   ```

3. **Node.js Flags**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" pm2 start
   ```

### Database Optimization

1. **Connection Pool**
   ```javascript
   // Adjust in config
   pool: {
     max: 20, // Increase connections
     min: 5,
     idle: 10000
   }
   ```

2. **Query Optimization**
   ```sql
   -- Add indexes for frequently queried fields
   CREATE INDEX idx_payments_status ON payments(status);
   CREATE INDEX idx_payments_created ON payments(created_at);
   ```

### Caching Optimization

1. **Redis Configuration**
   ```bash
   # Increase memory limit
   redis-cli CONFIG SET maxmemory 2gb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

2. **Cache Warming**
   ```bash
   # Pre-load frequently accessed data
   curl http://localhost:3000/api/warmup-cache
   ```

## 🔍 Troubleshooting Guide

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Webhook Failures** | Payments stuck in pending | Verify webhook URL in Crossmint dashboard |
| **Rate Limiting** | 429 errors | Increase rate limits or implement backoff |
| **Memory Leaks** | Increasing memory usage | Enable heap snapshots and analyze |
| **Slow Queries** | High response times | Enable query logging and optimize |
| **SSL Errors** | Certificate warnings | Renew certificate with certbot |

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug pm2 reload crypto-payment-gateway

# Enable SQL query logging
DEBUG=sequelize:* pm2 reload crypto-payment-gateway

# Enable request logging
DEBUG=express:* pm2 reload crypto-payment-gateway
```

### Health Check Endpoints

```bash
# Basic health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Dependency health
curl http://localhost:3000/health/dependencies
```

## 📝 Reporting

### Incident Report Template

```markdown
## Incident Report

**Date:** [Date]
**Time:** [Start Time] - [End Time]
**Severity:** Critical/High/Medium/Low
**Impact:** [Number of affected users/transactions]

### Summary
[Brief description of the incident]

### Timeline
- [Time]: [Event]
- [Time]: [Event]

### Root Cause
[Detailed explanation of what caused the incident]

### Resolution
[Steps taken to resolve the incident]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]

### Lessons Learned
[What we learned from this incident]
```

### Performance Report

```bash
# Generate weekly performance report
cat > performance_report_$(date +%Y%m%d).md << EOF
# Performance Report - $(date)

## Transaction Metrics
- Total Transactions: $(curl -s localhost:3000/api/metrics | jq .total_transactions)
- Success Rate: $(curl -s localhost:3000/api/metrics | jq .success_rate)%
- Average Response Time: $(curl -s localhost:3000/api/metrics | jq .avg_response_time)ms

## System Metrics
- CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')%
- Memory Usage: $(free | grep Mem | awk '{print int($3/$2 * 100)}')%
- Disk Usage: $(df -h / | awk 'NR==2 {print $5}')

## Recommendations
[Add any performance recommendations]
EOF
```

## 🔄 Continuous Improvement

### Monthly Review Checklist

- [ ] Review incident reports
- [ ] Analyze performance trends
- [ ] Update monitoring thresholds
- [ ] Review and update documentation
- [ ] Plan capacity for growth
- [ ] Security audit findings
- [ ] Customer feedback analysis
- [ ] Cost optimization review

### Automation Opportunities

1. **Automated Scaling**
   - Implement auto-scaling based on load
   - Set up predictive scaling

2. **Automated Testing**
   - Implement synthetic monitoring
   - Set up automated transaction tests

3. **Automated Remediation**
   - Self-healing scripts for common issues
   - Automated rollback on failures

---

**Last Updated:** January 2025
**Version:** 1.0
**Next Review:** Monthly