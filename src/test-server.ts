import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { config } from 'dotenv';
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
app.get('/checkout', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

// API documentation redirect
app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'Crypto Payment Gateway API',
    version: '1.0.0',
    description: 'Seamless card-to-crypto payment processing',
    endpoints: {
      health: '/health',
      checkout: '/checkout',
      crossmint: '/api/crossmint'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Test server started on port ${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`💳 Checkout: http://localhost:${PORT}/checkout`);
  console.log(`🔧 Config: http://localhost:${PORT}/api/crossmint/config`);
});