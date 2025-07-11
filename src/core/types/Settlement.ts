export interface Settlement {
  id: string;
  paymentId: string;
  merchantId: string;
  amount: number;
  currency: string;
  walletAddress: string;
  txHash?: string;
  status: SettlementStatus;
  settledAt?: Date;
  fees: SettlementFees;
  blockchain: string;
  confirmations?: number;
  requiredConfirmations: number;
}

export enum SettlementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface SettlementFees {
  platformFee: number;
  networkFee: number;
  routeFee: number;
  total: number;
  currency: string;
}

export interface WalletTransaction {
  to: string;
  amount: number;
  currency: string;
  memo?: string;
  gasPrice?: string;
  gasLimit?: number;
  nonce?: number;
}

export interface BlockchainTransaction {
  txHash: string;
  blockchain: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
}

export interface MerchantSettlementPreferences {
  merchantId: string;
  preferredCrypto: string;
  walletAddress: string;
  minSettlementAmount: number;
  settlementFrequency: 'instant' | 'hourly' | 'daily' | 'weekly';
  autoCashout: boolean;
  cashoutThreshold?: number;
}

export interface SettlementBatch {
  id: string;
  merchantId: string;
  paymentIds: string[];
  totalAmount: number;
  currency: string;
  status: SettlementStatus;
  createdAt: Date;
  processedAt?: Date;
  txHash?: string;
}