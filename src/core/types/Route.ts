export interface P2PTrade {
  id: string;
  provider: string;
  status: TradeStatus;
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentMethod: string;
  paymentDetails: any;
  referenceCode: string;
  expiresAt: Date;
  escrowAddress?: string;
  sellerInfo?: {
    username: string;
    rating: number;
    completedTrades: number;
  };
}

export enum TradeStatus {
  CREATED = 'created',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_RECEIVED = 'payment_received',
  ESCROW_LOCKED = 'escrow_locked',
  RELEASED = 'released',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed'
}

export interface GiftCardOrder {
  id: string;
  provider: string;
  status: OrderStatus;
  product: GiftCardProduct;
  amount: number;
  currency: string;
  cryptoAmount?: number;
  cryptoCurrency?: string;
  paymentUrl?: string;
  giftCardCode?: string;
  giftCardPin?: string;
  expiresAt?: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface GiftCardProduct {
  id: string;
  brand: string;
  country: string;
  category: string;
  valueRange: {
    min: number;
    max: number;
  };
  discount: number;
  description: string;
  imageUrl: string;
}

export interface CryptoInvoice {
  id: string;
  provider: string;
  paymentUrl?: string;
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  address: string;
  expiresAt: Date;
  qrCode?: string;
  status?: InvoiceStatus;
  txHash?: string;
  confirmations?: number;
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  UNDERPAID = 'underpaid',
  OVERPAID = 'overpaid',
  CONFIRMED = 'confirmed',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

export interface RouteConfig {
  enabled: boolean;
  priority: number;
  limits: RouteLimits;
  fees: RouteFees;
  capabilities: RouteCapabilities;
  credentials?: Record<string, string>;
}

export interface RouteLimits {
  minAmount: number;
  maxAmount: number;
  dailyVolume: number;
  monthlyVolume: number;
}

export interface RouteFees {
  percentage: number;
  fixed: number;
  currency: string;
}

export interface RouteCapabilities {
  currencies: string[];
  cryptoCurrencies: string[];
  paymentMethods: string[];
  countries: string[];
  features: string[];
}

export interface RouteMetrics {
  routeId: string;
  successRate: number;
  averageSettlementTime: number;
  totalVolume: number;
  failureReasons: Record<string, number>;
  lastUpdated: Date;
}