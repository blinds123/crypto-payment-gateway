import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation schemas
const paymentRequestSchema = Joi.object({
  amount: Joi.number().positive().min(1).max(10000).required()
    .messages({
      'number.positive': 'Amount must be a positive number',
      'number.min': 'Minimum amount is $1',
      'number.max': 'Maximum amount is $10,000',
      'any.required': 'Amount is required'
    }),
  
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD').required()
    .messages({
      'any.only': 'Currency must be one of: USD, EUR, GBP, CAD, AUD',
      'any.required': 'Currency is required'
    }),
  
  chain: Joi.string().valid('ethereum', 'bitcoin', 'polygon', 'arbitrum', 'optimism', 'base').required()
    .messages({
      'any.only': 'Chain must be one of: ethereum, bitcoin, polygon, arbitrum, optimism, base',
      'any.required': 'Blockchain network is required'
    }),
  
  customerEmail: Joi.string().email().optional()
    .messages({
      'string.email': 'Must be a valid email address'
    })
});

const sessionIdSchema = Joi.object({
  sessionId: Joi.string().required()
    .messages({
      'any.required': 'Session ID is required'
    })
});

const webhookSchema = Joi.object({
  type: Joi.string().required()
    .messages({
      'any.required': 'Webhook type is required'
    }),
  
  data: Joi.object().required()
    .messages({
      'any.required': 'Webhook data is required'
    })
});

// Validation middleware functions
export const validatePaymentRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = paymentRequestSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      field: error.details[0].path[0]
    });
    return;
  }
  
  next();
};

export const validateSessionId = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = sessionIdSchema.validate(req.params);
  
  if (error) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
    return;
  }
  
  next();
};

export const validateWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = webhookSchema.validate(req.body);
  
  if (error) {
    res.status(400).json({
      error: 'Webhook validation failed',
      message: error.details[0].message
    });
    return;
  }
  
  next();
};

// Generic validation middleware
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.details[0].message,
        field: error.details[0].path[0]
      });
      return;
    }
    
    next();
  };
};

// Sanitization helpers
export const sanitizeAmount = (amount: string | number): number => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.round(num * 100) / 100; // Round to 2 decimal places
};

export const sanitizeCurrency = (currency: string): string => {
  return currency.toUpperCase().trim();
};

export const sanitizeChain = (chain: string): string => {
  return chain.toLowerCase().trim();
};

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};