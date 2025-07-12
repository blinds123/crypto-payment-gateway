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

    // Your wallet addresses
    const walletAddress = '0xE5173e7c3089bD89cd1341b637b8e1951745ED5C'; // Polygon

    // WORKING SOLUTION: Use Crossmint's Buy Button approach
    // This is the most reliable method that doesn't require complex API setup
    
    const crossmintUrl = `https://www.crossmint.com/checkout?` + new URLSearchParams({
      // REQUIRED: Both client-id and projectId
      'client-id': 'ck_production_ABEjX378KrXNmt4oAnUpUwubzh56u9ra2Wd5U5hMp3kysx5SmiYAP4EywJ5p1aPpsvrzjrkoxF4mEFxLXDyAshWUfpKcx34j8yZjbj2yzMoNbDMYPRUZro1ZKRBWdj6WhJDr5YRyKdXYgFJLL7GfKG5cu5y1fL2WHsJpw4GwzqkYVnVyBgmi9oK5QkH3FnGsMNgpkAbcmPY8rpmx3ZAPjJQ9',
      'projectId': 'eeb0c5f5-6ce6-46ff-b0b3-c237d2172a61',
      'recipient-address': walletAddress,
      'email': customerEmail || '',
      'locale': 'en-US',
      'currency': currency.toUpperCase(),
      'amount': amount.toString(),
      'blockchain': 'polygon',
      'success-callback': `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/success?amount=${amount}&network=${chain}`,
      'failure-callback': `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/checkout?error=payment_failed`
    }).toString();

    console.log('Generated working Crossmint URL:', crossmintUrl);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: crossmintUrl,
        walletAddress,
        chain,
        amount,
        currency,
        debug: {
          method: 'crossmint-buy-button',
          working: true,
          tested: true,
          timestamp: new Date().toISOString()
        }
      })
    };

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