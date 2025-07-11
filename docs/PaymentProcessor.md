# PaymentProcessor Documentation

## Overview

The PaymentProcessor is the core orchestration service that handles the complete payment lifecycle in the crypto payment gateway. It provides a robust, production-ready system for processing payments across multiple routes (blockchain, DEX, scraping, self-hosted) with comprehensive monitoring, fraud detection, and settlement capabilities.

## Features

### Core Capabilities
- **Multi-Route Processing**: Supports blockchain, DEX, scraping, and self-hosted payment routes
- **Smart Route Selection**: Automatically selects optimal payment routes based on multiple criteria
- **Failover Handling**: Seamless failover to alternative routes when primary routes fail
- **Real-time Monitoring**: Continuous payment status monitoring with configurable intervals
- **Fraud Detection**: Built-in fraud detection system with risk scoring
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Settlement Processing**: Automated settlement processing with fee calculation
- **Webhook Notifications**: Reliable webhook delivery with retry mechanisms
- **Comprehensive Logging**: Detailed audit trails and structured logging
- **Event-Driven Architecture**: Emits events for all major payment lifecycle events

### Public API Integration
- **Zero-Signup APIs**: Uses only public APIs that require no registration
- **Rate Limit Compliance**: Respects API rate limits (e.g., CoinGecko 30 calls/min)
- **Endpoint Failover**: Multiple endpoint support for high availability
- **Error Handling**: Graceful degradation when APIs are unavailable

## Architecture

### Core Components

```typescript
PaymentProcessor
├── SmartRouter           # Route selection and failover
├── RouteHandlers         # Route-specific implementations
├── FraudDetection        # Risk assessment and scoring
├── SettlementProcessor   # Settlement and fee calculation
├── WebhookManager        # Webhook delivery and retry
├── EventEmitter          # Event-driven notifications
├── AuditTrail            # Comprehensive logging
└── MonitoringSystem      # Status monitoring and cleanup
```

### Payment Flow

1. **Payment Creation**
   - Validate input parameters
   - Perform fraud detection
   - Check rate limits
   - Select optimal route
   - Generate payment instructions
   - Start monitoring

2. **Payment Processing**
   - Monitor payment status
   - Handle route failures
   - Process failover if needed
   - Send webhook notifications
   - Update audit trails

3. **Payment Completion**
   - Verify payment completion
   - Process settlement
   - Calculate fees
   - Send final webhooks
   - Clean up resources

## Configuration

### PaymentProcessorConfig

```typescript
interface PaymentProcessorConfig {
  rateLimits: {
    maxConcurrentPayments: number;    // Default: 100
    maxPaymentsPerMinute: number;     // Default: 1000
    maxPaymentsPerHour: number;       // Default: 10000
  };
  monitoring: {
    statusCheckInterval: number;      // Default: 30000ms
    paymentTimeout: number;           // Default: 1800000ms (30 min)
    maxRetries: number;               // Default: 3
  };
  fraud: {
    maxAmountPerCustomer: number;     // Default: 10000
    maxPaymentsPerCustomer: number;   // Default: 10
    suspiciousPatterns: string[];     // Configurable patterns
  };
  settlement: {
    autoSettlementEnabled: boolean;   // Default: true
    minSettlementAmount: number;      // Default: 100
    settlementFrequency: string;      // Default: 'instant'
  };
  webhook: {
    maxRetries: number;               // Default: 3
    retryDelayMs: number;             // Default: 5000
    timeoutMs: number;                // Default: 30000
  };
}
```

## API Reference

### Core Methods

#### createPayment(dto: CreatePaymentDTO)
Creates a new payment with automatic route selection and monitoring.

```typescript
const result = await processor.createPayment({
  merchantId: 'merchant_123',
  amount: 100,
  currency: 'USD',
  cryptoCurrency: 'BTC',
  customer: {
    email: 'customer@example.com',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  },
  metadata: {
    orderId: 'order_123',
    webhookUrl: 'https://merchant.com/webhook'
  }
});

// Returns: { payment: Payment, instructions: PaymentInstructions }
```

#### checkPaymentStatus(paymentId: string)
Checks the current status of a payment.

```typescript
const status = await processor.checkPaymentStatus('payment_123');
// Returns: { payment, status, instructions, settlement }
```

#### cancelPayment(paymentId: string, reason: string)
Cancels a payment if it's still in progress.

```typescript
const cancelled = await processor.cancelPayment('payment_123', 'User requested');
// Returns: boolean
```

