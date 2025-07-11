import { P2PRouteBase } from './P2PRouteBase';
import { Payment, P2PTrade, TradeStatus } from '../../core/types';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface NoonesConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

interface NoonesTradeResponse {
  trade_id: string;
  status: string;
  amount: number;
  currency: string;
  crypto_amount: number;
  crypto_currency: string;
  payment_method: string;
  payment_details: any;
  reference: string;
  expires_at: string;
  escrow_address?: string;
  seller: {
    username: string;
    rating: number;
    trades_count: number;
  };
}

export class NoonesHandler extends P2PRouteBase {
  protected provider = 'noones';
  private apiKey: string;
  private apiSecret: string;
  private client: AxiosInstance;
  
  constructor(config: NoonesConfig) {
    super();
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.noones.com/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add request interceptor for authentication
    this.client.interceptors.request.use((request) => {
      const timestamp = Date.now().toString();
      const nonce = crypto.randomBytes(16).toString('hex');
      
      // Create signature
      const message = `${timestamp}${nonce}${request.method}${request.url}${JSON.stringify(request.data || {})}`;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(message)
        .digest('hex');
      
      // Add auth headers
      request.headers['X-API-KEY'] = this.apiKey;
      request.headers['X-API-SIGNATURE'] = signature;
      request.headers['X-API-TIMESTAMP'] = timestamp;
      request.headers['X-API-NONCE'] = nonce;
      
      return request;
    });
  }
  
  async createTrade(payment: Payment): Promise<P2PTrade> {
    try {
      // Find suitable offers first
      const offers = await this.findOffers(payment);
      
      if (offers.length === 0) {
        throw new Error('No suitable P2P offers available');
      }
      
      // Select best offer (first one for now)
      const selectedOffer = offers[0];
      
      // Create trade with selected offer
      const response = await this.client.post<NoonesTradeResponse>('/trades/create', {
        offer_id: selectedOffer.id,
        type: 'buy',
        amount: payment.amount,
        currency: payment.currency,
        crypto_currency: payment.cryptoCurrency,
        payment_method: this.getPaymentMethod(payment)
      });
      
      const trade = this.mapToP2PTrade(response.data);
      this.logTradeEvent('created', trade);
      
      return trade;
      
    } catch (error) {
      throw this.handleTradeError(error, 'create trade');
    }
  }
  
  async monitorTrade(tradeId: string): Promise<TradeStatus> {
    try {
      const response = await this.client.get<NoonesTradeResponse>(`/trades/${tradeId}`);
      const status = this.mapTradeStatus(response.data.status);
      
      this.logTradeEvent('status_check', { id: tradeId, status } as P2PTrade, {
        noonesStatus: response.data.status
      });
      
      return status;
      
    } catch (error) {
      throw this.handleTradeError(error, 'monitor trade');
    }
  }
  
  async releaseFunds(tradeId: string): Promise<boolean> {
    try {
      // Check if trade is in correct status
      const trade = await this.getTradeDetails(tradeId);
      
      if (trade.status !== TradeStatus.ESCROW_LOCKED) {
        throw new Error('Trade not in escrow locked status');
      }
      
      // Release funds
      await this.client.post(`/trades/${tradeId}/release`);
      
      this.logTradeEvent('funds_released', trade);
      return true;
      
    } catch (error) {
      throw this.handleTradeError(error, 'release funds');
    }
  }
  
  async cancelTrade(tradeId: string): Promise<boolean> {
    try {
      await this.client.post(`/trades/${tradeId}/cancel`);
      
      this.logTradeEvent('cancelled', { id: tradeId } as P2PTrade);
      return true;
      
    } catch (error) {
      throw this.handleTradeError(error, 'cancel trade');
    }
  }
  
  async getTradeDetails(tradeId: string): Promise<P2PTrade> {
    try {
      const response = await this.client.get<NoonesTradeResponse>(`/trades/${tradeId}`);
      return this.mapToP2PTrade(response.data);
      
    } catch (error) {
      throw this.handleTradeError(error, 'get trade details');
    }
  }
  
  private async findOffers(payment: Payment): Promise<any[]> {
    try {
      const response = await this.client.get('/offers/search', {
        params: {
          type: 'sell', // We want to buy crypto
          amount: payment.amount,
          currency: payment.currency,
          crypto_currency: payment.cryptoCurrency,
          payment_method: this.getPaymentMethod(payment),
          country: payment.metadata?.country || 'AU'
        }
      });
      
      // Filter offers by criteria
      return response.data.offers.filter((offer: any) => {
        return offer.min_amount <= payment.amount && 
               offer.max_amount >= payment.amount &&
               offer.is_online === true;
      });
      
    } catch (error) {
      throw this.handleTradeError(error, 'find offers');
    }
  }
  
  private getPaymentMethod(payment: Payment): string {
    // Map payment method based on currency and metadata
    if (payment.currency === 'AUD') {
      if (payment.metadata?.preferredPaymentMethod === 'payid') {
        return 'payid';
      }
      return 'bank_transfer_australia';
    }
    
    if (payment.currency === 'USD') {
      return 'bank_transfer_usa';
    }
    
    return 'bank_transfer';
  }
  
  private mapToP2PTrade(apiResponse: NoonesTradeResponse): P2PTrade {
    return {
      id: apiResponse.trade_id,
      provider: this.provider,
      status: this.mapTradeStatus(apiResponse.status),
      amount: apiResponse.amount,
      currency: apiResponse.currency,
      cryptoAmount: apiResponse.crypto_amount,
      cryptoCurrency: apiResponse.crypto_currency,
      paymentMethod: apiResponse.payment_method,
      paymentDetails: this.formatPaymentDetails(apiResponse.payment_details),
      referenceCode: this.formatReference(apiResponse.reference),
      expiresAt: new Date(apiResponse.expires_at),
      escrowAddress: apiResponse.escrow_address,
      sellerInfo: apiResponse.seller ? {
        username: apiResponse.seller.username,
        rating: apiResponse.seller.rating,
        completedTrades: apiResponse.seller.trades_count
      } : undefined
    };
  }
  
  private mapTradeStatus(noonesStatus: string): TradeStatus {
    const statusMap: Record<string, TradeStatus> = {
      'created': TradeStatus.CREATED,
      'payment_pending': TradeStatus.PAYMENT_PENDING,
      'payment_received': TradeStatus.PAYMENT_RECEIVED,
      'escrow_locked': TradeStatus.ESCROW_LOCKED,
      'completed': TradeStatus.RELEASED,
      'cancelled': TradeStatus.CANCELLED,
      'disputed': TradeStatus.DISPUTED
    };
    
    return statusMap[noonesStatus.toLowerCase()] || TradeStatus.CREATED;
  }
  
  private formatPaymentDetails(details: any): any {
    // Format payment details for Australian bank transfers
    if (details.payment_method === 'bank_transfer_australia' || 
        details.payment_method === 'payid') {
      return {
        bank_name: details.bank_name || 'Commonwealth Bank',
        bsb: details.bsb,
        account_number: details.account_number,
        account_name: details.account_name,
        payid: details.payid,
        reference_required: true
      };
    }
    
    return details;
  }
}