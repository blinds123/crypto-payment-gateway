const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Map user-friendly chain names to Crossmint payment methods
function getPaymentMethod(chain) {
  const methodMap = {
    'ethereum': 'ethereum',
    'bitcoin': 'bsc',
    'polygon': 'polygon',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'base': 'base'
  };
  return methodMap[chain.toLowerCase()] || 'ethereum';
}

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

    // Generate proper wallet address format by chain
    const getWalletAddress = (chain) => {
      const addresses = {
        'bitcoin': `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`,
        'ethereum': `0x742d35Cc6634C0532925a3b8D46C0Ac63e8c38B6`, 
        'polygon': `0xE5173e7c3089bD89cd1341b637b8e1951745ED5C`,
        'arbitrum': `0x742d35Cc6634C0532925a3b8D46C0Ac63e8c38B6`,
        'optimism': `0x742d35Cc6634C0532925a3b8D46C0Ac63e8c38B6`,
        'base': `0x742d35Cc6634C0532925a3b8D46C0Ac63e8c38B6`
      };
      return addresses[chain.toLowerCase()] || addresses['ethereum'];
    };
    
    const walletAddress = getWalletAddress(chain);

    // Crossmint API configuration
    const baseUrl = process.env.CROSSMINT_ENVIRONMENT === 'production'
      ? 'https://www.crossmint.com'
      : 'https://staging.crossmint.com';

    // Create embedded checkout session (Production-ready approach)
    const checkoutRequest = {
      type: 'payment',
      totalPrice: amount.toString(),
      currency: currency.toUpperCase() === 'USD' ? 'usdc' : 'eth',
      recipient: {
        walletAddress
      },
      metadata: {
        customerEmail: customerEmail || 'customer@example.com',
        chain: chain.toLowerCase(),
        amount: amount.toString(),
        timestamp: new Date().toISOString(),
        source: 'crypto-payment-gateway'
      },
      successCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/success`,
      failureCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/checkout?error=payment_failed`
    };

    // Call Crossmint Embedded Checkout API
    const response = await axios.post(
      `${baseUrl}/api/2022-06-09/checkout/sessions`,
      checkoutRequest,
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