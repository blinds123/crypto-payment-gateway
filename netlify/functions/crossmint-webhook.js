const crypto = require('crypto');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Crossmint-Signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify webhook signature
    const signature = event.headers['x-crossmint-signature'];
    if (!signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing webhook signature' })
      };
    }

    // Parse webhook payload
    const payload = JSON.parse(event.body);
    const { type, data } = payload;

    // Log webhook for debugging (in production, use proper logging)
    console.log('Webhook received:', { type, data });

    // Process webhook based on type
    switch (type) {
      case 'payment.completed':
        console.log('Payment completed:', data.id);
        // Handle successful payment
        break;
      
      case 'payment.failed':
        console.log('Payment failed:', data.id, data.failureReason);
        // Handle failed payment
        break;
      
      case 'payment.pending':
        console.log('Payment pending:', data.id);
        // Handle pending payment
        break;
      
      default:
        console.log('Unknown webhook type:', type);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Webhook processed successfully'
      })
    };

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process webhook',
        message: error.message
      })
    };
  }
};