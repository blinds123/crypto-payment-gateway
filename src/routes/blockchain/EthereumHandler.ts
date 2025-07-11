import { BlockchainBase, BlockchainTransaction, WalletAddress } from './BlockchainBase';
import { Payment, PaymentInstructions } from '../../core/types';
import { PUBLIC_API_ENDPOINTS } from '../../core/config/routes.config';
import { ethers } from 'ethers';

// ERC-20 token contract addresses on Ethereum mainnet
const ERC20_CONTRACTS = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86a33E6441C8E1BF4b4AE3B1F41da7ffCfa14',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
};

// ERC-20 token decimals
const ERC20_DECIMALS = {
  USDT: 6,
  USDC: 6,
  DAI: 18
};

// Simplified ERC-20 ABI for transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// Ethereum Handler with Production-Ready Features
export class EthereumHandler extends BlockchainBase {
  protected network = 'ethereum';
  protected rpcEndpoints = PUBLIC_API_ENDPOINTS.ethereum;
  private providers: ethers.JsonRpcProvider[] = [];
  private currentProviderIndex = 0;

  constructor() {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers = this.rpcEndpoints.map(endpoint => new ethers.JsonRpcProvider(endpoint));
  }

  private getProvider(): ethers.JsonRpcProvider {
    return this.providers[this.currentProviderIndex % this.providers.length];
  }

