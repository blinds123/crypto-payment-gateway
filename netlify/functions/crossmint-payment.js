const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Modern Crossmint API integration v2.0
const CROSSMINT_API_BASE = 'https://www.crossmint.com/api/2022-06-09';

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

    // Enhanced validation
    if (amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid amount',
          message: 'Amount must be greater than 0'
        })
      };
    }

    // Email validation
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid email format'
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

    // FINAL SOLUTION: Use the real Project ID provided by user
    const projectId = 'eeb0c5f5-6ce6-46ff-b0b3-c237d2172a61';  // Your actual Crossmint project ID
    
    // Modern Crossmint API Configuration
    const environment = process.env.CROSSMINT_ENVIRONMENT || 'production';
    const apiKey = process.env.CROSSMINT_API_KEY;
    const clientId = process.env.CROSSMINT_CLIENT_ID;
    
    if (!apiKey || !clientId) {
      throw new Error('Missing required Crossmint credentials');
    }

    // Proper currency mapping
    const currencyMap = {
      'USD': 'usd',
      'EUR': 'eur', 
      'GBP': 'gbp',
      'CAD': 'cad',
      'AUD': 'aud'
    };
    
    const mappedCurrency = currencyMap[currency.toUpperCase()] || 'usd';
    
    // Create Crossmint checkout session via API
    console.log('Creating Crossmint checkout session...');
    
    const checkoutData = {
      payment: {
        method: 'fiat',
        currency: mappedCurrency
      },
      lineItems: [{
        collectionLocator: `crossmint:${projectId}`,
        callData: {
          totalPrice: amount.toString(),
          quantity: 1,
          recipientAddress: walletAddress
        }
      }],
      locale: 'en-US',
      successCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/success?amount=${amount}&network=${chain}`,
      failureCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/checkout?error=payment_failed`
    };

    // Add customer email if provided
    if (customerEmail) {
      checkoutData.customer = { email: customerEmail };
    }

    try {
      // Create checkout session using proper Crossmint API
      const response = await axios.post(`${CROSSMINT_API_BASE}/orders`, checkoutData, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-API-KEY': clientId
        },
        timeout: 30000
      });

      const checkoutUrl = response.data.onRamp?.url || `https://www.crossmint.com/checkout/${response.data.id}`;
      
      console.log('Crossmint session created successfully:', response.data.id);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          checkoutUrl: checkoutUrl,
          sessionId: response.data.id,
          walletAddress,
          chain,
          amount,
          currency: mappedCurrency,
          debug: {
            apiUsed: 'crossmint-api-v2022-06-09',
            projectId: projectId,
            environment: environment
          }
        })
      };
      
    } catch (crossmintError) {
      console.error('Crossmint API Error:', crossmintError.response?.data || crossmintError.message);
      
      // Fallback to manual payment if API fails
      const fallbackUrl = `/manual-payment?amount=${amount}&currency=${currency}&network=${chain}&error=api_failed`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          checkoutUrl: fallbackUrl,
          fallback: true,
          reason: 'crossmint_api_error',
          walletAddress,
          chain,
          amount,
          currency
        })
      };
    }

  } catch (error) {
    console.error('Payment creation error:', error.response?.data || error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment session',
        message: error.response?.data?.message || error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};