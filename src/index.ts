import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { SmartRouter } from './core/router/SmartRouter';
import { crossmintRouter } from './routes/crossmint';

// Load environment variables
config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Crossmint payment routes
app.use('/api/crossmint', crossmintRouter);

// Main checkout page route
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

app.get('/checkout', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// API routes placeholder
app.get('/api/v1', (_req, res) => {
  res.json({
    message: 'Crypto Payment Gateway API - Phase 4',
    version: '4.0.0',
    features: [
      'Bitcoin blockchain transactions',
      'Ethereum & ERC-20 support', 
      'Crossmint card-to-crypto payments',
      'Embedded checkout widget',
      'Production-ready integration',
      'Real-time settlement monitoring'
    ],
    endpoints: {
      health: '/health',
      checkout: '/checkout',
      crossmint: '/api/crossmint/*'
    }
  });
});

// Test route for Smart Router
app.get('/api/v1/routes/test', async (_req, res) => {
  try {
    const router = new SmartRouter();
    const stats = await router.getRouteStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Route test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  
  // Log enabled routes
  logger.info('Phase 4 Payment Gateway Initialized', {
    routes: [
      'blockchain_bitcoin (production-ready)',
      'blockchain_ethereum (production-ready)', 
      'crossmint_payments (production-ready)',
      'embedded_checkout_widget (ready)',
      'card_to_crypto_gateway (integrated)'
    ],
    note: 'Crossmint integration complete - card payments with crypto settlement'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;