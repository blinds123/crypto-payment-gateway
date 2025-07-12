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

    // FIXED: Required Crossmint parameters
    const projectId = 'eeb0c5f5-6ce6-46ff-b0b3-c237d2172a61';
    const clientId = 'ck_production_ABEjX378KrXNmt4oAnUpUwubzh56u9ra2Wd5U5hMp3kysx5SmiYAP4EywJ5p1aPpsvrzjrkoxF4mEFxLXDyAshWUfpKcx34j8yZjbj2yzMoNbDMYPRUZro1ZKRBWdj6WhJDr5YRyKdXYgFJLL7GfKG5cu5y1fL2WHsJpw4GwzqkYVnVyBgmi9oK5QkH3FnGsMNgpkAbcmPY8rpmx3ZAPjJQ9';
    
    // Currency mapping - FIXED
    const currencyMap = {
      'USD': 'usdc',
      'EUR': 'eur', 
      'GBP': 'gbp',
      'CAD': 'cad',
      'AUD': 'aud'
    };
    
    const mappedCurrency = currencyMap[currency.toUpperCase()] || 'usdc';
    
    // CRITICAL FIX: Build checkout URL with BOTH projectId AND clientId
    const checkoutParams = new URLSearchParams({
      clientId: clientId,           // ✅ REQUIRED: clientId parameter
      projectId: projectId,         // ✅ REQUIRED: projectId parameter  
      amount: amount.toString(),
      currency: mappedCurrency,
      recipientAddress: walletAddress,
      email: customerEmail || '',
      successCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/success?amount=${amount}&network=${chain}`,
      failureCallbackUrl: `${process.env.URL || 'https://fancy-daffodil-59b9a6.netlify.app'}/checkout?error=payment_failed`
    });

    // Create proper Crossmint checkout URL
    const checkoutUrl = `https://www.crossmint.com/checkout?${checkoutParams.toString()}`;

    console.log('FIXED: Generated checkout URL with clientId:', checkoutUrl);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: checkoutUrl,
        walletAddress,
        chain,
        amount,
        currency: mappedCurrency,
        debug: {
          hasClientId: true,
          hasProjectId: true,
          fixApplied: 'v2-with-clientId',
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