import axios from 'axios';
import { EventEmitter } from 'events';

export interface CrossmintConfig {
  clientId: string;
  environment: 'staging' | 'production';
  apiKey?: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  recipient: {
    walletAddress: string;
    chain: 'ethereum' | 'bitcoin' | 'polygon' | 'arbitrum';
  };
  metadata?: Record<string, any>;
  successCallbackUrl?: string;
  failureCallbackUrl?: string;
}

export interface CrossmintPayment {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  amount: number;
  currency: string;
  recipient: {
    walletAddress: string;
    chain: string;
  };
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  embeddedUrl: string;
  payment: PaymentRequest;
  status: 'created' | 'pending' | 'completed' | 'failed';
}

export class CrossmintService extends EventEmitter {
  private config: CrossmintConfig;
  private baseUrl: string;

  constructor(config: CrossmintConfig) {
    super();
    this.config = config;
    this.baseUrl = config.environment === 'production' 
      ? 'https://api.crossmint.com' 
      : 'https://api.staging.crossmint.com';
  }

  /**
   * Create a new checkout session for embedded widget
   */
  async createCheckoutSession(paymentRequest: PaymentRequest): Promise<CheckoutSession> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/2022-06-09/checkout/sessions`,
        {
          payment: {
            currency: paymentRequest.currency,
            amount: paymentRequest.amount.toString(),
            recipient: paymentRequest.recipient,
            metadata: paymentRequest.metadata || {}
          },
          successCallbackUrl: paymentRequest.successCallbackUrl,
          failureCallbackUrl: paymentRequest.failureCallbackUrl
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-CLIENT-SECRET': this.config.apiKey,
            'X-PROJECT-ID': this.config.clientId
          }
        }
      );

      const session: CheckoutSession = {
        id: response.data.id,
        url: response.data.url,
        embeddedUrl: response.data.embeddedUrl,
        payment: paymentRequest,
        status: 'created'
      };

      this.emit('session:created', session);
      return session;

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      this.emit('error', new Error(`Failed to create checkout session: ${errorMessage}`));
      throw error;
    }
  }

  /**
   * Get payment status by session ID
   */
  async getPaymentStatus(sessionId: string): Promise<CrossmintPayment> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/2022-06-09/checkout/sessions/${sessionId}`,
        {
          headers: {
            'X-CLIENT-SECRET': this.config.apiKey,
            'X-PROJECT-ID': this.config.clientId
          }
        }
      );

      const payment: CrossmintPayment = {
        id: response.data.id,
        status: response.data.status,
        transactionHash: response.data.transactionHash,
        amount: parseFloat(response.data.payment.amount),
        currency: response.data.payment.currency,
        recipient: response.data.payment.recipient,
        createdAt: response.data.createdAt,
        completedAt: response.data.completedAt,
        failureReason: response.data.failureReason
      };

      return payment;

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`Failed to get payment status: ${errorMessage}`);
    }
  }

  /**
   * Handle webhook notifications from Crossmint
   */
  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature (implement signature verification)
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const { type, data } = payload;

      switch (type) {
        case 'payment.completed':
          this.emit('payment:completed', data);
          break;
        case 'payment.failed':
          this.emit('payment:failed', data);
          break;
        case 'payment.pending':
          this.emit('payment:pending', data);
          break;
        default:
          this.emit('webhook:unknown', { type, data });
      }

    } catch (error) {
      this.emit('webhook:error', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature (placeholder - implement actual verification)
   */
  private verifyWebhookSignature(_payload: any, _signature: string): boolean {
    // TODO: Implement actual signature verification using Crossmint's method
    // This is a placeholder implementation
    return true;
  }

  /**
   * Get supported chains and currencies
   */
  getSupportedChains(): string[] {
    return ['ethereum', 'bitcoin', 'polygon', 'arbitrum', 'optimism', 'base'];
  }

  getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  }

  /**
   * Generate embedded checkout HTML
   */
  generateEmbeddedCheckoutHTML(sessionId: string, options?: {
    width?: string;
    height?: string;
    theme?: 'light' | 'dark';
  }): string {
    const { width = '100%', height = '600px', theme = 'light' } = options || {};
    
    return `
      <div id="crossmint-checkout-${sessionId}" style="width: ${width}; height: ${height};">
        <iframe
          src="${this.baseUrl}/checkout/${sessionId}?embedded=true&theme=${theme}"
          width="100%"
          height="100%"
          frameborder="0"
          style="border: none; border-radius: 8px;"
          allow="payment"
        ></iframe>
      </div>
      <script>
        // Listen for messages from Crossmint iframe
        window.addEventListener('message', function(event) {
          if (event.origin === '${this.baseUrl}') {
            if (event.data.type === 'crossmint:payment:success') {
              window.dispatchEvent(new CustomEvent('crossmint:success', { detail: event.data }));
            } else if (event.data.type === 'crossmint:payment:error') {
              window.dispatchEvent(new CustomEvent('crossmint:error', { detail: event.data }));
            }
          }
        });
      </script>
    `;
  }

  /**
   * Get client-side configuration for embedded widget
   */
  getClientConfig() {
    return {
      clientId: this.config.clientId,
      environment: this.config.environment,
      baseUrl: this.baseUrl
    };
  }
}