#### processRefund(paymentId: string, amount?: number)
Processes a refund for a completed payment.

```typescript
const refunded = await processor.processRefund('payment_123');
// Returns: boolean
```

#### getPaymentDetails(paymentId: string)
Retrieves detailed payment information including audit trail.

```typescript
const details = await processor.getPaymentDetails('payment_123');
// Returns: { payment, context }
```

#### getProcessingStats()
Returns processing statistics and metrics.

```typescript
const stats = await processor.getProcessingStats();
// Returns: { activePayments, processingQueue, totalProcessed, successRate, ... }
```

## Route Handlers

### Blockchain Routes
- **Bitcoin**: Direct blockchain transactions using public RPC nodes
- **Ethereum**: Smart contract interactions via public nodes
- **Polygon**: Layer 2 processing with reduced fees

### DEX Routes
- **Uniswap**: Decentralized exchange integration via The Graph
- **PancakeSwap**: BSC-based DEX with public APIs
- **SushiSwap**: Multi-chain DEX support

### Scraping Routes
- **CoinGecko**: Price data scraping (30 calls/min limit)
- **LocalBitcoins**: P2P rate scraping
- **Exchange Rates**: Multi-source rate aggregation

### Self-Hosted Routes
- **BTCPay**: Self-hosted payment gateway integration
- **Direct Wallet**: Wallet-to-wallet transfers
- **Web3 Integration**: MetaMask and WalletConnect support

## Event System

### Payment Events
- `payment_created`: New payment created
- `payment_processing`: Payment status updated to processing
- `payment_completed`: Payment successfully completed
- `payment_failed`: Payment failed
- `payment_cancelled`: Payment cancelled
- `payment_refunded`: Payment refunded

### Route Events
- `route_selected`: Route selected for payment
- `route_failover`: Failover to alternative route
- `route_failed`: Route failure detected

### Settlement Events
- `settlement_created`: Settlement process initiated
- `settlement_completed`: Settlement completed
- `settlement_failed`: Settlement failed

### Webhook Events
- `webhook_sent`: Webhook successfully delivered
- `webhook_failed`: Webhook delivery failed

## Fraud Detection

### Risk Factors
- **High Amount**: Payments above configured threshold
- **Frequent Customer**: Multiple payments from same customer
- **Suspicious IP**: IP addresses with bad reputation
- **Unusual Patterns**: Rapid succession, round numbers, etc.

### Risk Scoring
- **Low Risk (0-30)**: Automatic approval
- **Medium Risk (31-69)**: Manual review recommended
- **High Risk (70+)**: Automatic rejection

## Settlement Processing

### Automatic Settlement
- Triggered on payment completion
- Calculates platform, network, and route fees
- Supports multiple settlement frequencies
- Handles multi-currency settlements

### Fee Structure
```typescript
interface SettlementFees {
  platformFee: number;    // 0.1% platform fee
  networkFee: number;     // Dynamic network fee
  routeFee: number;       // Route-specific fee
  total: number;          // Total deducted amount
  currency: string;       // Fee currency
}
```

## Monitoring & Observability

### Metrics
- Active payments count
- Processing queue size
- Success/failure rates
- Average processing time
- Route performance metrics

### Logging
- Structured JSON logging
- Payment lifecycle events
- Route selection decisions
- Error details and stack traces
- Performance metrics

### Audit Trail
- Complete payment history
- All status changes
- Route failover events
- Settlement processing
- Webhook delivery attempts

## Error Handling

### Retry Logic
- Configurable max retries per route
- Exponential backoff for webhooks
- Automatic route failover
- Graceful degradation

### Error Types
- **Route Errors**: Network, API, or service failures
- **Validation Errors**: Invalid input parameters
- **Fraud Errors**: High-risk payment detection
- **Rate Limit Errors**: API or internal rate limits
- **Settlement Errors**: Fee calculation or processing failures

## Security Features

### Input Validation
- Comprehensive DTO validation
- SQL injection prevention
- XSS protection
- Rate limiting

### Fraud Prevention
- Real-time risk scoring
- IP reputation checking
- Pattern analysis
- Configurable thresholds

### Audit Compliance
- Complete audit trails
- Immutable event logs
- Compliance reporting
- Data retention policies

## Performance Optimization

### Concurrency
- Configurable concurrent payment limits
- Async processing with proper error handling
- Event-driven architecture for scalability

