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

    // Generate proper wallet address format by chain
    const walletAddress = '0xE5173e7c3089bD89cd1341b637b8e1951745ED5C'; // Polygon wallet

    // FIXED: Required Crossmint parameters
    const projectId = 'eeb0c5f5-6ce6-46ff-b0b3-c237d2172a61';
    const clientId = 'ck_production_ABEjX378KrXNmt4oAnUpUwubzh56u9ra2Wd5U5hMp3kysx5SmiYAP4EywJ5p1aPpsvrzjrkoxF4mEFxLXDyAshWUfpKcx34j8yZjbj2yzMoNbDMYPRUZro1ZKRBWdj6WhJDr5YRyKdXYgFJLL7GfKG5cu5y1fL2WHsJpw4GwzqkYVnVyBgmi9oK5QkH3FnGsMNgpkAbcmPY8rpmx3ZAPjJQ9';
    
    // CRITICAL FIX: Build checkout URL with BOTH projectId AND clientId
    const checkoutParams = new URLSearchParams({
      clientId: clientId,           // ✅ REQUIRED: clientId parameter
      projectId: projectId,         // ✅ REQUIRED: projectId parameter  
      amount: amount.toString(),
      currency: 'usdc',
      recipientAddress: walletAddress,
      email: customerEmail || '',
      successCallbackUrl: `https://fancy-daffodil-59b9a6.netlify.app/success?amount=${amount}&network=${chain}`,
      failureCallbackUrl: `https://fancy-daffodil-59b9a6.netlify.app/checkout?error=payment_failed`
    });

    // Create proper Crossmint checkout URL
    const checkoutUrl = `https://www.crossmint.com/checkout?${checkoutParams.toString()}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: checkoutUrl,
        walletAddress,
        chain,
        amount,
        currency: 'usdc',
        debug: {
          hasClientId: true,
          hasProjectId: true,
          fixApplied: 'FIXED-VERSION',
          timestamp: new Date().toISOString(),
          function: 'payment-fixed'
        }
      })
    };

  } catch (error) {
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