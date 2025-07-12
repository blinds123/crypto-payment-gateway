const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Parse request body
    const { amount, currency, chain, customerEmail } = JSON.parse(event.body);

    // Validate required fields
    if (!amount || !currency || !chain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: amount, currency, chain'
        })
      };
    }

    // Check for Crossmint credentials
    if (!process.env.CROSSMINT_CLIENT_ID || !process.env.CROSSMINT_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Crossmint credentials not configured',
          message: 'Please set CROSSMINT_CLIENT_ID and CROSSMINT_API_KEY environment variables'
        })
      };
    }

    // Generate wallet address (simplified for demo)
    const walletAddress = chain === 'bitcoin' 
      ? `1${Math.random().toString(36).substr(2, 33)}` // Simplified Bitcoin address
      : `0x${Math.random().toString(16).substr(2, 40)}`; // Simplified Ethereum address

    // Crossmint API configuration
    const baseUrl = process.env.CROSSMINT_ENVIRONMENT === 'production'
      ? 'https://www.crossmint.com'
      : 'https://staging.crossmint.com';

    // Create payment request
    const paymentRequest = {
      payment: {
        currency: currency.toUpperCase(),
        amount: amount.toString(),
        recipient: {
          walletAddress,
          chain: chain.toLowerCase()
        },
        metadata: {
          customerEmail,
          timestamp: new Date().toISOString(),
          source: 'netlify-crypto-gateway'
        }
      },
      successCallbackUrl: `${process.env.URL || 'https://your-site.netlify.app'}/api/crossmint/success`,
      failureCallbackUrl: `${process.env.URL || 'https://your-site.netlify.app'}/api/crossmint/failure`
    };

    // Call Crossmint API
    const response = await axios.post(
      `${baseUrl}/api/2022-06-09/checkout/sessions`,
      paymentRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CLIENT-SECRET': process.env.CROSSMINT_API_KEY,
          'X-PROJECT-ID': process.env.CROSSMINT_CLIENT_ID
        },
        timeout: 30000
      }
    );

    const session = {
      id: response.data.id,
      url: response.data.url,
      embeddedUrl: response.data.embeddedUrl,
      walletAddress,
      chain,
      amount,
      currency
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        session
      })
    };

  } catch (error) {
    console.error('Payment creation error:', error.response?.data || error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment session',
        message: error.response?.data?.message || error.message
      })
    };
  }
};