// Test setup file
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock logger to avoid file system operations during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  logPaymentEvent: jest.fn(),
  logRouteEvent: jest.fn(),
  logWebhookEvent: jest.fn(),
  logError: jest.fn()
}));

// Global test timeout
jest.setTimeout(30000);