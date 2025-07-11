# Crypto Payment Gateway API Documentation

## Overview

The Crypto Payment Gateway provides a comprehensive REST API for processing cryptocurrency payments with multiple routes, merchant management, and webhook delivery. This API enables merchants to accept fiat payments and receive crypto settlements without requiring customer KYC.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://api.crypto-gateway.com`

## Authentication

All API endpoints require authentication using API keys. Include your API key in the request header:

```
X-API-Key: pk_test_your_api_key_here
```

or as a Bearer token:

```
Authorization: Bearer pk_test_your_api_key_here
```

### API Key Formats

- **Test Keys:** `pk_test_...` (for development/testing)
- **Live Keys:** `pk_live_...` (for production)

## Rate Limiting

API requests are rate-limited per merchant:

- **Standard Tier:** 100 requests/minute
- **Premium Tier:** 1000 requests/minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Error Handling

All errors follow a consistent format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "additional": "error details"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes

- `UNAUTHORIZED` - Invalid or missing API key
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PAYMENT_NOT_FOUND` - Payment ID not found
- `MERCHANT_NOT_FOUND` - Merchant not found
- `INTERNAL_SERVER_ERROR` - Server error

## Webhooks

Webhooks are HTTP POST requests sent to your configured webhook URL when events occur. All webhook requests include:

- **X-Webhook-Signature:** HMAC signature for verification
- **X-Webhook-Timestamp:** Unix timestamp of the request
- **X-Webhook-ID:** Unique webhook delivery ID

### Webhook Verification

Verify webhook signatures using HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Webhook Events

- `payment.created` - Payment created
- `payment.completed` - Payment completed successfully
- `payment.failed` - Payment failed
- `payment.expired` - Payment expired
- `payment.refunded` - Payment refunded
- `settlement.completed` - Crypto settlement completed
- `settlement.failed` - Crypto settlement failed

## API Endpoints

### Merchants

#### Register Merchant

```
POST /api/v1/merchants/register
```

Register a new merchant account with instant approval.

**Request Body:**
```json
{
  "businessName": "My Business",
  "abn": "12345678901",
  "email": "merchant@example.com",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D404fddC900f30A5",
  "preferredCrypto": "USDT",
  "webhookUrl": "https://example.com/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "mer_abc123456789",
      "businessName": "My Business",
      "abn": "12345678901",
      "email": "merchant@example.com",
      "walletAddress": "0x742d35Cc6634C0532925a3b8D404fddC900f30A5",
      "preferredCrypto": "USDT",
      "kycStatus": "approved",
      "apiKey": "pk_test_...",
      "webhookUrl": "https://example.com/webhook",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "credentials": {
      "apiKey": "pk_test_...",
      "apiSecret": "sk_test_...",
      "merchantId": "mer_abc123456789"
    }
  },
  "message": "Merchant registered successfully. Your account has been approved instantly."
}
```

#### Get Merchant Profile

```
GET /api/v1/merchants/profile
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "mer_abc123456789",
    "businessName": "My Business",
    "abn": "12345678901",
    "email": "merchant@example.com",
    "walletAddress": "0x742d35Cc6634C0532925a3b8D404fddC900f30A5",
    "preferredCrypto": "USDT",
    "kycStatus": "approved",
    "apiKey": "pk_test_...",
    "webhookUrl": "https://example.com/webhook",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Update Merchant Profile

```
PUT /api/v1/merchants/profile
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Request Body:**
```json
{
  "businessName": "Updated Business Name",
  "email": "newemail@example.com",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D404fddC900f30A5",
  "webhookUrl": "https://example.com/new-webhook"
}
```

#### Generate New API Keys

```
POST /api/v1/merchants/api-keys
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Request Body:**
```json
{
  "environment": "test"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "pk_test_new_key...",
    "apiSecret": "sk_test_new_secret...",
    "environment": "test",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "New API keys generated successfully"
}
```

#### Get Analytics