  async generateAddress(): Promise<WalletAddress> {
    try {
      // Generate new Ethereum wallet
      const wallet = ethers.Wallet.createRandom();
      
      this.logOperation('generate_address', { 
        address: wallet.address,
        network: 'ethereum'
      });
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey,
        derivationPath: wallet.path || "m/44'/60'/0'/0/0"
      };
      
    } catch (error) {
      throw this.handleError(error, 'generate Ethereum address');
    }
  }

  async monitorAddress(
    address: string, 
    expectedAmount: number, 
    tokenSymbol: string = 'ETH'
  ): Promise<BlockchainTransaction | null> {
    try {
      const provider = this.getProvider();
      
      if (tokenSymbol === 'ETH') {
        // Monitor ETH transactions
        const balance = await provider.getBalance(address);
        const balanceInEth = parseFloat(ethers.formatEther(balance));
        
        if (balanceInEth >= expectedAmount * 0.95) {
          return {
            txHash: `eth_monitor_${Date.now()}`,
            from: 'unknown',
            to: address,
            amount: balanceInEth.toString(),
            confirmations: 1,
            status: 'confirmed',
            networkFee: '0.001'
          };
        }
      } else {
        // Monitor ERC-20 token transactions
        const contractAddress = ERC20_CONTRACTS[tokenSymbol as keyof typeof ERC20_CONTRACTS];
        if (!contractAddress) {
          throw new Error(`Unsupported token: ${tokenSymbol}`);
        }
        
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const decimals = ERC20_DECIMALS[tokenSymbol as keyof typeof ERC20_DECIMALS];
        const balance = await contract.balanceOf(address);
        const balanceInTokens = parseFloat(ethers.formatUnits(balance, decimals));
        
        if (balanceInTokens >= expectedAmount * 0.95) {
          return {
            txHash: `token_monitor_${Date.now()}`,
            from: 'unknown',
            to: address,
            amount: balanceInTokens.toString(),
            confirmations: 1,
            status: 'confirmed',
            networkFee: '0.001'
          };
        }
      }
      
      return null;
      
    } catch (error) {
      throw this.handleError(error, 'monitor Ethereum address');
    }
  }

  async sendTransaction(
    from: WalletAddress,
    to: string,
    amount: string,
    options?: { tokenSymbol?: string; gasPrice?: bigint }
  ): Promise<BlockchainTransaction> {
    try {
      const provider = this.getProvider();
      const wallet = new ethers.Wallet(from.privateKey!, provider);
      
      let txHash: string;
      
      if (!options?.tokenSymbol || options.tokenSymbol === 'ETH') {
        // Send ETH
        const tx = await wallet.sendTransaction({
          to,
          value: ethers.parseEther(amount),
          gasPrice: options?.gasPrice
        });
        txHash = tx.hash;
      } else {
        // Send ERC-20 token
        const contractAddress = ERC20_CONTRACTS[options.tokenSymbol as keyof typeof ERC20_CONTRACTS];
        if (!contractAddress) {
          throw new Error(`Unsupported token: ${options.tokenSymbol}`);
        }
        
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, wallet);
        const decimals = ERC20_DECIMALS[options.tokenSymbol as keyof typeof ERC20_DECIMALS];
        const tokenAmount = ethers.parseUnits(amount, decimals);
        
        const tx = await contract.transfer(to, tokenAmount);
        txHash = tx.hash;
      }
      
      this.logOperation('send_transaction', {
        from: from.address,
        to,
        amount,
        txHash,
        tokenSymbol: options?.tokenSymbol || 'ETH'
      });
      
      return {
        txHash,
        from: from.address,
        to,
        amount,
        confirmations: 0,
        status: 'pending',
        networkFee: '0.001'
      };
      
    } catch (error) {
      throw this.handleError(error, 'send Ethereum transaction');
    }
  }

  async estimateFee(_amount: string, priority: 'low' | 'medium' | 'high'): Promise<string> {
    try {
      const provider = this.getProvider();
      const feeData = await provider.getFeeData();
      
      const priorityMultiplier = {
        low: 0.8,
        medium: 1.0,
        high: 1.5
      };
      
      const gasPrice = feeData.gasPrice || 20000000000n; // 20 gwei fallback
      const adjustedGasPrice = BigInt(Math.floor(Number(gasPrice) * priorityMultiplier[priority]));
      const gasLimit = 21000n; // Standard ETH transfer
      
      const feeInWei = adjustedGasPrice * gasLimit;
      const feeInEth = ethers.formatEther(feeInWei);
      
      return feeInEth;
      
    } catch (error) {
      throw this.handleError(error, 'estimate Ethereum fee');
    }
  }

  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    try {
      const provider = this.getProvider();
      const tx = await provider.getTransaction(txHash);
      
      if (!tx) {
        return null;
      }
      
      const receipt = await provider.getTransactionReceipt(txHash);
      const confirmations = receipt ? await receipt.confirmations() : 0;
      
      return {
        txHash,
        from: tx.from,
        to: tx.to || 'contract_creation',
        amount: ethers.formatEther(tx.value),
        confirmations,
        status: confirmations > 0 ? 'confirmed' : 'pending',
        networkFee: ethers.formatEther(tx.gasPrice * tx.gasLimit)
      };
      
    } catch (error) {
      throw this.handleError(error, 'get Ethereum transaction');
    }
  }

  async getBalance(address: string, tokenSymbol: string = 'ETH'): Promise<string> {
    try {
      const provider = this.getProvider();
      
      if (tokenSymbol === 'ETH') {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
      } else {
        const contractAddress = ERC20_CONTRACTS[tokenSymbol as keyof typeof ERC20_CONTRACTS];
        if (!contractAddress) {
          throw new Error(`Unsupported token: ${tokenSymbol}`);
        }
        
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const decimals = ERC20_DECIMALS[tokenSymbol as keyof typeof ERC20_DECIMALS];
        const balance = await contract.balanceOf(address);
        
        return ethers.formatUnits(balance, decimals);
      }
      
    } catch (error) {
      throw this.handleError(error, 'get Ethereum balance');
    }
  }

  async createPayment(payment: Payment): Promise<PaymentInstructions> {
    try {
      // Generate new address for this payment
      const walletAddress = await this.generateAddress();
      
      // Convert fiat amount to ETH using public API
      const cryptoAmount = await this.convertFiatToCrypto(
        payment.amount,
        payment.currency,
        'ETH'
      );
      
      return this.generatePaymentInstructions(payment, walletAddress, cryptoAmount);
      
    } catch (error) {
      throw this.handleError(error, 'create Ethereum payment');
    }
  }

  // Additional utility methods for Ethereum-specific operations
  async getNetworkInfo(): Promise<{
    blockNumber: number;
    gasPrice: bigint;
    networkId: number;
  }> {
    try {
      const provider = this.getProvider();
      const [blockNumber, feeData, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
        provider.getNetwork()
      ]);
      
      return {
        blockNumber,
        gasPrice: feeData.gasPrice || 20000000000n,
        networkId: Number(network.chainId)
      };
      
    } catch (error) {
      throw this.handleError(error, 'get Ethereum network info');
    }
  }
}