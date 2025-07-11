import { PaymentProcessor } from '../../src/core/services/PaymentProcessor';
import { PaymentStatus, CreatePaymentDTO } from '../../src/core/types';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue('0'),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK')
  }));
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn()
  })
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock SmartRouter
jest.mock('../../src/core/router/SmartRouter', () => {
  return {
    SmartRouter: jest.fn().mockImplementation(() => ({
      selectRoute: jest.fn().mockResolvedValue({
        id: 'blockchain_bitcoin',
        type: 'blockchain',
        provider: 'bitcoin',
        priority: 1,
        isActive: true,
        capabilities: {
          currencies: ['USD', 'EUR', 'AUD'],
          cryptoCurrencies: ['BTC'],
          paymentMethods: ['blockchain'],
          countries: ['*'],
          features: ['direct_blockchain', 'no_kyc']
        },
        limits: {
          minAmount: 10,
          maxAmount: 100000,
          dailyVolume: 1000000,
          monthlyVolume: 10000000
        },
        fees: {
          percentage: 0.1,
          fixed: 0,
          currency: 'USD'
        }
      }),
      failover: jest.fn().mockResolvedValue({
        id: 'blockchain_ethereum',
        type: 'blockchain',
        provider: 'ethereum',
        priority: 2,
        isActive: true,
        capabilities: {
          currencies: ['USD', 'EUR', 'AUD'],
          cryptoCurrencies: ['ETH'],
          paymentMethods: ['blockchain'],
          countries: ['*'],
          features: ['smart_contracts', 'erc20_tokens']
        },
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
        }
      }),
      cleanupFailedRoutes: jest.fn(),
      getRouteStatistics: jest.fn().mockResolvedValue([])
    }))
  };
});

// Define test data at top level
const validPaymentDTO: CreatePaymentDTO = {
  merchantId: 'merchant_123',
  amount: 100,
  currency: 'USD',
  cryptoCurrency: 'BTC',
  customer: {
    email: 'customer@example.com',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test'
  },
  metadata: {
    orderId: 'order_123'
  }
};