```
GET /api/v1/merchants/analytics?period=30d&currency=AUD&groupBy=day
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Query Parameters:**
- `period` - Time period (24h, 7d, 30d, 90d, 1y)
- `currency` - Currency filter (AUD, USD, EUR)
- `groupBy` - Group by (day, week, month)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalPayments": 150,
      "totalVolume": 25000,
      "successRate": 95.2,
      "averageAmount": 166.67,
      "currency": "AUD"
    },
    "timeline": [
      {
        "date": "2024-01-01",
        "payments": 5,
        "volume": 850,
        "successRate": 100
      }
    ],
    "topRoutes": [
      {
        "provider": "noones",
        "payments": 60,
        "volume": 10000,
        "successRate": 96.7
      }
    ],
    "period": "30d",
    "groupBy": "day",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Payments

#### Create Payment

```
POST /api/v1/payments
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Request Body:**
```json
{
  "amount": 100,
  "currency": "AUD",
  "cryptoCurrency": "USDT",
  "customer": {
    "email": "customer@example.com",
    "phone": "+61412345678"
  },
  "metadata": {
    "orderId": "order_123",
    "productName": "Premium NFT"
  },
  "returnUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "pay_abc123456789",
      "status": "created",
      "amount": 100,
      "currency": "AUD",
      "cryptoCurrency": "USDT",
      "route": {
        "provider": "noones",
        "type": "scraping"
      },
      "customer": {
        "email": "customer@example.com",
        "phone": "+61412345678"
      },
      "metadata": {
        "orderId": "order_123",
        "productName": "Premium NFT"
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "paymentInstructions": {
      "method": "bank_transfer",
      "details": {
        "provider": "noones",
        "bankName": "Commonwealth Bank",
        "bsb": "123-456",
        "accountNumber": "12345678",
        "accountName": "Crypto Gateway Pty Ltd",
        "reference": "PAYABC123456789"
      },
      "reference": "PAYABC123456789",
      "amount": 100,
      "currency": "AUD",
      "expiresAt": "2024-01-01T00:15:00.000Z",
      "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAYABC123456789"
    }
  }
}
```

#### Get Payment

```
GET /api/v1/payments/{paymentId}
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123456789",
    "status": "completed",
    "amount": 100,
    "currency": "AUD",
    "cryptoCurrency": "USDT",
    "route": {
      "provider": "noones",
      "type": "scraping"
    },
    "customer": {
      "email": "customer@example.com",
      "phone": "+61412345678"
    },
    "metadata": {
      "orderId": "order_123",
      "productName": "Premium NFT"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:15:00.000Z",
    "settlementId": "settle_xyz789",
    "settlementStatus": "completed"
  }
}
```

#### List Payments

