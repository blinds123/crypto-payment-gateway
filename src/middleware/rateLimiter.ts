import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Express Request type to include rateLimit
declare module 'express' {
  interface Request {
    rateLimit?: {
      limit: number;
      current: number;
      remaining: number;
      resetTime: Date;
    };
  }
}

// Create rate limiter instance
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Create stricter rate limiter for payment endpoints
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 payment requests per window
  message: 'Too many payment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Payment rate limit exceeded',
      message: 'Too many payment requests. Please wait before trying again.',
      retryAfter: req.rateLimit?.resetTime
    });
  }
});

// Create webhook rate limiter
export const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 webhook calls per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false
});