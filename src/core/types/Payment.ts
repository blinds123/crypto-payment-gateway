export interface Payment {
  id: string;
  merchantId: string;
  amount: number;
  currency: 'AUD' | 'USD' | 'EUR';
  cryptoCurrency: string;
  route: PaymentRoute;
  status: PaymentStatus;
  customer: CustomerInfo;
  metadata: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
  settlementId?: string;
  settlementStatus?: SettlementStatus;
}

export interface CustomerInfo {
  email: string;
  phone?: string;
  dateOfBirth?: string; // Only if required
  ipAddress: string;
  userAgent: string;
}

export enum PaymentStatus {
  CREATED = 'created',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REFUNDED = 'refunded'
}

export enum SettlementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface PaymentRoute {
  id: string;
  type: 'blockchain' | 'dex' | 'scraping' | 'selfhosted';
  provider: string;
  priority: number;
  isActive: boolean;
  capabilities: PaymentRouteCapabilities;
  limits: PaymentRouteLimits;
  fees: PaymentRouteFees;
}

export interface PaymentRouteCapabilities {
  currencies: string[];
  cryptoCurrencies: string[];
  paymentMethods: string[];
  countries: string[];
  features: string[];
}

export interface PaymentRouteLimits {
  minAmount: number;
  maxAmount: number;
  dailyVolume: number;
  monthlyVolume: number;
}

export interface PaymentRouteFees {
  percentage: number;
  fixed: number;
  currency: string;
}

export interface PaymentInstructions {
  method: string;
  details: any;
  reference: string;
  expiresAt: Date;
  amount: number;
  currency: string;
  qrCode?: string;
}

export interface CreatePaymentDTO {
  merchantId: string;
  amount: number;
  currency: 'AUD' | 'USD' | 'EUR';
  cryptoCurrency?: string;
  customer: {
    email: string;
    phone?: string;
    ipAddress: string;
    userAgent: string;
  };
  metadata?: Record<string, any>;
}