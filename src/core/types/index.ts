export * from './Payment';
export * from './Route';
export { Settlement, SettlementFees, WalletTransaction, BlockchainTransaction, MerchantSettlementPreferences, SettlementBatch } from './Settlement';

// Common types used across the application
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  provider: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export interface Merchant {
  id: string;
  businessName: string;
  abn: string;
  email: string;
  walletAddress: string;
  preferredCrypto: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  apiKey: string;
  apiSecret?: string;
  webhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
  merchantId: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}