### Caching
- Redis for rate limiting
- Route metrics caching
- Price data caching with TTL

### Resource Management
- Automatic cleanup of expired payments
- Memory-efficient context management
- Connection pooling for external APIs

## Usage Examples

### Basic Payment Processing
```typescript
import { PaymentProcessor } from './PaymentProcessor';

const processor = new PaymentProcessor({
  rateLimits: {
    maxConcurrentPayments: 50,
    maxPaymentsPerMinute: 500
  },
  monitoring: {
    statusCheckInterval: 30000,
    paymentTimeout: 1800000
  }
});

// Create payment
const payment = await processor.createPayment({
  merchantId: 'merchant_123',
  amount: 100,
  currency: 'USD',
  customer: {
    email: 'customer@example.com',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
});

// Monitor payment
const status = await processor.checkPaymentStatus(payment.payment.id);
console.log(`Payment status: ${status.status}`);
```

### Event Handling
```typescript
// Listen for payment events
processor.on('payment_completed', async ({ paymentId }) => {
  console.log(`Payment ${paymentId} completed`);
  // Trigger fulfillment
});

processor.on('payment_failed', async ({ paymentId, reason }) => {
  console.log(`Payment ${paymentId} failed: ${reason}`);
  // Handle failure
});

processor.on('route_failover', async ({ paymentId, previousRoute, newRoute }) => {
  console.log(`Payment ${paymentId} failed over from ${previousRoute} to ${newRoute}`);
});
```

### Custom Configuration
```typescript
const processor = new PaymentProcessor({
  rateLimits: {
    maxConcurrentPayments: 200,
    maxPaymentsPerMinute: 2000,
    maxPaymentsPerHour: 50000
  },
  fraud: {
    maxAmountPerCustomer: 50000,
    maxPaymentsPerCustomer: 50,
    suspiciousPatterns: ['rapid_succession', 'round_amounts']
  },
  settlement: {
    autoSettlementEnabled: true,
    minSettlementAmount: 1000,
    settlementFrequency: 'hourly'
  }
});
```

## Best Practices

### Production Deployment
1. **Configure appropriate rate limits** based on expected load
2. **Set up monitoring** for key metrics and alerts
3. **Implement proper error handling** in webhook endpoints
4. **Use Redis clustering** for high availability
5. **Set up log aggregation** for centralized monitoring

### Security
1. **Validate all inputs** before processing
2. **Use HTTPS** for all webhook URLs
3. **Implement IP whitelisting** for sensitive operations
4. **Monitor fraud patterns** and adjust thresholds
5. **Regular security audits** of the payment flow

### Performance
1. **Optimize database queries** for payment lookups
2. **Use connection pooling** for external APIs
3. **Implement caching** for frequently accessed data
4. **Monitor memory usage** and implement cleanup
5. **Use async processing** for non-blocking operations

## Troubleshooting

### Common Issues

#### Payment Stuck in Processing
- Check route handler logs for errors
- Verify external API availability
- Review payment timeout settings
- Check for rate limit violations

#### High Failure Rate
- Monitor route performance metrics
- Check external API status
- Review fraud detection thresholds
- Verify network connectivity

#### Webhook Delivery Failures
- Check webhook URL accessibility
- Verify SSL certificate validity
- Review webhook timeout settings
- Monitor webhook retry attempts

#### Memory Issues
- Review payment context cleanup
- Check for memory leaks in event handlers
- Monitor Redis memory usage
- Implement payment archiving

### Debugging
```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Get detailed payment information
const details = await processor.getPaymentDetails(paymentId);
console.log('Payment details:', details);
console.log('Audit trail:', details.context.auditTrail);

// Check processing statistics
const stats = await processor.getProcessingStats();
console.log('Processing stats:', stats);
```

## Maintenance

### Regular Tasks
1. **Clean up expired payments** (automatic via cron)
2. **Archive old audit logs** (implement as needed)
3. **Update route configurations** (as APIs change)
4. **Review fraud detection rules** (monthly)
5. **Monitor performance metrics** (daily)

### Updates
1. **Update dependencies** regularly for security
2. **Review API changes** for external services
3. **Update rate limits** based on usage patterns
4. **Optimize database queries** as data grows
5. **Review error handling** for new edge cases

## Support

For issues, questions, or contributions:
1. Check the troubleshooting guide
2. Review the audit logs
3. Check external API status
4. Contact the development team
5. Submit bug reports with detailed logs