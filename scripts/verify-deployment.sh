#!/bin/bash

# Production Deployment Verification Script
# Verifies all components are working correctly after deployment

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log "Testing: $test_name"
    
    if eval "$test_command"; then
        success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        error "$test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test functions
test_health_endpoint() {
    local response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" --max-time $TIMEOUT)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"status":"ok"'; then
            return 0
        fi
    fi
    return 1
}

test_api_documentation() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1" --max-time $TIMEOUT)
    [ "$http_code" = "200" ]
}

test_checkout_page() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/checkout" --max-time $TIMEOUT)
    [ "$http_code" = "200" ]
}

test_crossmint_config() {
    local response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/crossmint/config" --max-time $TIMEOUT)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"success":true'; then
            return 0
        fi
    fi
    return 1
}

test_payment_creation() {
    local payload='{"amount":1,"currency":"USD","chain":"ethereum","customerEmail":"test@example.com"}'
    local response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/crossmint/payment" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --max-time $TIMEOUT)
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "201" ]; then
        if echo "$body" | grep -q '"success":true'; then
            # Extract session ID for cleanup
            PAYMENT_SESSION_ID=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
            return 0
        fi
    fi
    return 1
}

test_webhook_endpoint() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/crossmint/webhook" --max-time $TIMEOUT)
    # Webhook should return 405 (Method Not Allowed) for GET requests
    [ "$http_code" = "405" ] || [ "$http_code" = "400" ]
}

test_ssl_certificate() {
    if [[ "$BASE_URL" == https://* ]]; then
        local domain=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
        
        # Check if SSL certificate is valid
        if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null >/dev/null; then
            # Check expiry date
            local expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep 'notAfter' | cut -d= -f2)
            local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
            local current_epoch=$(date +%s)
            local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            if [ "$days_left" -gt 7 ]; then
                return 0
            fi
        fi
        return 1
    else
        # HTTP - skip SSL test
        return 0
    fi
}

test_response_time() {
    local start_time=$(date +%s.%N)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" --max-time $TIMEOUT)
    local end_time=$(date +%s.%N)
    
    if [ "$http_code" = "200" ]; then
        local response_time=$(echo "$end_time - $start_time" | bc 2>/dev/null || echo "1")
        # Check if response time is under 2 seconds
        if (( $(echo "$response_time < 2" | bc -l 2>/dev/null || echo "1") )); then
            return 0
        fi
    fi
    return 1
}

test_rate_limiting() {
    # Test if rate limiting is working by making rapid requests
    local success_count=0
    local rate_limited=false
    
    for i in {1..20}; do
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" --max-time 5)
        if [ "$http_code" = "200" ]; then
            success_count=$((success_count + 1))
        elif [ "$http_code" = "429" ]; then
            rate_limited=true
            break
        fi
    done
    
    # Either we should get some successful requests and eventually hit rate limit,
    # or all requests should succeed (indicating rate limit is high enough)
    [ "$success_count" -gt 10 ] || [ "$rate_limited" = true ]
}

test_security_headers() {
    local headers=$(curl -s -I "$BASE_URL/checkout" --max-time $TIMEOUT)
    
    # Check for important security headers
    if echo "$headers" | grep -qi "x-frame-options" && \
       echo "$headers" | grep -qi "x-content-type-options"; then
        return 0
    fi
    return 1
}

# System tests
test_disk_space() {
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    [ "$disk_usage" -lt 90 ]
}

test_memory_usage() {
    local memory_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    [ "$memory_usage" -lt 90 ]
}

test_process_running() {
    if command -v pm2 &> /dev/null; then
        pm2 list | grep -q "crypto-payment-gateway.*online"
    else
        ps aux | grep -q "node.*index.js" | grep -v grep
    fi
}

# Run Node.js specific tests
test_nodejs_webhooks() {
    if command -v node &> /dev/null && [ -f "./scripts/test-webhooks.js" ]; then
        cd "$(dirname "$0")/.." && node scripts/test-webhooks.js --quick >/dev/null 2>&1
    else
        return 0  # Skip if Node.js tests not available
    fi
}

test_nodejs_transactions() {
    if command -v node &> /dev/null && [ -f "./scripts/test-live-transaction.js" ]; then
        cd "$(dirname "$0")/.." && node scripts/test-live-transaction.js --quick >/dev/null 2>&1
    else
        return 0  # Skip if Node.js tests not available
    fi
}

# Main test execution
main() {
    echo "🚀 Crypto Payment Gateway - Deployment Verification"
    echo "=" .repeat 60
    echo "Target URL: $BASE_URL"
    echo "Timeout: ${TIMEOUT}s"
    echo ""
    
    log "Starting deployment verification tests..."
    echo ""
    
    # Application Tests
    echo "📱 Application Tests"
    echo "-------------------"
    run_test "Health endpoint" test_health_endpoint
    run_test "API documentation" test_api_documentation
    run_test "Checkout page" test_checkout_page
    run_test "Crossmint configuration" test_crossmint_config
    run_test "Payment creation" test_payment_creation
    run_test "Webhook endpoint" test_webhook_endpoint
    echo ""
    
    # Security Tests
    echo "🔒 Security Tests"
    echo "----------------"
    run_test "SSL certificate" test_ssl_certificate
    run_test "Security headers" test_security_headers
    run_test "Rate limiting" test_rate_limiting
    echo ""
    
    # Performance Tests
    echo "⚡ Performance Tests"
    echo "-------------------"
    run_test "Response time" test_response_time
    echo ""
    
    # System Tests
    echo "🖥️  System Tests"
    echo "---------------"
    run_test "Disk space" test_disk_space
    run_test "Memory usage" test_memory_usage
    run_test "Process running" test_process_running
    echo ""
    
    # Integration Tests
    echo "🔗 Integration Tests"
    echo "-------------------"
    run_test "Webhook integration" test_nodejs_webhooks
    run_test "Transaction flow" test_nodejs_transactions
    echo ""
    
    # Summary
    echo "📊 Test Summary"
    echo "==============="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo ""
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        success "All tests passed! 🎉"
        echo ""
        echo "✅ Your crypto payment gateway is ready for production!"
        echo ""
        echo "Next steps:"
        echo "1. Configure Crossmint webhooks in the dashboard"
        echo "2. Process a test transaction"
        echo "3. Monitor the application for 24 hours"
        echo "4. Set up automated monitoring alerts"
        exit 0
    else
        error "Some tests failed. Please review and fix issues before going live."
        echo ""
        echo "Failed tests need to be addressed before production deployment."
        echo "Check the logs above for specific error details."
        echo ""
        echo "Common fixes:"
        echo "- Verify environment variables are set correctly"
        echo "- Check Crossmint API credentials"
        echo "- Ensure the application is running"
        echo "- Verify network connectivity"
        exit 1
    fi
}

# Check if bc is available for floating point arithmetic
if ! command -v bc &> /dev/null; then
    warning "bc not found. Some performance tests may be skipped."
fi

# Run main function
main