describe('PaymentProcessor', () => {
  let processor: PaymentProcessor;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    processor = new PaymentProcessor({
      rateLimits: {
        maxConcurrentPayments: 10,
        maxPaymentsPerMinute: 100,
        maxPaymentsPerHour: 1000
      },
      monitoring: {
        statusCheckInterval: 5000,
        paymentTimeout: 300000,
        maxRetries: 2
      }
    });
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  });

  afterEach(async () => {
    await processor.shutdown();
    jest.clearAllMocks();
  });

  describe('createPayment', () => {

    it('should create a payment successfully', async () => {
      // Mock CoinGecko API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bitcoin: { usd: 50000 }
        })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);

      expect(result.payment).toBeDefined();
      expect(result.payment.id).toBeDefined();
      expect(result.payment.merchantId).toBe('merchant_123');
      expect(result.payment.amount).toBe(100);
      expect(result.payment.currency).toBe('USD');
      expect(result.payment.status).toBe(PaymentStatus.CREATED);
      expect(result.instructions).toBeDefined();
      expect(result.instructions.method).toBeDefined();
      expect(result.instructions.reference).toBe(result.payment.id);
    });

    it('should validate payment DTO', async () => {
      const invalidDTO = { ...validPaymentDTO, amount: 0 };
      
      await expect(processor.createPayment(invalidDTO)).rejects.toThrow('Amount must be positive');
    });

    it('should reject payment due to fraud detection', async () => {
      // Create a processor with lower fraud threshold for testing
      const fraudProcessor = new PaymentProcessor({
        fraud: {
          maxAmountPerCustomer: 1000, // Lower threshold
          maxPaymentsPerCustomer: 5,
          suspiciousPatterns: ['high_amount']
        }
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);
      
      const highAmountDTO = { ...validPaymentDTO, amount: 50000 };
      
      await expect(fraudProcessor.createPayment(highAmountDTO)).rejects.toThrow('Payment rejected');
      
      await fraudProcessor.shutdown();
    });

    it('should handle rate limiting', async () => {
      // Mock Redis to return high count
      const mockRedis = require('ioredis').mock.results[0].value;
      mockRedis.get.mockResolvedValueOnce('150'); // Over the limit

      await expect(processor.createPayment(validPaymentDTO)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status successfully', async () => {
      // First create a payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Check status
      const status = await processor.checkPaymentStatus(paymentId);
      
      expect(status.payment).toBeDefined();
      expect(status.status).toBeDefined();
      expect(status.instructions).toBeDefined();
    });

    it('should throw error for non-existent payment', async () => {
      await expect(processor.checkPaymentStatus('non-existent')).rejects.toThrow('Payment not found');
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      // Create payment first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Cancel payment
      const cancelled = await processor.cancelPayment(paymentId, 'User requested');
      
      expect(cancelled).toBe(true);
    });

    it('should not cancel completed payment', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Manually set status to completed
      const details = await processor.getPaymentDetails(paymentId);
      details.payment.status = PaymentStatus.COMPLETED;

      // Try to cancel
      await expect(processor.cancelPayment(paymentId, 'Test')).rejects.toThrow('Cannot cancel completed payment');
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Set payment as completed
      const details = await processor.getPaymentDetails(paymentId);
      details.payment.status = PaymentStatus.COMPLETED;

      // Process refund
      const refunded = await processor.processRefund(paymentId);
      
      expect(refunded).toBe(true);
    });

    it('should not refund non-completed payment', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Try to refund
      await expect(processor.processRefund(paymentId)).rejects.toThrow('Can only refund completed payments');
    });
  });

  describe('getPaymentDetails', () => {
    it('should get payment details successfully', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Get details
      const details = await processor.getPaymentDetails(paymentId);
      
      expect(details.payment).toBeDefined();
      expect(details.context).toBeDefined();
      expect(details.context.route).toBeDefined();
      expect(details.context.auditTrail).toBeDefined();
      expect(details.context.auditTrail.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent payment', async () => {
      await expect(processor.getPaymentDetails('non-existent')).rejects.toThrow('Payment not found');
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      // Create a payment first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      await processor.createPayment(validPaymentDTO);

      const stats = await processor.getProcessingStats();
      
      expect(stats).toBeDefined();
      expect(stats.activePayments).toBeDefined();
      expect(stats.processingQueue).toBeDefined();
      expect(stats.totalProcessed).toBeDefined();
      expect(stats.successRate).toBeDefined();
      expect(stats.averageProcessingTime).toBeDefined();
      expect(stats.routeStats).toBeDefined();
      expect(Array.isArray(stats.routeStats)).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should emit payment_created event', async () => {
      const eventSpy = jest.fn();
      processor.on('payment_created', eventSpy);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      await processor.createPayment(validPaymentDTO);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payment: expect.any(Object),
          instructions: expect.any(Object)
        })
      );
    });

    it('should emit payment_cancelled event', async () => {
      const eventSpy = jest.fn();
      processor.on('payment_cancelled', eventSpy);

      // Create payment first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Cancel payment
      await processor.cancelPayment(paymentId, 'Test cancellation');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId,
          reason: 'Test cancellation'
        })
      );
    });
  });

  describe('Route Handling', () => {
    it('should handle different route types', async () => {
      const testCases = [
        { cryptoCurrency: 'BTC', expectedRoute: 'blockchain' },
        { cryptoCurrency: 'ETH', expectedRoute: 'blockchain' },
        { cryptoCurrency: 'USDT', expectedRoute: 'blockchain' }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ bitcoin: { usd: 50000 } })
        } as Response);

        const dto = { ...validPaymentDTO, cryptoCurrency: testCase.cryptoCurrency };
        const result = await processor.createPayment(dto);

        expect(result.instructions.method).toBeDefined();
        expect(result.instructions.details).toBeDefined();
      }
    });
  });

  describe('Fraud Detection', () => {
    it('should detect high-risk payments', async () => {
      // Create a processor with lower fraud threshold
      const fraudProcessor = new PaymentProcessor({
        fraud: {
          maxAmountPerCustomer: 1000, // Lower threshold
          maxPaymentsPerCustomer: 5,
          suspiciousPatterns: ['high_amount']
        }
      });
      
      const highRiskDTO = {
        ...validPaymentDTO,
        amount: 15000 // Above fraud threshold
      };

      await expect(fraudProcessor.createPayment(highRiskDTO)).rejects.toThrow('Payment rejected');
      
      await fraudProcessor.shutdown();
    });

    it('should approve low-risk payments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const lowRiskDTO = {
        ...validPaymentDTO,
        amount: 50 // Below fraud threshold
      };

      const result = await processor.createPayment(lowRiskDTO);
      expect(result.payment.status).toBe(PaymentStatus.CREATED);
    });
  });

  describe('Settlement Processing', () => {
    it('should create settlement for completed payment', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Set payment as completed
      const details = await processor.getPaymentDetails(paymentId);
      details.payment.status = PaymentStatus.COMPLETED;

      // Trigger settlement processing
      const eventSpy = jest.fn();
      processor.on('settlement_created', eventSpy);

      processor.emit('payment_completed', { paymentId });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId,
          settlement: expect.any(Object)
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle route handler errors gracefully', async () => {
      // Create payment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 50000 } })
      } as Response);

      const result = await processor.createPayment(validPaymentDTO);
      const paymentId = result.payment.id;

      // Mock route handler to throw error
      const routeHandler = processor['routeHandlers'].get('blockchain_bitcoin');
      if (routeHandler) {
        routeHandler.checkPaymentStatus = jest.fn().mockRejectedValue(new Error('Route error'));
      }

      // Status check should handle error
      await expect(processor.checkPaymentStatus(paymentId)).rejects.toThrow('Route error');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on shutdown', async () => {
      await processor.shutdown();
      
      // Verify cleanup was called
      expect(processor['paymentContexts'].size).toBe(0);
      expect(processor['routeHandlers'].size).toBe(0);
    });
  });
});