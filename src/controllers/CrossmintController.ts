import { Request, Response } from 'express';
import { CrossmintService, PaymentRequest } from '../services/CrossmintService';
import { BitcoinHandler } from '../routes/blockchain/BitcoinHandler';
import { EthereumHandler } from '../routes/blockchain/EthereumHandler';
import { logger } from '../utils/logger';

export class CrossmintController {
  private crossmintService: CrossmintService;
  private bitcoinHandler: BitcoinHandler;
  private ethereumHandler: EthereumHandler;

  constructor(
    crossmintService: CrossmintService,
    bitcoinHandler: BitcoinHandler,
    ethereumHandler: EthereumHandler
  ) {
    this.crossmintService = crossmintService;
    this.bitcoinHandler = bitcoinHandler;
    this.ethereumHandler = ethereumHandler;

    // Set up event listeners for Crossmint service
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.crossmintService.on('payment:completed', (payment) => {
      logger.info('Payment completed', { paymentId: payment.id, txHash: payment.transactionHash });
    });

    this.crossmintService.on('payment:failed', (payment) => {
      logger.error('Payment failed', { paymentId: payment.id, reason: payment.failureReason });
    });

    this.crossmintService.on('error', (error) => {
      logger.error('Crossmint service error', { error: error.message });
    });
  }

  /**
   * Create a new payment checkout session
   */
  async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const { amount, currency, chain, customerEmail } = req.body;

      // Validate required fields
      if (!amount || !currency || !chain) {
        res.status(400).json({
          error: 'Missing required fields: amount, currency, chain'
        });
        return;
      }

      // Generate crypto address using existing blockchain handlers
      let walletAddress: string;
      
      if (chain === 'bitcoin') {
        const address = await this.bitcoinHandler.generateAddress();
        walletAddress = address.address;
      } else {
        // Ethereum, Polygon, Arbitrum, etc.
        const address = await this.ethereumHandler.generateAddress();
        walletAddress = address.address;
      }

      // Create payment request
      const paymentRequest: PaymentRequest = {
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        recipient: {
          walletAddress,
          chain: chain.toLowerCase()
        },
        metadata: {
          customerEmail,
          timestamp: new Date().toISOString(),
          source: 'crypto-payment-gateway'
        },
        successCallbackUrl: `${process.env.BASE_URL}/api/crossmint/success`,
        failureCallbackUrl: `${process.env.BASE_URL}/api/crossmint/failure`
      };

      // Create checkout session
      const session = await this.crossmintService.createCheckoutSession(paymentRequest);

      logger.info('Checkout session created', {
        sessionId: session.id,
        amount,
        currency,
        chain,
        walletAddress
      });

      res.status(201).json({
        success: true,
        session: {
          id: session.id,
          url: session.url,
          embeddedUrl: session.embeddedUrl,
          walletAddress,
          chain,
          amount,
          currency
        }
      });

    } catch (error: any) {
      logger.error('Failed to create payment', { error: error.message });
      res.status(500).json({
        error: 'Failed to create payment session',
        message: error.message
      });
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          error: 'Session ID is required'
        });
        return;
      }

      const payment = await this.crossmintService.getPaymentStatus(sessionId);

      res.status(200).json({
        success: true,
        payment
      });

    } catch (error: any) {
      logger.error('Failed to get payment status', { 
        sessionId: req.params.sessionId,
        error: error.message 
      });
      res.status(500).json({
        error: 'Failed to get payment status',
        message: error.message
      });
    }
  }

  /**
   * Handle Crossmint webhooks
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-crossmint-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          error: 'Missing webhook signature'
        });
        return;
      }

      await this.crossmintService.handleWebhook(payload, signature);

      logger.info('Webhook processed successfully', {
        type: payload.type,
        paymentId: payload.data?.id
      });

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (error: any) {
      logger.error('Failed to process webhook', { error: error.message });
      res.status(500).json({
        error: 'Failed to process webhook',
        message: error.message
      });
    }
  }

  /**
   * Get embedded checkout HTML
   */
  async getEmbeddedCheckout(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { width, height, theme } = req.query;

      if (!sessionId) {
        res.status(400).json({
          error: 'Session ID is required'
        });
        return;
      }

      const html = this.crossmintService.generateEmbeddedCheckoutHTML(sessionId, {
        width: width as string,
        height: height as string,
        theme: theme as 'light' | 'dark'
      });

      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);

    } catch (error: any) {
      logger.error('Failed to generate embedded checkout', {
        sessionId: req.params.sessionId,
        error: error.message
      });
      res.status(500).json({
        error: 'Failed to generate embedded checkout',
        message: error.message
      });
    }
  }

  /**
   * Get client configuration for frontend
   */
  async getClientConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = this.crossmintService.getClientConfig();
      
      res.status(200).json({
        success: true,
        config: {
          ...config,
          supportedChains: this.crossmintService.getSupportedChains(),
          supportedCurrencies: this.crossmintService.getSupportedCurrencies()
        }
      });

    } catch (error: any) {
      logger.error('Failed to get client config', { error: error.message });
      res.status(500).json({
        error: 'Failed to get client configuration',
        message: error.message
      });
    }
  }

  /**
   * Handle payment success callback
   */
  async handleSuccessCallback(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, transactionHash } = req.query;

      logger.info('Payment success callback received', {
        sessionId,
        transactionHash
      });

      // Redirect to success page or return success response
      res.status(200).json({
        success: true,
        message: 'Payment completed successfully',
        sessionId,
        transactionHash
      });

    } catch (error: any) {
      logger.error('Failed to handle success callback', { error: error.message });
      res.status(500).json({
        error: 'Failed to handle success callback',
        message: error.message
      });
    }
  }

  /**
   * Handle payment failure callback
   */
  async handleFailureCallback(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, error: failureReason } = req.query;

      logger.error('Payment failure callback received', {
        sessionId,
        failureReason
      });

      // Redirect to failure page or return error response
      res.status(200).json({
        success: false,
        message: 'Payment failed',
        sessionId,
        error: failureReason
      });

    } catch (error: any) {
      logger.error('Failed to handle failure callback', { error: error.message });
      res.status(500).json({
        error: 'Failed to handle failure callback',
        message: error.message
      });
    }
  }
}