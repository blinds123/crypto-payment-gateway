#!/usr/bin/env node

/**
 * Live Transaction Testing Script
 * Tests the complete payment flow in production
 */

const axios = require('axios');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_AMOUNT = process.env.TEST_AMOUNT || 1.00; // Start with $1 test

// Test data
const TEST_CARDS = {
  success: {
    number: '4242424242424242',
    exp: '12/25',
    cvv: '123',
    description: 'Successful payment'
  },
  declined: {
    number: '4000000000000002',
    exp: '12/25',
    cvv: '123',
    description: 'Card declined'
  },
  insufficient: {
    number: '4000000000009995',
    exp: '12/25',
    cvv: '123',
    description: 'Insufficient funds'
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

// Helper functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const prompt = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test functions
async function checkHealth() {
  log('\n🏥 Checking application health...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.status === 'ok') {
      log('✅ Health check passed', 'green');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Health check error: ${error.message}`, 'red');
    return false;
  }
}

async function checkCrossmintConfig() {
  log('\n🔧 Checking Crossmint configuration...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/crossmint/config`);
    if (response.data.success && response.data.config) {
      log('✅ Crossmint configured properly', 'green');
      log(`   Environment: ${response.data.config.environment}`, 'yellow');
      log(`   Client ID: ${response.data.config.clientId}`, 'yellow');
      return true;
    } else {
      log('❌ Crossmint configuration issue', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Configuration check error: ${error.message}`, 'red');
    return false;
  }
}

async function createPaymentSession(amount, currency, chain) {
  log('\n💳 Creating payment session...', 'blue');
  
  const payload = {
    amount: parseFloat(amount),
    currency: currency.toUpperCase(),
    chain: chain.toLowerCase(),
    customerEmail: `test-${Date.now()}@example.com`
  };
  
  try {
    const response = await axios.post(`${BASE_URL}/api/crossmint/payment`, payload);
    
    if (response.data.success && response.data.session) {
      log('✅ Payment session created', 'green');
      log(`   Session ID: ${response.data.session.id}`, 'yellow');
      log(`   Amount: ${response.data.session.amount} ${response.data.session.currency}`, 'yellow');
      log(`   Wallet: ${response.data.session.walletAddress}`, 'yellow');
      log(`   Checkout URL: ${response.data.session.url}`, 'yellow');
      return response.data.session;
    } else {
      log('❌ Failed to create payment session', 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Payment session error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

async function checkPaymentStatus(sessionId) {
  log('\n🔍 Checking payment status...', 'blue');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/crossmint/payment/${sessionId}`);
    
    if (response.data.success && response.data.payment) {
      const status = response.data.payment.status;
      const color = status === 'completed' ? 'green' : status === 'failed' ? 'red' : 'yellow';
      log(`   Status: ${status}`, color);
      
      if (response.data.payment.transactionHash) {
        log(`   Transaction: ${response.data.payment.transactionHash}`, 'yellow');
      }
      
      return response.data.payment;
    } else {
      log('❌ Failed to get payment status', 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Status check error: ${error.response?.data?.message || error.message}`, 'red');
    return null;
  }
}

async function monitorPayment(sessionId, maxAttempts = 20) {
  log('\n⏳ Monitoring payment progress...', 'blue');
  
  for (let i = 0; i < maxAttempts; i++) {
    const payment = await checkPaymentStatus(sessionId);
    
    if (payment) {
      if (payment.status === 'completed') {
        log('✅ Payment completed successfully!', 'green');
        return payment;
      } else if (payment.status === 'failed') {
        log('❌ Payment failed', 'red');
        if (payment.failureReason) {
          log(`   Reason: ${payment.failureReason}`, 'red');
        }
        return payment;
      }
    }
    
    // Wait 3 seconds before next check
    process.stdout.write('.');
    await delay(3000);
  }
  
  log('\n⏱️  Payment monitoring timeout', 'yellow');
  return null;
}

async function runFullTest() {
  log('\n🚀 Starting Live Transaction Test', 'green');
  log('=' .repeat(50), 'blue');
  
  // Step 1: Health checks
  const healthOk = await checkHealth();
  if (!healthOk) {
    log('\n❌ Application health check failed. Aborting test.', 'red');
    return;
  }
  
  const configOk = await checkCrossmintConfig();
  if (!configOk) {
    log('\n❌ Crossmint configuration check failed. Aborting test.', 'red');
    return;
  }
  
  // Step 2: Get test parameters
  log('\n📝 Test Configuration', 'blue');
  const amount = await prompt(`Enter test amount (default: $${TEST_AMOUNT}): `) || TEST_AMOUNT;
  const currency = await prompt('Enter currency (default: USD): ') || 'USD';
  const chain = await prompt('Enter blockchain (default: ethereum): ') || 'ethereum';
  
  // Step 3: Create payment session
  const session = await createPaymentSession(amount, currency, chain);
  if (!session) {
    log('\n❌ Failed to create payment session. Aborting test.', 'red');
    return;
  }
  
  // Step 4: Prompt for manual payment
  log('\n💳 Manual Payment Required', 'yellow');
  log('=' .repeat(50), 'blue');
  log('Please complete the payment manually:', 'yellow');
  log(`1. Open: ${session.url}`, 'blue');
  log('2. Complete the payment with a test card', 'blue');
  log('3. This script will monitor the payment status', 'blue');
  log('\nTest card numbers:', 'yellow');
  log('  Success: 4242 4242 4242 4242', 'green');
  log('  Decline: 4000 0000 0000 0002', 'red');
  log('=' .repeat(50), 'blue');
  
  await prompt('\nPress Enter when you have initiated the payment...');
  
  // Step 5: Monitor payment
  const result = await monitorPayment(session.id);
  
  // Step 6: Summary
  log('\n📊 Test Summary', 'blue');
  log('=' .repeat(50), 'blue');
  log(`Session ID: ${session.id}`, 'yellow');
  log(`Amount: ${amount} ${currency}`, 'yellow');
  log(`Blockchain: ${chain}`, 'yellow');
  log(`Wallet Address: ${session.walletAddress}`, 'yellow');
  
  if (result) {
    if (result.status === 'completed') {
      log(`\n✅ TEST PASSED - Payment completed successfully`, 'green');
      log(`Transaction Hash: ${result.transactionHash}`, 'green');
      log(`\n🎉 The crypto payment gateway is working correctly!`, 'green');
    } else {
      log(`\n❌ TEST FAILED - Payment was not completed`, 'red');
      log(`Final Status: ${result.status}`, 'red');
      if (result.failureReason) {
        log(`Failure Reason: ${result.failureReason}`, 'red');
      }
    }
  } else {
    log(`\n⚠️  TEST INCOMPLETE - Payment status unknown`, 'yellow');
  }
  
  log('=' .repeat(50), 'blue');
}

async function runQuickTest() {
  log('\n⚡ Running Quick Test', 'blue');
  
  const healthOk = await checkHealth();
  const configOk = await checkCrossmintConfig();
  
  if (healthOk && configOk) {
    log('\n✅ Quick test passed - System is operational', 'green');
  } else {
    log('\n❌ Quick test failed - System issues detected', 'red');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  
  log('🏦 Crypto Payment Gateway - Live Transaction Tester', 'blue');
  
  try {
    if (mode === '--quick' || mode === '-q') {
      await runQuickTest();
    } else {
      await runFullTest();
    }
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
  }
  
  log('\n👋 Test completed', 'blue');
}

// Run the test
main().catch(console.error);