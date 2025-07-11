import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || 'logs';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'crypto-payment-gateway' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// Create a stream object for Morgan middleware
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper functions for structured logging
export const logPaymentEvent = (event: string, paymentId: string, data?: any) => {
  logger.info(`Payment Event: ${event}`, {
    paymentId,
    event,
    ...data
  });
};

export const logRouteEvent = (event: string, routeId: string, data?: any) => {
  logger.info(`Route Event: ${event}`, {
    routeId,
    event,
    ...data
  });
};

export const logWebhookEvent = (provider: string, event: string, data?: any) => {
  logger.info(`Webhook Event: ${provider} - ${event}`, {
    provider,
    event,
    ...data
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
};