#!/usr/bin/env node

/**
 * Webhook Testing Script
 * Tests Crossmint webhook integration
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';

// Test webhook payloads
const TEST_WEBHOOKS = {
  payment_completed: {
    type: 'payment.completed',
    data: {
      id: 'payment_test_123',
      status: 'completed',
      amount: 10.00,
      currency: 'USD',
      recipient: {
        walletAddress: '0x742d35cc6ad...',
        chain: 'ethereum'
      },
      transactionHash: '0x1234567890abcdef...',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    }
  },
  payment_failed: {
    type: 'payment.failed',
    data: {
      id: 'payment_test_456',
      status: 'failed',
      amount: 25.00,
      currency: 'USD',
      recipient: {
        walletAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        chain: 'bitcoin'
      },
      failureReason: 'Insufficient funds',
      createdAt: new Date().toISOString()
    }
  },
  payment_pending: {
    type: 'payment.pending',
    data: {
      id: 'payment_test_789',
      status: 'pending',
      amount: 50.00,
      currency: 'USD',
      recipient: {
        walletAddress: '0x742d35cc6ad...',
        chain: 'ethereum'
      },
      createdAt: new Date().toISOString()
    }
  }
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Generate webhook signature (simulate Crossmint signing)
function generateSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

// Test webhook endpoint
async function testWebhook(webhookType, payload) {
  log(`\n🔗 Testing webhook: ${webhookType}`, 'blue');
  
  try {
    const signature = generateSignature(payload, WEBHOOK_SECRET);
    
    const response = await axios.post(
      `${BASE_URL}/api/crossmint/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Crossmint-Signature': signature
        },
        timeout: 10000
      }
    );
    
    if (response.status === 200 && response.data.success) {
      log(`✅ Webhook ${webhookType} processed successfully`, 'green');
      log(`   Response: ${response.data.message}`, 'yellow');
      return true;
    } else {
      log(`❌ Webhook ${webhookType} failed`, 'red');
      log(`   Status: ${response.status}`, 'red');
      log(`   Response: ${JSON.stringify(response.data)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Webhook ${webhookType} error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return false;
  }
}

// Test invalid signature
async function testInvalidSignature() {
  log(`\n🔒 Testing invalid signature rejection`, 'blue');
  
  try {
    const payload = TEST_WEBHOOKS.payment_completed;
    const invalidSignature = 'invalid_signature_123';
    
    const response = await axios.post(
      `${BASE_URL}/api/crossmint/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Crossmint-Signature': invalidSignature
        },
        timeout: 10000
      }
    );
    
    // Should not reach here if properly rejecting invalid signatures
    log(`❌ Invalid signature was accepted (security issue!)`, 'red');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      log(`✅ Invalid signature properly rejected`, 'green');
      return true;
    } else {
      log(`❌ Unexpected error with invalid signature: ${error.message}`, 'red');
      return false;
    }
  }
}

// Test missing signature
async function testMissingSignature() {
  log(`\n🚫 Testing missing signature rejection`, 'blue');
  
  try {
    const payload = TEST_WEBHOOKS.payment_completed;
    
    const response = await axios.post(
      `${BASE_URL}/api/crossmint/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
          // No signature header
        },
        timeout: 10000
      }
    );
    
    // Should not reach here if properly rejecting missing signatures
    log(`❌ Missing signature was accepted (security issue!)`, 'red');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      log(`✅ Missing signature properly rejected`, 'green');
      return true;
    } else {
      log(`❌ Unexpected error with missing signature: ${error.message}`, 'red');
      return false;
    }
  }
}

// Check webhook endpoint availability
async function checkWebhookEndpoint() {
  log(`\n🌐 Checking webhook endpoint availability`, 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/crossmint/webhook`, {
      timeout: 5000
    });
    
    // GET should return method not allowed
    if (response.status === 405 || response.status === 404) {
      log(`✅ Webhook endpoint available (returns ${response.status} for GET)`, 'green');
      return true;
    } else {
      log(`⚠️  Unexpected response from webhook endpoint: ${response.status}`, 'yellow');
      return true; // Still accessible
    }
  } catch (error) {
    if (error.response && (error.response.status === 405 || error.response.status === 404)) {
      log(`✅ Webhook endpoint available (returns ${error.response.status} for GET)`, 'green');
      return true;
    } else {
      log(`❌ Webhook endpoint not accessible: ${error.message}`, 'red');
      return false;
    }
  }
}

// Test webhook performance
async function testWebhookPerformance() {
  log(`\n⚡ Testing webhook performance`, 'blue');
  
  const startTime = Date.now();
  const payload = TEST_WEBHOOKS.payment_completed;
  const signature = generateSignature(payload, WEBHOOK_SECRET);
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/crossmint/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Crossmint-Signature': signature
        },
        timeout: 10000
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      if (responseTime < 1000) {
        log(`✅ Webhook performance good: ${responseTime}ms`, 'green');
      } else if (responseTime < 3000) {
        log(`⚠️  Webhook performance acceptable: ${responseTime}ms`, 'yellow');
      } else {
        log(`❌ Webhook performance poor: ${responseTime}ms`, 'red');
      }
      return responseTime;
    } else {
      log(`❌ Webhook performance test failed: HTTP ${response.status}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Webhook performance test error: ${error.message}`, 'red');
    return null;
  }
}

// Generate Crossmint webhook configuration instructions
function generateWebhookInstructions() {
  log(`\n📋 Crossmint Webhook Configuration`, 'blue');
  log('=' .repeat(60), 'blue');
  log('To configure webhooks in your Crossmint dashboard:', 'yellow');
  log('', 'reset');
  log('1. Log in to https://app.crossmint.com', 'reset');
  log('2. Navigate to Settings → Webhooks', 'reset');
  log('3. Click "Add Webhook"', 'reset');
  log('4. Enter the following details:', 'reset');
  log('', 'reset');
  log(`   Webhook URL: ${BASE_URL}/api/crossmint/webhook`, 'green');
  log('   Events to subscribe to:', 'yellow');
  log('   ✓ payment.completed', 'green');
  log('   ✓ payment.failed', 'green');
  log('   ✓ payment.pending', 'green');
  log('', 'reset');
  log('5. Save the webhook configuration', 'reset');
  log('6. Copy the webhook signing secret and update your .env file:', 'reset');
  log(`   WEBHOOK_SECRET=your_signing_secret_here`, 'green');
  log('', 'reset');
  log('=' .repeat(60), 'blue');
}

// Main test runner
async function runWebhookTests() {
  log('🔗 Crypto Payment Gateway - Webhook Tester', 'blue');
  log('=' .repeat(60), 'blue');
  
  const results = {
    endpoint: false,
    completed: false,
    failed: false,
    pending: false,
    invalidSig: false,
    missingSig: false,
    performance: null
  };
  
  try {
    // Test endpoint availability
    results.endpoint = await checkWebhookEndpoint();
    
    if (!results.endpoint) {
      log('\n❌ Webhook endpoint not available. Skipping other tests.', 'red');
      return results;
    }
    
    // Test all webhook types
    results.completed = await testWebhook('payment.completed', TEST_WEBHOOKS.payment_completed);
    results.failed = await testWebhook('payment.failed', TEST_WEBHOOKS.payment_failed);
    results.pending = await testWebhook('payment.pending', TEST_WEBHOOKS.payment_pending);
    
    // Test security
    results.invalidSig = await testInvalidSignature();
    results.missingSig = await testMissingSignature();
    
    // Test performance
    results.performance = await testWebhookPerformance();
    
    // Summary
    log('\n📊 Webhook Test Summary', 'blue');
    log('=' .repeat(60), 'blue');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length - 1; // Exclude performance
    
    log(`✅ Tests Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
    log('', 'reset');
    log(`   Endpoint Available: ${results.endpoint ? '✅' : '❌'}`, results.endpoint ? 'green' : 'red');
    log(`   Payment Completed: ${results.completed ? '✅' : '❌'}`, results.completed ? 'green' : 'red');
    log(`   Payment Failed: ${results.failed ? '✅' : '❌'}`, results.failed ? 'green' : 'red');
    log(`   Payment Pending: ${results.pending ? '✅' : '❌'}`, results.pending ? 'green' : 'red');
    log(`   Security (Invalid): ${results.invalidSig ? '✅' : '❌'}`, results.invalidSig ? 'green' : 'red');
    log(`   Security (Missing): ${results.missingSig ? '✅' : '❌'}`, results.missingSig ? 'green' : 'red');
    
    if (results.performance !== null) {
      log(`   Performance: ${results.performance}ms`, results.performance < 1000 ? 'green' : 'yellow');
    }
    
    if (passed === total) {
      log('\n🎉 All webhook tests passed!', 'green');
      log('Your webhook integration is working correctly.', 'green');
    } else {
      log('\n⚠️  Some webhook tests failed.', 'yellow');
      log('Please review the errors above and fix any issues.', 'yellow');
    }
    
    // Show configuration instructions
    generateWebhookInstructions();
    
  } catch (error) {
    log(`\n❌ Unexpected error during webhook testing: ${error.message}`, 'red');
    console.error(error);
  }
  
  return results;
}

// Quick webhook test
async function runQuickTest() {
  log('\n⚡ Running Quick Webhook Test', 'blue');
  
  const endpointOk = await checkWebhookEndpoint();
  const testOk = await testWebhook('payment.completed', TEST_WEBHOOKS.payment_completed);
  
  if (endpointOk && testOk) {
    log('\n✅ Quick webhook test passed', 'green');
  } else {
    log('\n❌ Quick webhook test failed', 'red');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  
  try {
    if (mode === '--quick' || mode === '-q') {
      await runQuickTest();
    } else if (mode === '--config' || mode === '-c') {
      generateWebhookInstructions();
    } else {
      await runWebhookTests();
    }
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
  }
  
  log('\n👋 Webhook testing completed', 'blue');
}

// Run the tests
main().catch(console.error);