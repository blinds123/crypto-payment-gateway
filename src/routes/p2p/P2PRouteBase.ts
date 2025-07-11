import { Payment, P2PTrade, TradeStatus, PaymentInstructions } from '../../core/types';
import { logger } from '../../utils/logger';

export abstract class P2PRouteBase {
  protected abstract provider: string;
  
  /**
   * Create a P2P trade for the payment
   */
  abstract createTrade(payment: Payment): Promise<P2PTrade>;
  
  /**
   * Monitor trade status
   */
  abstract monitorTrade(tradeId: string): Promise<TradeStatus>;
  
  /**
   * Release escrowed funds
   */
  abstract releaseFunds(tradeId: string): Promise<boolean>;
  
  /**
   * Cancel a trade
   */
  abstract cancelTrade(tradeId: string): Promise<boolean>;
  
  /**
   * Get trade details
   */
  abstract getTradeDetails(tradeId: string): Promise<P2PTrade>;
  
  /**
   * Common P2P functionality
   */
  protected generatePaymentInstructions(trade: P2PTrade): PaymentInstructions {
    const instructions: PaymentInstructions = {
      method: trade.paymentMethod,
      details: trade.paymentDetails,
      reference: trade.referenceCode,
      expiresAt: trade.expiresAt,
      amount: trade.amount,
      currency: trade.currency
    };
    
    // Add QR code for bank transfers if applicable
    if (trade.paymentMethod === 'bank_transfer' && trade.paymentDetails.qrData) {
      instructions.qrCode = trade.paymentDetails.qrData;
    }
    
    return instructions;
  }
  
  /**
   * Validate trade status transition
   */
  protected validateStatusTransition(
    currentStatus: TradeStatus, 
    newStatus: TradeStatus
  ): boolean {
    const validTransitions: Record<TradeStatus, TradeStatus[]> = {
      [TradeStatus.CREATED]: [
        TradeStatus.PAYMENT_PENDING,
        TradeStatus.CANCELLED
      ],
      [TradeStatus.PAYMENT_PENDING]: [
        TradeStatus.PAYMENT_RECEIVED,
        TradeStatus.CANCELLED,
        TradeStatus.DISPUTED
      ],
      [TradeStatus.PAYMENT_RECEIVED]: [
        TradeStatus.ESCROW_LOCKED,
        TradeStatus.DISPUTED
      ],
      [TradeStatus.ESCROW_LOCKED]: [
        TradeStatus.RELEASED,
        TradeStatus.DISPUTED
      ],
      [TradeStatus.RELEASED]: [],
      [TradeStatus.CANCELLED]: [],
      [TradeStatus.DISPUTED]: [
        TradeStatus.RELEASED,
        TradeStatus.CANCELLED
      ]
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
  
  /**
   * Format payment reference for P2P trade
   */
  protected formatReference(tradeId: string): string {
    // Remove special characters and make uppercase
    return tradeId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
  }
  
  /**
   * Calculate trade expiry time
   */
  protected calculateExpiry(minutes: number = 15): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }
  
  /**
   * Log trade event
   */
  protected logTradeEvent(event: string, trade: P2PTrade, data?: any): void {
    logger.info(`P2P Trade Event: ${event}`, {
      provider: this.provider,
      tradeId: trade.id,
      status: trade.status,
      amount: trade.amount,
      currency: trade.currency,
      ...data
    });
  }
  
  /**
   * Handle trade error
   */
  protected handleTradeError(error: any, context: string): Error {
    logger.error(`P2P Trade Error: ${context}`, {
      provider: this.provider,
      error: error.message || error,
      stack: error.stack
    });
    
    // Return user-friendly error
    if (error.response?.status === 404) {
      return new Error('Trade not found');
    }
    if (error.response?.status === 401) {
      return new Error('Authentication failed');
    }
    if (error.response?.status === 429) {
      return new Error('Rate limit exceeded, please try again later');
    }
    
    return new Error(`P2P trade failed: ${context}`);
  }
}