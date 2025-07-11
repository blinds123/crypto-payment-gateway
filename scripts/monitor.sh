#!/bin/bash

# Production Monitoring Script
# Monitors the health and performance of the crypto payment gateway

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@your-domain.com}"
LOG_FILE="/var/log/crypto-gateway/monitor.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check health endpoint
check_health() {
    log "Checking health endpoint..."
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        log "Health check passed: $body"
        return 0
    else
        echo -e "${RED}✗ Health check failed (HTTP $http_code)${NC}"
        log "Health check failed: HTTP $http_code - $body"
        send_alert "Health check failed" "HTTP $http_code - $body"
        return 1
    fi
}

# Check API endpoints
check_api() {
    log "Checking API endpoints..."
    
    # Check API documentation
    api_response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1")
    if [ "$api_response" = "200" ]; then
        echo -e "${GREEN}✓ API documentation available${NC}"
        log "API documentation check passed"
    else
        echo -e "${RED}✗ API documentation unavailable (HTTP $api_response)${NC}"
        log "API documentation check failed: HTTP $api_response"
        send_alert "API documentation unavailable" "HTTP $api_response"
    fi
    
    # Check Crossmint config endpoint
    config_response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/crossmint/config")
    config_code=$(echo "$config_response" | tail -n1)
    
    if [ "$config_code" = "200" ]; then
        echo -e "${GREEN}✓ Crossmint config endpoint working${NC}"
        log "Crossmint config check passed"
    else
        echo -e "${RED}✗ Crossmint config endpoint failed (HTTP $config_code)${NC}"
        log "Crossmint config check failed: HTTP $config_code"
        send_alert "Crossmint config endpoint failed" "HTTP $config_code"
    fi
}

# Check SSL certificate
check_ssl() {
    if [[ "$BASE_URL" == https://* ]]; then
        log "Checking SSL certificate..."
        domain=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
        
        # Check certificate expiry
        expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep 'notAfter' | cut -d= -f2)
        
        if [ -n "$expiry_date" ]; then
            expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
            current_epoch=$(date +%s)
            days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [ "$days_left" -gt 30 ]; then
                echo -e "${GREEN}✓ SSL certificate valid for $days_left days${NC}"
                log "SSL certificate valid for $days_left days"
            elif [ "$days_left" -gt 7 ]; then
                echo -e "${YELLOW}⚠ SSL certificate expires in $days_left days${NC}"
                log "SSL certificate warning: expires in $days_left days"
                send_alert "SSL certificate expiring soon" "Certificate expires in $days_left days"
            else
                echo -e "${RED}✗ SSL certificate expires in $days_left days!${NC}"
                log "SSL certificate critical: expires in $days_left days"
                send_alert "SSL certificate expiring!" "Certificate expires in $days_left days"
            fi
        else
            echo -e "${RED}✗ Could not check SSL certificate${NC}"
            log "SSL certificate check failed"
        fi
    fi
}

# Check response time
check_response_time() {
    log "Checking response times..."
    
    # Measure checkout page load time
    start_time=$(date +%s.%N)
    checkout_response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/checkout")
    end_time=$(date +%s.%N)
    
    response_time=$(echo "$end_time - $start_time" | bc)
    
    if [ "$checkout_response" = "200" ]; then
        if (( $(echo "$response_time < 2" | bc -l) )); then
            echo -e "${GREEN}✓ Checkout page response time: ${response_time}s${NC}"
            log "Checkout page response time: ${response_time}s"
        else
            echo -e "${YELLOW}⚠ Checkout page slow: ${response_time}s${NC}"
            log "Checkout page slow: ${response_time}s"
            send_alert "Slow checkout page" "Response time: ${response_time}s"
        fi
    else
        echo -e "${RED}✗ Checkout page unavailable (HTTP $checkout_response)${NC}"
        log "Checkout page unavailable: HTTP $checkout_response"
        send_alert "Checkout page unavailable" "HTTP $checkout_response"
    fi
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt 80 ]; then
        echo -e "${GREEN}✓ Disk usage: ${disk_usage}%${NC}"
        log "Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠ Disk usage high: ${disk_usage}%${NC}"
        log "Disk usage warning: ${disk_usage}%"
        send_alert "High disk usage" "Disk usage: ${disk_usage}%"
    else
        echo -e "${RED}✗ Disk usage critical: ${disk_usage}%${NC}"
        log "Disk usage critical: ${disk_usage}%"
        send_alert "Critical disk usage" "Disk usage: ${disk_usage}%"
    fi
}

# Check memory usage
check_memory() {
    log "Checking memory usage..."
    
    memory_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    
    if [ "$memory_usage" -lt 80 ]; then
        echo -e "${GREEN}✓ Memory usage: ${memory_usage}%${NC}"
        log "Memory usage: ${memory_usage}%"
    elif [ "$memory_usage" -lt 90 ]; then
        echo -e "${YELLOW}⚠ Memory usage high: ${memory_usage}%${NC}"
        log "Memory usage warning: ${memory_usage}%"
        send_alert "High memory usage" "Memory usage: ${memory_usage}%"
    else
        echo -e "${RED}✗ Memory usage critical: ${memory_usage}%${NC}"
        log "Memory usage critical: ${memory_usage}%"
        send_alert "Critical memory usage" "Memory usage: ${memory_usage}%"
    fi
}

# Check process status
check_process() {
    log "Checking process status..."
    
    if command -v pm2 &> /dev/null; then
        pm2_status=$(pm2 list | grep "crypto-payment-gateway" | grep "online" | wc -l)
        if [ "$pm2_status" -gt 0 ]; then
            echo -e "${GREEN}✓ Application process running${NC}"
            log "Application process running"
        else
            echo -e "${RED}✗ Application process not running${NC}"
            log "Application process not running"
            send_alert "Application down" "PM2 process not running"
        fi
    else
        # Check if node process is running
        node_process=$(ps aux | grep "node.*index.js" | grep -v grep | wc -l)
        if [ "$node_process" -gt 0 ]; then
            echo -e "${GREEN}✓ Node process running${NC}"
            log "Node process running"
        else
            echo -e "${RED}✗ Node process not running${NC}"
            log "Node process not running"
            send_alert "Application down" "Node process not running"
        fi
    fi
}

# Send alert (implement your preferred notification method)
send_alert() {
    subject=$1
    message=$2
    
    # Example: Send email alert
    # echo "$message" | mail -s "Crypto Gateway Alert: $subject" "$ALERT_EMAIL"
    
    # Example: Send to Slack
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"Alert: $subject - $message\"}" \
    #     YOUR_SLACK_WEBHOOK_URL
    
    # Log the alert
    log "ALERT: $subject - $message"
}

# Main monitoring function
main() {
    echo "========================================="
    echo "Crypto Payment Gateway Monitor"
    echo "Time: $(date)"
    echo "========================================="
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Run all checks
    check_health
    check_api
    check_ssl
    check_response_time
    check_disk_space
    check_memory
    check_process
    
    echo "========================================="
    echo "Monitoring complete"
    echo "========================================="
}

# Run main function
main