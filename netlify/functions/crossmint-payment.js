const axios = require('axios');

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
      return addresses[chain.toLowerCase()] || addresses['polygon'];
    };
    
    const walletAddress = getWalletAddress(chain);

    // MODERN CROSSMINT API CONFIGURATION (2025)
    const apiKey = process.env.CROSSMINT_API_KEY || 'sk_production_ABEjX378KrXNmt4oAnUpUwubzh56u9ra2Wd5U5hMp3kysx5SmiYAP4EywJ5p1aPpsvrzjrkoxF4mEFxLXDyAshWUfpKcx34j8yZjbj2yzMoNbDMYPRUZro1ZKRBWdj6WhJDr5YRyKdXYgFJLL7GfKG5cu5y1fL2WHsJpw4GwzqkYVnVyBgmi9oK5QkH3FnGsMNgpkAbcmPY8rpmx3ZAPjJQ9';
    const projectId = 'eeb0c5f5-6ce6-46ff-b0b3-c237d2172a61';
    
    // Currency mapping
    const currencyMap = {
      'USD': 'usd',
      'EUR': 'eur', 
      'GBP': 'gbp',
      'CAD': 'cad',
      'AUD': 'aud'
    };
    
    const mappedCurrency = currencyMap[currency.toUpperCase()] || 'usd';

    // MODERN APPROACH: Create order via Crossmint API first
    console.log('Creating Crossmint order via modern API...');
    
    const orderData = {
      lineItems: [{
        collectionLocator: `crossmint:${projectId}`,
        callData: {
          totalPrice: amount.toString(),
          quantity: 1,
          recipient: walletAddress
        }
      }],
      payment: {
        method: chain.toLowerCase(), // Use the blockchain network directly
        currency: mappedCurrency
      },
      locale: 'en-US',
      successCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/success?amount=${amount}&network=${chain}`,
      failureCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/checkout?error=payment_failed`
    };

    // Add customer email if provided
    if (customerEmail) {
      orderData.customer = { email: customerEmail };
    }

    try {
      // Create order using modern Crossmint API (PRODUCTION)
      const response = await axios.post(
        'https://www.crossmint.com/api/2022-06-09/orders',
        orderData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );

      const checkoutUrl = response.data.onRamp?.url || `https://www.crossmint.com/checkout/${response.data.id}`;
      
      console.log('Crossmint order created successfully:', response.data.id);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          checkoutUrl: checkoutUrl,
          orderId: response.data.id,
          walletAddress,
          chain,
          amount,
          currency: mappedCurrency,
          debug: {
            apiUsed: 'modern-crossmint-orders-api',
            orderCreated: true,
            environment: 'production',
            timestamp: new Date().toISOString()
          }
        })
      };
      
    } catch (crossmintError) {
      console.error('Modern Crossmint API Error:', crossmintError.response?.data || crossmintError.message);
      
      // Fallback: Try alternative approach
      console.log('Trying alternative Crossmint integration...');
      
      // Alternative: Use hosted checkout URL without API
      const fallbackUrl = `https://www.crossmint.com/checkout/embed?` + new URLSearchParams({
        projectId: projectId,
        recipient: walletAddress,
        totalPrice: amount.toString(),
        currency: mappedCurrency,
        quantity: '1'
      }).toString();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          checkoutUrl: fallbackUrl,
          fallback: true,
          reason: 'api_fallback',
          walletAddress,
          chain,
          amount,
          currency: mappedCurrency,
          debug: {
            apiUsed: 'fallback-embed-method',
            originalError: crossmintError.response?.data?.message || crossmintError.message,
            timestamp: new Date().toISOString()
          }
        })
      };
    }

  } catch (error) {
    console.error('Payment creation error:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment session',
        message: error.message
      })
    };
  }
};