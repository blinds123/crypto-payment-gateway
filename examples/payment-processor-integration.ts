/**
 * PaymentProcessor Integration Example
 * 
 * This example demonstrates how to integrate the PaymentProcessor
 * into a complete payment system with proper error handling,
 * monitoring, and webhook processing.
 */

import { PaymentProcessor } from '../src/core/services/PaymentProcessor';
import { PaymentStatus, CreatePaymentDTO } from '../src/core/types';
import { logger } from '../src/utils/logger';
import express from 'express';
import rateLimit from 'express-rate-limit';

class PaymentService {
  private processor: PaymentProcessor;
  private app: express.Application;
  
  constructor() {
    // Initialize PaymentProcessor with production configuration
    this.processor = new PaymentProcessor({
      rateLimits: {
        maxConcurrentPayments: 100,
        maxPaymentsPerMinute: 1000,
        maxPaymentsPerHour: 10000
      },
      monitoring: {
        statusCheckInterval: 30000,    // 30 seconds
        paymentTimeout: 1800000,       // 30 minutes
        maxRetries: 3
      },
      fraud: {
        maxAmountPerCustomer: 10000,
        maxPaymentsPerCustomer: 10,
        suspiciousPatterns: [
          'rapid_succession',
          'unusual_amounts',
          'multiple_devices'
        ]
      },
      settlement: {
        autoSettlementEnabled: true,
        minSettlementAmount: 100,
        settlementFrequency: 'instant'
      },
      webhook: {
        maxRetries: 3,
        retryDelayMs: 5000,
        timeoutMs: 30000
      }
    });

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Rate limiting middleware
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });

    this.app.use(limiter);
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Create payment endpoint
    this.app.post('/payments', async (req, res) => {
      try {
        const paymentDTO: CreatePaymentDTO = {
          merchantId: req.body.merchantId,
          amount: parseFloat(req.body.amount),
          currency: req.body.currency,
          cryptoCurrency: req.body.cryptoCurrency,
          customer: {
            email: req.body.customer.email,
            phone: req.body.customer.phone,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent') || 'Unknown'
          },
          metadata: {
            ...req.body.metadata,
            webhookUrl: req.body.webhookUrl
          }
        };

        const result = await this.processor.createPayment(paymentDTO);

        res.status(201).json({
          success: true,
          payment: {
            id: result.payment.id,
            amount: result.payment.amount,
            currency: result.payment.currency,
            status: result.payment.status,
            createdAt: result.payment.createdAt
          },
          instructions: result.instructions
        });

      } catch (error: any) {
        logger.error('Payment creation failed', {
          error: error.message,
          body: req.body,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get payment status endpoint
    this.app.get('/payments/:id', async (req, res) => {
      try {
        const paymentId = req.params.id;
        const result = await this.processor.checkPaymentStatus(paymentId);

        res.json({
          success: true,
          payment: result.payment,
          status: result.status,
          instructions: result.instructions,
          settlement: result.settlement
        });

      } catch (error: any) {
        logger.error('Payment status check failed', {
          paymentId: req.params.id,
          error: error.message
        });

        res.status(404).json({
          success: false,
          error: error.message
        });
      }
    });

    // Cancel payment endpoint
    this.app.delete('/payments/:id', async (req, res) => {
      try {
        const paymentId = req.params.id;
        const reason = req.body.reason || 'User requested cancellation';

        const cancelled = await this.processor.cancelPayment(paymentId, reason);

        if (cancelled) {
          res.json({
            success: true,
            message: 'Payment cancelled successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'Payment could not be cancelled'
          });
        }

      } catch (error: any) {
        logger.error('Payment cancellation failed', {
          paymentId: req.params.id,
          error: error.message
        });

        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Process refund endpoint
    this.app.post('/payments/:id/refund', async (req, res) => {
      try {
        const paymentId = req.params.id;
        const amount = req.body.amount ? parseFloat(req.body.amount) : undefined;

        const refunded = await this.processor.processRefund(paymentId, amount);

        if (refunded) {
          res.json({
            success: true,
            message: 'Refund processed successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'Refund could not be processed'
          });
        }

      } catch (error: any) {
        logger.error('Refund processing failed', {
          paymentId: req.params.id,
          error: error.message
        });

        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get payment details endpoint
    this.app.get('/payments/:id/details', async (req, res) => {
      try {
        const paymentId = req.params.id;
        const details = await this.processor.getPaymentDetails(paymentId);

        res.json({
          success: true,
          payment: details.payment,
          context: {
            route: details.context.route,
            retryCount: details.context.retryCount,
            startTime: details.context.startTime,
            lastStatusCheck: details.context.lastStatusCheck,
            settlement: details.context.settlement,
            webhookStatus: details.context.webhookStatus,
            auditTrail: details.context.auditTrail
          }
        });

      } catch (error: any) {
        logger.error('Payment details fetch failed', {
          paymentId: req.params.id,
          error: error.message
        });

        res.status(404).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get processing statistics endpoint
    this.app.get('/admin/stats', async (req, res) => {
      try {
        const stats = await this.processor.getProcessingStats();
        res.json({
          success: true,
          stats
        });

      } catch (error: any) {
        logger.error('Stats fetch failed', {
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  private setupEventHandlers(): void {
    // Payment lifecycle events
    this.processor.on('payment_created', async ({ payment, instructions }) => {
      logger.info('Payment created', {
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        customer: payment.customer.email
      });

      // Send confirmation email to customer
      await this.sendPaymentConfirmation(payment, instructions);
    });

    this.processor.on('payment_completed', async ({ paymentId }) => {
      logger.info('Payment completed', { paymentId });
      
      // Trigger order fulfillment
      await this.triggerOrderFulfillment(paymentId);
      
      // Send success notification
      await this.sendPaymentSuccessNotification(paymentId);
    });

    this.processor.on('payment_failed', async ({ paymentId, reason }) => {
      logger.error('Payment failed', { paymentId, reason });
      
      // Send failure notification
      await this.sendPaymentFailureNotification(paymentId, reason);
      
      // Update order status
      await this.updateOrderStatus(paymentId, 'failed');
    });

    this.processor.on('payment_cancelled', async ({ paymentId, reason }) => {
      logger.info('Payment cancelled', { paymentId, reason });
      
      // Send cancellation notification
      await this.sendPaymentCancellationNotification(paymentId, reason);
      
      // Update order status
      await this.updateOrderStatus(paymentId, 'cancelled');
    });

    this.processor.on('payment_refunded', async ({ paymentId, amount }) => {
      logger.info('Payment refunded', { paymentId, amount });
      
      // Send refund notification
      await this.sendRefundNotification(paymentId, amount);
      
      // Update order status
      await this.updateOrderStatus(paymentId, 'refunded');
    });

    // Route events
    this.processor.on('route_failover', async ({ paymentId, previousRoute, newRoute }) => {
      logger.warn('Route failover occurred', {
        paymentId,
        previousRoute,
        newRoute
      });
      
      // Update customer with new payment instructions if needed
      await this.updatePaymentInstructions(paymentId, newRoute);
    });

    // Settlement events
    this.processor.on('settlement_created', async ({ paymentId, settlement }) => {
      logger.info('Settlement created', {
        paymentId,
        settlementId: settlement.id,
        amount: settlement.amount,
        fees: settlement.fees.total
      });
      
      // Notify merchant of settlement
      await this.notifyMerchantSettlement(paymentId, settlement);
    });

    this.processor.on('settlement_completed', async ({ paymentId, settlement }) => {
      logger.info('Settlement completed', {
        paymentId,
        settlementId: settlement.id,
        txHash: settlement.txHash
      });
      
      // Send settlement confirmation
      await this.sendSettlementConfirmation(paymentId, settlement);
    });

    // Webhook events
    this.processor.on('webhook_failed', async ({ paymentId, event, error }) => {
      logger.error('Webhook delivery failed', {
        paymentId,
        event,
        error
      });
      
      // Alert operations team
      await this.alertWebhookFailure(paymentId, event, error);
    });

    // Error handling
    this.processor.on('error', (error) => {
      logger.error('PaymentProcessor error', {
        error: error.message,
        stack: error.stack
      });
    });
  }

  // Helper methods for event handling
  private async sendPaymentConfirmation(payment: any, instructions: any): Promise<void> {
    // Implementation would send email/SMS confirmation
    logger.info('Sending payment confirmation', {
      paymentId: payment.id,
      email: payment.customer.email
    });
  }

  private async triggerOrderFulfillment(paymentId: string): Promise<void> {
    // Implementation would trigger order fulfillment process
    logger.info('Triggering order fulfillment', { paymentId });
  }

  private async sendPaymentSuccessNotification(paymentId: string): Promise<void> {
    // Implementation would send success notification
    logger.info('Sending payment success notification', { paymentId });
  }

  private async sendPaymentFailureNotification(paymentId: string, reason: string): Promise<void> {
    // Implementation would send failure notification
    logger.info('Sending payment failure notification', { paymentId, reason });
  }

  private async sendPaymentCancellationNotification(paymentId: string, reason: string): Promise<void> {
    // Implementation would send cancellation notification
    logger.info('Sending payment cancellation notification', { paymentId, reason });
  }

  private async sendRefundNotification(paymentId: string, amount: number): Promise<void> {
    // Implementation would send refund notification
    logger.info('Sending refund notification', { paymentId, amount });
  }

  private async updateOrderStatus(paymentId: string, status: string): Promise<void> {
    // Implementation would update order status in database
    logger.info('Updating order status', { paymentId, status });
  }

  private async updatePaymentInstructions(paymentId: string, newRoute: string): Promise<void> {
    // Implementation would update payment instructions
    logger.info('Updating payment instructions', { paymentId, newRoute });
  }

  private async notifyMerchantSettlement(paymentId: string, settlement: any): Promise<void> {
    // Implementation would notify merchant of settlement
    logger.info('Notifying merchant of settlement', { paymentId, settlementId: settlement.id });
  }

  private async sendSettlementConfirmation(paymentId: string, settlement: any): Promise<void> {
    // Implementation would send settlement confirmation
    logger.info('Sending settlement confirmation', { paymentId, settlementId: settlement.id });
  }

  private async alertWebhookFailure(paymentId: string, event: string, error: string): Promise<void> {
    // Implementation would alert operations team
    logger.error('Alerting webhook failure', { paymentId, event, error });
  }

  public async start(port: number = 3000): Promise<void> {
    this.app.listen(port, () => {
      logger.info(`Payment service started on port ${port}`);
    });
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down payment service');
    await this.processor.shutdown();
    logger.info('Payment service shutdown completed');
  }
}

// Usage example
async function main() {
  const paymentService = new PaymentService();
  
  // Start the service
  await paymentService.start(3000);
  
  // Graceful shutdown handling
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await paymentService.shutdown();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await paymentService.shutdown();
    process.exit(0);
  });
}

// Example API usage
async function exampleUsage() {
  const paymentService = new PaymentService();
  
  // Create a payment
  const paymentData = {
    merchantId: 'merchant_123',
    amount: 100.50,
    currency: 'USD',
    cryptoCurrency: 'BTC',
    customer: {
      email: 'customer@example.com',
      phone: '+1234567890'
    },
    metadata: {
      orderId: 'order_789',
      webhookUrl: 'https://merchant.com/webhook'
    }
  };

  try {
    // This would be called via HTTP POST to /payments
    console.log('Creating payment...');
    
    // Monitor payment status
    console.log('Monitoring payment status...');
    
    // The PaymentProcessor handles everything automatically:
    // - Route selection
    // - Payment monitoring
    // - Failover handling
    // - Settlement processing
    // - Webhook notifications
    
  } catch (error) {
    console.error('Payment processing failed:', error);
  }
}

// Export for use in other modules
export { PaymentService };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}