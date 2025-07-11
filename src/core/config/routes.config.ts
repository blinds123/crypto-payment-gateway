import { RouteConfig } from '../types/Route';

interface RoutesConfig {
  blockchain: Record<string, RouteConfig>;
  dex: Record<string, RouteConfig>;
  scraping: Record<string, RouteConfig>;
  selfhosted: Record<string, RouteConfig>;
}

export const routesConfig: RoutesConfig = {
  blockchain: {
    bitcoin: {
      enabled: true,
      priority: 1,
      limits: {
        minAmount: 10,
        maxAmount: 100000,
        dailyVolume: 1000000,
        monthlyVolume: 10000000
      },
      fees: {
        percentage: 0.1, // Network fees only
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'], // All via conversion
        cryptoCurrencies: ['BTC'],
        paymentMethods: ['blockchain'],
        countries: ['*'], // Global
        features: ['direct_blockchain', 'no_kyc', 'self_custody']
      }
    },
    ethereum: {
      enabled: true,
      priority: 2,
      limits: {
        minAmount: 5,
        maxAmount: 100000,
        dailyVolume: 1000000,
        monthlyVolume: 10000000
      },
      fees: {
        percentage: 0.1,
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'],
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'DAI'],
        paymentMethods: ['blockchain'],
        countries: ['*'],
        features: ['smart_contracts', 'erc20_tokens', 'no_kyc']
      }
    },
    polygon: {
      enabled: true,
      priority: 3,
      limits: {
        minAmount: 1,
        maxAmount: 50000,
        dailyVolume: 500000,
        monthlyVolume: 5000000
      },
      fees: {
        percentage: 0.05, // Lower fees on Polygon
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'],
        cryptoCurrencies: ['MATIC', 'USDT', 'USDC'],
        paymentMethods: ['blockchain'],
        countries: ['*'],
        features: ['low_fees', 'fast_confirmation', 'ethereum_compatible']
      }
    }
  },
  dex: {
    uniswap: {
      enabled: true,
      priority: 1,
      limits: {
        minAmount: 10,
        maxAmount: 100000,
        dailyVolume: 2000000,
        monthlyVolume: 20000000
      },
      fees: {
        percentage: 0.3, // Standard Uniswap fee
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['USD', 'EUR'], // Via stablecoin conversion
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'DAI', 'WBTC'],
        paymentMethods: ['dex_swap'],
        countries: ['*'],
        features: ['public_api', 'no_kyc', 'decentralized', 'subgraph_data']
      }
    },
    pancakeswap: {
      enabled: true,
      priority: 2,
      limits: {
        minAmount: 5,
        maxAmount: 50000,
        dailyVolume: 1000000,
        monthlyVolume: 10000000
      },
      fees: {
        percentage: 0.25, // PancakeSwap fee
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['USD', 'EUR'],
        cryptoCurrencies: ['BNB', 'BUSD', 'USDT', 'CAKE'],
        paymentMethods: ['dex_swap'],
        countries: ['*'],
        features: ['bsc_network', 'low_fees', 'public_api', 'no_kyc']
      }
    },
    sushiswap: {
      enabled: true,
      priority: 3,
      limits: {
        minAmount: 10,
        maxAmount: 75000,
        dailyVolume: 1500000,
        monthlyVolume: 15000000
      },
      fees: {
        percentage: 0.3,
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['USD', 'EUR'],
        cryptoCurrencies: ['ETH', 'SUSHI', 'USDT', 'USDC'],
        paymentMethods: ['dex_swap'],
        countries: ['*'],
        features: ['multi_chain', 'public_subgraph', 'no_kyc']
      }
    }
  },
  scraping: {
    coingecko: {
      enabled: true,
      priority: 1,
      limits: {
        minAmount: 1,
        maxAmount: 1000000,
        dailyVolume: 10000000,
        monthlyVolume: 100000000
      },
      fees: {
        percentage: 0, // No fees for price data
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'], // All supported currencies
        cryptoCurrencies: ['*'], // All supported cryptos
        paymentMethods: ['price_oracle'],
        countries: ['*'],
        features: ['public_api', 'no_signup', 'rate_limited_30_per_min']
      }
    },
    localbitcoins_scraper: {
      enabled: true,
      priority: 2,
      limits: {
        minAmount: 20,
        maxAmount: 10000,
        dailyVolume: 100000,
        monthlyVolume: 1000000
      },
      fees: {
        percentage: 1.0, // Estimated spread
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['USD', 'EUR', 'AUD', 'GBP'],
        cryptoCurrencies: ['BTC'],
        paymentMethods: ['p2p_board_scraping'],
        countries: ['AU', 'US', 'GB', 'EU'],
        features: ['public_scraping', 'p2p_rates', 'no_kyc_required']
      }
    },
    exchange_rates: {
      enabled: true,
      priority: 3,
      limits: {
        minAmount: 0.01,
        maxAmount: 1000000,
        dailyVolume: 100000000,
        monthlyVolume: 1000000000
      },
      fees: {
        percentage: 0,
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'],
        cryptoCurrencies: ['*'],
        paymentMethods: ['rate_conversion'],
        countries: ['*'],
        features: ['real_time_rates', 'public_access', 'multiple_sources']
      }
    }
  },
  selfhosted: {
    btcpay: {
      enabled: true,
      priority: 1,
      limits: {
        minAmount: 1,
        maxAmount: 1000000,
        dailyVolume: 10000000,
        monthlyVolume: 100000000
      },
      fees: {
        percentage: 0, // Self-hosted = no fees
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'],
        cryptoCurrencies: ['BTC', 'LTC', 'ETH', 'XMR'],
        paymentMethods: ['self_hosted_gateway'],
        countries: ['*'],
        features: ['zero_fees', 'self_custody', 'open_source', 'lightning_network']
      }
    },
    direct_wallet: {
      enabled: true,
      priority: 2,
      limits: {
        minAmount: 0.01,
        maxAmount: 1000000,
        dailyVolume: 10000000,
        monthlyVolume: 100000000
      },
      fees: {
        percentage: 0,
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['*'],
        cryptoCurrencies: ['BTC', 'ETH', 'USDT', 'USDC'],
        paymentMethods: ['wallet_to_wallet'],
        countries: ['*'],
        features: ['direct_transfer', 'no_intermediary', 'self_custody']
      }
    },
    web3_integration: {
      enabled: true,
      priority: 3,
      limits: {
        minAmount: 0.1,
        maxAmount: 100000,
        dailyVolume: 1000000,
        monthlyVolume: 10000000
      },
      fees: {
        percentage: 0,
        fixed: 0,
        currency: 'USD'
      },
      capabilities: {
        currencies: ['USD', 'EUR'], // Via stablecoin conversion
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'DAI'],
        paymentMethods: ['web3_connect'],
        countries: ['*'],
        features: ['metamask_integration', 'walletconnect', 'no_kyc']
      }
    }
  }
};

