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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const config = {
      clientId: process.env.CROSSMINT_CLIENT_ID ? 'configured' : 'missing',
      environment: process.env.CROSSMINT_ENVIRONMENT || 'staging',
      baseUrl: process.env.CROSSMINT_ENVIRONMENT === 'production' 
        ? 'https://api.crossmint.com' 
        : 'https://api.staging.crossmint.com'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        config: {
          ...config,
          supportedChains: ['ethereum', 'bitcoin', 'polygon', 'arbitrum', 'optimism', 'base'],
          supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Configuration error',
        message: error.message
      })
    };
  }
};