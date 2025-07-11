import { Payment, PaymentInstructions } from '../../core/types';
import { logger } from '../../utils/logger';

export interface BlockchainTransaction {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  networkFee: string;
  blockHeight?: number;
}

export interface WalletAddress {
  address: string;
  privateKey?: string;
  publicKey?: string;
  derivationPath?: string;
}

export abstract class BlockchainBase {
  protected abstract network: string;
  protected abstract rpcEndpoints: string[];
  
  /**
   * Generate a new wallet address for receiving payments
   */
  abstract generateAddress(): Promise<WalletAddress>;
  
  /**
   * Monitor address for incoming transactions
   */
  abstract monitorAddress(address: string, expectedAmount: number): Promise<BlockchainTransaction | null>;
  
  /**
   * Send cryptocurrency to destination address
   */
  abstract sendTransaction(
    from: WalletAddress,
    to: string,
    amount: string,
    options?: any
  ): Promise<BlockchainTransaction>;
  
  /**
   * Get current network fee estimate
   */
  abstract estimateFee(amount: string, priority: 'low' | 'medium' | 'high'): Promise<string>;
  
  /**
   * Get transaction by hash
   */
  abstract getTransaction(txHash: string): Promise<BlockchainTransaction | null>;
  
  /**
   * Get address balance
   */
  abstract getBalance(address: string): Promise<string>;
  
  /**
   * Convert fiat to crypto amount using public price APIs
   */
  async convertFiatToCrypto(fiatAmount: number, fiatCurrency: string, cryptoCurrency: string): Promise<number> {
    try {
      // Use CoinGecko public API (30 calls/min, no signup)
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${this.getCoinGeckoId(cryptoCurrency)}&vs_currencies=${fiatCurrency.toLowerCase()}`
      );
      
      const data = await response.json() as Record<string, Record<string, number>>;
      const coinId = this.getCoinGeckoId(cryptoCurrency);
      const rate = data[coinId]?.[fiatCurrency.toLowerCase()];
      
      if (!rate) {
        throw new Error(`Unable to get ${cryptoCurrency}/${fiatCurrency} rate`);
      }
      
      return fiatAmount / rate;
      
    } catch (error) {
      logger.error('Failed to convert fiat to crypto', {
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }
  
  /**
   * Generate payment instructions for blockchain payment
   */
  protected generatePaymentInstructions(
    payment: Payment,
    address: WalletAddress,
    cryptoAmount: number
  ): PaymentInstructions {
    return {
      method: 'blockchain_transfer',
      details: {
        network: this.network,
        address: address.address,
        amount: cryptoAmount,
        currency: payment.cryptoCurrency,
        memo: `Payment ${payment.id}`,
        qrCode: this.generateQRCode(address.address, cryptoAmount, payment.cryptoCurrency)
      },
      reference: payment.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      amount: payment.amount,
      currency: payment.currency
    };
  }
  
  /**
   * Generate QR code for crypto payment
   */
  protected generateQRCode(address: string, amount: number, currency: string): string {
    // Generate blockchain-specific URI format
    switch (currency.toUpperCase()) {
      case 'BTC':
        return `bitcoin:${address}?amount=${amount}`;
      case 'ETH':
        return `ethereum:${address}?value=${amount}`;
      case 'USDT':
      case 'USDC':
        return `ethereum:${address}?value=${amount}&symbol=${currency}`;
      default:
        return `${currency.toLowerCase()}:${address}?amount=${amount}`;
    }
  }
  
  /**
   * Map cryptocurrency symbol to CoinGecko ID
   */
  protected getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'DAI': 'dai',
      'MATIC': 'matic-network',
      'BNB': 'binancecoin',
      'LTC': 'litecoin'
    };
    
    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }
  
  /**
   * Handle RPC endpoint failover
   */
  protected async callRPC(method: string, params: any[], timeout: number = 30000): Promise<any> {
    const errors: Error[] = [];
    
    for (const endpoint of this.rpcEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now()
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json() as { error?: { message: string }; result?: any };
        
        if (result.error) {
          throw new Error(result.error.message || 'RPC Error');
        }
        
        return result.result;
        
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        logger.warn(`RPC endpoint failed: ${endpoint}`, {
          method,
          error: error instanceof Error ? error.message : error
        });
      }
    }
    
    throw new Error(`All RPC endpoints failed. Last error: ${errors[errors.length - 1]?.message}`);
  }
  
  /**
   * Log blockchain operation
   */
  protected logOperation(operation: string, data: any): void {
    logger.info(`Blockchain Operation: ${operation}`, {
      network: this.network,
      operation,
      ...data
    });
  }
  
  /**
   * Handle blockchain errors
   */
  protected handleError(error: any, context: string): Error {
    logger.error(`Blockchain Error: ${context}`, {
      network: this.network,
      error: error.message || error,
      stack: error.stack,
      context
    });
    
    // Return user-friendly error
    if (error.message?.includes('insufficient funds')) {
      return new Error('Insufficient funds for transaction');
    }
    if (error.message?.includes('gas')) {
      return new Error('Network congestion - please try again');
    }
    if (error.message?.includes('nonce')) {
      return new Error('Transaction ordering issue - please retry');
    }
    
    return new Error(`Blockchain operation failed: ${context}`);
  }
}