// Helper function to get route config by ID
export function getRouteConfig(routeId: string): RouteConfig | null {
  const [type, provider] = routeId.split('_');
  
  switch (type) {
    case 'blockchain':
      return (routesConfig.blockchain as any)[provider] || null;
    case 'dex':
      return (routesConfig.dex as any)[provider] || null;
    case 'scraping':
      return (routesConfig.scraping as any)[provider] || null;
    case 'selfhosted':
      return (routesConfig.selfhosted as any)[provider] || null;
    default:
      return null;
  }
}

// Helper function to get all enabled routes
export function getEnabledRoutes(): string[] {
  const enabledRoutes: string[] = [];
  
  Object.entries(routesConfig).forEach(([type, providers]) => {
    Object.entries(providers).forEach(([provider, config]) => {
      if ((config as RouteConfig).enabled) {
        enabledRoutes.push(`${type}_${provider}`);
      }
    });
  });
  
  return enabledRoutes;
}

// Public API endpoints that require zero signup
export const PUBLIC_API_ENDPOINTS = {
  // Blockchain RPC endpoints (no signup required)
  bitcoin: [
    'https://bitcoin-rpc.publicnode.com',
    'https://api.blockcypher.com/v1/btc/main',
    'https://blockstream.info/api'
  ],
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://api.etherscan.io/api',
    'https://cloudflare-eth.com'
  ],
  polygon: [
    'https://polygon-rpc.publicnode.com',
    'https://rpc-mainnet.maticvigil.com',
    'https://polygon-rpc.com'
  ],
  
  // Price data APIs (no signup required)
  prices: [
    'https://api.coingecko.com/api/v3', // 30 calls/min free
    'https://min-api.cryptocompare.com/data' // Basic free access
  ],
  
  // DEX subgraph APIs (no signup required)
  uniswap: [
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2'
  ],
  pancakeswap: [
    'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange',
    'https://bsc.api.0x.org' // DEX aggregation
  ],
  
  // Mempool and network data (no signup required)
  mempool: [
    'https://mempool.space/api',
    'https://blockstream.info/api',
    'https://api.blockcypher.com'
  ]
};

// Rate limits for public APIs
export const RATE_LIMITS = {
  coingecko_demo: {
    calls_per_minute: 30,
    calls_per_month: 10000
  },
  blockchain_rpc: {
    calls_per_second: 1,
    concurrent_connections: 5
  },
  subgraph_apis: {
    calls_per_second: 10,
    max_query_complexity: 1000
  }
};