```
GET /api/v1/payments?page=1&limit=20&status=completed&currency=AUD
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `status` - Payment status filter
- `currency` - Currency filter
- `from` - Start date filter (ISO 8601)
- `to` - End date filter (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "pay_abc123456789",
        "status": "completed",
        "amount": 100,
        "currency": "AUD",
        "cryptoCurrency": "USDT",
        "route": {
          "provider": "noones",
          "type": "scraping"
        },
        "customer": {
          "email": "customer@example.com",
          "phone": "+61412345678"
        },
        "metadata": {
          "orderId": "order_123"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "completedAt": "2024-01-01T00:15:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

#### Refund Payment

```
POST /api/v1/payments/{paymentId}/refund
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Request Body:**
```json
{
  "amount": 50,
  "reason": "Customer requested partial refund"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refundId": "ref_abc123456789",
    "paymentId": "pay_abc123456789",
    "refundAmount": 50,
    "status": "processed",
    "reason": "Customer requested partial refund",
    "processedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Cancel Payment

```
POST /api/v1/payments/{paymentId}/cancel
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_abc123456789",
    "status": "expired",
    "cancelledAt": "2024-01-01T00:00:00.000Z",
    "reason": "Merchant initiated cancellation"
  }
}
```

### Webhooks

#### List Webhook Deliveries

```
GET /api/v1/webhooks?page=1&limit=20&status=delivered
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `status` - Delivery status filter (pending, delivered, failed)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "wh_abc123456789",
        "url": "https://example.com/webhook",
        "status": "delivered",
        "attempts": 1,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "lastAttempt": {
          "id": "att_abc123456789",
          "status": "success",
          "httpStatus": 200,
          "responseTime": 150,
          "attemptedAt": "2024-01-01T00:00:00.000Z"
        },
        "payload": {
          "id": "wh_abc123456789",
          "type": "payment.completed",
          "data": {
            "paymentId": "pay_abc123456789",
            "status": "completed",
            "amount": 100,
            "currency": "AUD"
          },
          "timestamp": "2024-01-01T00:00:00.000Z"
        }
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  }
}
```

#### Get Webhook Delivery

```
GET /api/v1/webhooks/{webhookId}
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123456789",
    "url": "https://example.com/webhook",
    "status": "delivered",
    "payload": {
      "id": "wh_abc123456789",
      "type": "payment.completed",
      "data": {
        "paymentId": "pay_abc123456789",
        "status": "completed",
        "amount": 100,
        "currency": "AUD"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "signature": "sha256=...",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "attempts": [
      {
        "id": "att_abc123456789",
        "attempt": 1,
        "status": "success",
        "httpStatus": 200,
        "responseTime": 150,
        "attemptedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Retry Webhook Delivery

```
POST /api/v1/webhooks/{webhookId}/retry
```

**Headers:**
```
X-API-Key: pk_test_your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookId": "wh_abc123456789",
    "attemptId": "att_def456789012",
    "status": "success",
    "attempt": 2,
    "message": "Webhook retry initiated"
  }
}
```

## SDKs and Libraries

### Node.js SDK

```javascript
const { CryptoGateway } = require('@crypto-gateway/node');

const gateway = new CryptoGateway({
  apiKey: 'pk_test_your_api_key',
  environment: 'test' // or 'live'
});

// Create payment
const payment = await gateway.payments.create({
  amount: 100,
  currency: 'AUD',
  customer: {
    email: 'customer@example.com'
  }
});

// Get payment
const payment = await gateway.payments.get('pay_abc123456789');

// List payments
const payments = await gateway.payments.list({
  page: 1,
  limit: 20,
  status: 'completed'
});
```

### PHP SDK

```php
use CryptoGateway\Client;

$gateway = new Client([
    'api_key' => 'pk_test_your_api_key',
    'environment' => 'test'
]);

// Create payment
$payment = $gateway->payments->create([
    'amount' => 100,
    'currency' => 'AUD',
    'customer' => [
        'email' => 'customer@example.com'
    ]
]);

// Get payment
$payment = $gateway->payments->get('pay_abc123456789');
```

### Python SDK

```python
from crypto_gateway import CryptoGateway

gateway = CryptoGateway(
    api_key='pk_test_your_api_key',
    environment='test'
)

# Create payment
payment = gateway.payments.create(
    amount=100,
    currency='AUD',
    customer={'email': 'customer@example.com'}
)

# Get payment
payment = gateway.payments.get('pay_abc123456789')
```

## Testing

### Test API Keys

Use test API keys for development:
- API Key: `pk_test_123`
- API Secret: `sk_test_456`

### Test Webhook URLs

For webhook testing, use services like:
- [Webhook.site](https://webhook.site)
- [ngrok](https://ngrok.com)
- [RequestBin](https://requestbin.com)

### Test Payment Scenarios

- **Successful Payment:** Use amount `100` with currency `AUD`
- **Failed Payment:** Use amount `1` with currency `AUD`
- **Expired Payment:** Use amount `50` with currency `AUD`

## Support

### Documentation

- **API Documentation:** `/api-docs` (Swagger UI)
- **OpenAPI Spec:** `/api-docs.json`

### Contact

- **Email:** support@crypto-gateway.com
- **Documentation:** https://docs.crypto-gateway.com
- **Status Page:** https://status.crypto-gateway.com

### Rate Limits

If you need higher rate limits, contact support with your use case.

### Custom Integrations

For custom integrations or enterprise features, contact our sales team.

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Payment processing endpoints
- Merchant management
- Webhook delivery system
- OpenAPI documentation
- Multi-route payment support
- Instant merchant approval
- No-KYC payment processing