import { Payment, PaymentRoute, RouteMetrics } from '../types';
import { RouteRegistry } from './RouteRegistry';

export class RouteEvaluator {
  private registry: RouteRegistry;
  
  // Scoring weights
  private readonly WEIGHT_SUCCESS_RATE = 0.35;
  private readonly WEIGHT_SETTLEMENT_SPEED = 0.25;
  private readonly WEIGHT_FEES = 0.20;
  private readonly WEIGHT_FEATURES = 0.10;
  private readonly WEIGHT_VOLUME = 0.10;

  constructor(registry: RouteRegistry) {
    this.registry = registry;
  }

  /**
   * Score a route based on multiple factors
   * Returns score 0-100
   */
  async scoreRoute(route: PaymentRoute, payment: Payment): Promise<number> {
    const metrics = await this.registry.getRouteMetrics(route.id);
    
    let score = 0;
    
    // 1. Success Rate Score (0-35 points)
    score += this.calculateSuccessRateScore(metrics) * this.WEIGHT_SUCCESS_RATE;
    
    // 2. Settlement Speed Score (0-25 points)
    score += this.calculateSpeedScore(metrics) * this.WEIGHT_SETTLEMENT_SPEED;
    
    // 3. Fee Score (0-20 points)
    score += this.calculateFeeScore(route, payment) * this.WEIGHT_FEES;
    
    // 4. Feature Match Score (0-10 points)
    score += this.calculateFeatureScore(route, payment) * this.WEIGHT_FEATURES;
    
    // 5. Volume/Reliability Score (0-10 points)
    score += this.calculateVolumeScore(metrics) * this.WEIGHT_VOLUME;
    
    // Apply bonuses/penalties
    score = this.applyModifiers(score, route, payment);
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateSuccessRateScore(metrics: RouteMetrics): number {
    // Higher success rate = higher score
    // 95%+ = 100 points
    // 90-95% = 80 points
    // 80-90% = 60 points
    // 70-80% = 40 points
    // Below 70% = scaled down
    
    const successRate = metrics.successRate;
    
    if (successRate >= 0.95) return 100;
    if (successRate >= 0.90) return 80;
    if (successRate >= 0.80) return 60;
    if (successRate >= 0.70) return 40;
    
    return successRate * 100 * 0.4; // Scale remaining
  }

  private calculateSpeedScore(metrics: RouteMetrics): number {
    // Faster settlement = higher score
    // < 5 min = 100 points
    // 5-15 min = 80 points
    // 15-30 min = 60 points
    // 30-60 min = 40 points
    // > 60 min = 20 points
    
    const avgTime = metrics.averageSettlementTime;
    
    if (avgTime < 300) return 100;        // < 5 minutes
    if (avgTime < 900) return 80;         // < 15 minutes
    if (avgTime < 1800) return 60;        // < 30 minutes
    if (avgTime < 3600) return 40;        // < 60 minutes
    
    return 20;
  }

  private calculateFeeScore(route: PaymentRoute, payment: Payment): number {
    // Lower fees = higher score
    const totalFeePercentage = route.fees.percentage + 
      (route.fees.fixed / payment.amount * 100);
    
    // < 1% = 100 points
    // 1-2% = 80 points
    // 2-3% = 60 points
    // 3-4% = 40 points
    // > 4% = scaled down
    
    if (totalFeePercentage < 1) return 100;
    if (totalFeePercentage < 2) return 80;
    if (totalFeePercentage < 3) return 60;
    if (totalFeePercentage < 4) return 40;
    
    return Math.max(0, 100 - (totalFeePercentage * 20));
  }

  private calculateFeatureScore(route: PaymentRoute, payment: Payment): number {
    let score = 100;
    
    // Check currency match
    if (!route.capabilities.currencies.includes(payment.currency)) {
      return 0; // Should not happen if pre-filtered correctly
    }
    
    // Check crypto currency preference
    if (!route.capabilities.cryptoCurrencies.includes(payment.cryptoCurrency)) {
      score -= 20;
    }
    
    // Check for Australian-specific features for AUD payments
    if (payment.currency === 'AUD') {
      if (route.capabilities.paymentMethods.includes('payid')) {
        score += 10; // Bonus for PayID support
      }
      if (route.capabilities.countries.includes('AU')) {
        score += 10; // Bonus for explicit AU support
      }
    }
    
    // Check for instant settlement feature
    if (route.capabilities.features.includes('instant_settlement')) {
      score += 10;
    }
    
    return Math.min(100, score);
  }

  private calculateVolumeScore(metrics: RouteMetrics): number {
    // More volume = more reliable
    // > 1000 transactions = 100 points
    // 500-1000 = 80 points
    // 100-500 = 60 points
    // 50-100 = 40 points
    // < 50 = scaled
    
    const volume = metrics.totalVolume;
    
    if (volume > 1000) return 100;
    if (volume > 500) return 80;
    if (volume > 100) return 60;
    if (volume > 50) return 40;
    
    return (volume / 50) * 40;
  }

  private applyModifiers(
    baseScore: number, 
    route: PaymentRoute, 
    payment: Payment
  ): number {
    let score = baseScore;
    
    // Blockchain routes are always available and reliable
    if (route.type === 'blockchain') {
      score += 5; // Reliability bonus for direct blockchain
    }
    
    // DEX routes offer better rates for large amounts
    if (route.type === 'dex' && payment.amount > 500) {
      score += 5; // DEX better for larger amounts
    }
    
    // Scraping routes for price discovery
    if (route.type === 'scraping') {
      score += 2; // Market data bonus
    }
    
    // Self-hosted routes for crypto-native customers
    if (route.type === 'selfhosted' && payment.metadata?.cryptoExperienced) {
      score += 10; // Crypto-experienced user bonus
    }
    
    // Large payment preference for blockchain routes
    if (payment.amount > 1000) {
      if (route.type === 'blockchain' || route.type === 'dex') {
        score += 5; // Better for large amounts
      }
    }
    
    // Small payment preference for scraping routes
    if (payment.amount < 100) {
      if (route.type === 'scraping') {
        score += 3; // Good for price checking small amounts
      }
    }
    
    // Australian preference
    if (payment.currency === 'AUD' && route.provider.includes('au')) {
      score += 5; // Local provider bonus
    }
    
    return score;
  }

  /**
   * Compare two routes and return the better one
   */
  async compareRoutes(
    routeA: PaymentRoute, 
    routeB: PaymentRoute, 
    payment: Payment
  ): Promise<PaymentRoute> {
    const scoreA = await this.scoreRoute(routeA, payment);
    const scoreB = await this.scoreRoute(routeB, payment);
    
    return scoreA >= scoreB ? routeA : routeB;
  }

  /**
   * Get route recommendation reason
   */
  async getRouteRecommendationReason(
    route: PaymentRoute, 
    payment: Payment
  ): Promise<string> {
    const metrics = await this.registry.getRouteMetrics(route.id);
    const score = await this.scoreRoute(route, payment);
    
    const reasons: string[] = [];
    
    if (metrics.successRate > 0.95) {
      reasons.push('Excellent success rate');
    }
    
    if (metrics.averageSettlementTime < 900) {
      reasons.push('Fast settlement (< 15 min)');
    }
    
    const totalFeePercentage = route.fees.percentage + 
      (route.fees.fixed / payment.amount * 100);
    if (totalFeePercentage < 2) {
      reasons.push('Low fees');
    }
    
    if (payment.currency === 'AUD' && route.capabilities.paymentMethods.includes('payid')) {
      reasons.push('PayID support');
    }
    
    return reasons.join(', ') || `Score: ${score.toFixed(0)}/100`;
  }
}