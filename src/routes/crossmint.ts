import { Router } from 'express';
import { CrossmintController } from '../controllers/CrossmintController';
import { CrossmintService } from '../services/CrossmintService';
import { BitcoinHandler } from './blockchain/BitcoinHandler';
import { EthereumHandler } from './blockchain/EthereumHandler';
import { validatePaymentRequest } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Initialize services and handlers
const crossmintConfig = {
  clientId: process.env.CROSSMINT_CLIENT_ID!,
  environment: (process.env.CROSSMINT_ENVIRONMENT as 'staging' | 'production') || 'staging',
  apiKey: process.env.CROSSMINT_API_KEY!
};

const crossmintService = new CrossmintService(crossmintConfig);
const bitcoinHandler = new BitcoinHandler();
const ethereumHandler = new EthereumHandler();
const crossmintController = new CrossmintController(
  crossmintService,
  bitcoinHandler,
  ethereumHandler
);

// Apply rate limiting to all routes
router.use(rateLimiter);

/**
 * @swagger
 * /api/crossmint/payment:
 *   post:
 *     summary: Create a new payment checkout session
 *     tags: [Crossmint]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - currency
 *               - chain
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *                 example: 100.50
 *               currency:
 *                 type: string
 *                 description: Fiat currency code
 *                 example: "USD"
 *               chain:
 *                 type: string
 *                 description: Blockchain network
 *                 example: "ethereum"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email (optional)
 *                 example: "customer@example.com"
 *     responses:
 *       201:
 *         description: Checkout session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 session:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     url:
 *                       type: string
 *                     embeddedUrl:
 *                       type: string
 *                     walletAddress:
 *                       type: string
 *                     chain:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/payment', validatePaymentRequest, crossmintController.createPayment.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/payment/{sessionId}:
 *   get:
 *     summary: Get payment status by session ID
 *     tags: [Crossmint]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Checkout session ID
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                     transactionHash:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     recipient:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                     completedAt:
 *                       type: string
 *       400:
 *         description: Bad request - missing session ID
 *       500:
 *         description: Internal server error
 */
router.get('/payment/:sessionId', crossmintController.getPaymentStatus.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/webhook:
 *   post:
 *     summary: Handle Crossmint webhook notifications
 *     tags: [Crossmint]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: Webhook event type
 *               data:
 *                 type: object
 *                 description: Webhook payload data
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Bad request - missing signature
 *       500:
 *         description: Internal server error
 */
router.post('/webhook', crossmintController.handleWebhook.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/embed/{sessionId}:
 *   get:
 *     summary: Get embedded checkout HTML
 *     tags: [Crossmint]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Checkout session ID
 *       - in: query
 *         name: width
 *         schema:
 *           type: string
 *         description: Widget width (default: 100%)
 *       - in: query
 *         name: height
 *         schema:
 *           type: string
 *         description: Widget height (default: 600px)
 *       - in: query
 *         name: theme
 *         schema:
 *           type: string
 *           enum: [light, dark]
 *         description: Widget theme (default: light)
 *     responses:
 *       200:
 *         description: Embedded checkout HTML
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request - missing session ID
 *       500:
 *         description: Internal server error
 */
router.get('/embed/:sessionId', crossmintController.getEmbeddedCheckout.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/config:
 *   get:
 *     summary: Get client configuration
 *     tags: [Crossmint]
 *     responses:
 *       200:
 *         description: Client configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 config:
 *                   type: object
 *                   properties:
 *                     clientId:
 *                       type: string
 *                     environment:
 *                       type: string
 *                     baseUrl:
 *                       type: string
 *                     supportedChains:
 *                       type: array
 *                       items:
 *                         type: string
 *                     supportedCurrencies:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
router.get('/config', crossmintController.getClientConfig.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/success:
 *   get:
 *     summary: Handle payment success callback
 *     tags: [Crossmint]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Checkout session ID
 *       - in: query
 *         name: transactionHash
 *         schema:
 *           type: string
 *         description: Transaction hash
 *     responses:
 *       200:
 *         description: Success callback handled
 */
router.get('/success', crossmintController.handleSuccessCallback.bind(crossmintController));

/**
 * @swagger
 * /api/crossmint/failure:
 *   get:
 *     summary: Handle payment failure callback
 *     tags: [Crossmint]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Checkout session ID
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Failure reason
 *     responses:
 *       200:
 *         description: Failure callback handled
 */
router.get('/failure', crossmintController.handleFailureCallback.bind(crossmintController));

export { router as crossmintRouter };