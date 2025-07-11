import { Payment, PaymentRoute } from '../types';
import { RouteEvaluator } from './RouteEvaluator';
import { RouteRegistry } from './RouteRegistry';
import { logger } from '../../utils/logger';

export class SmartRouter {
  private evaluator: RouteEvaluator;
  private registry: RouteRegistry;
  private failedRoutes: Map<string, Set<string>> = new Map(); // paymentId -> failed route IDs

  constructor() {
    this.registry = new RouteRegistry();
    this.evaluator = new RouteEvaluator(this.registry);
  }

  /**
   * Select optimal payment route based on multiple criteria
   */
  async selectRoute(payment: Payment): Promise<PaymentRoute> {
    try {
      // Get customer country from IP or default to AU
      const country = payment.metadata?.country || 'AU';
      
      // Get eligible routes based on payment criteria
      const eligibleRoutes = await this.registry.getRoutesForCriteria(
        payment.amount,
        payment.currency,
        country,
        payment.metadata?.preferredPaymentMethod
      );
      
      if (eligibleRoutes.length === 0) {
        throw new Error('No eligible payment routes available');
      }
      
      // Filter out previously failed routes for this payment
      const failedRoutesForPayment = this.failedRoutes.get(payment.id) || new Set();
      const availableRoutes = eligibleRoutes.filter(
        route => !failedRoutesForPayment.has(route.id)
      );
      
      if (availableRoutes.length === 0) {
        throw new Error('All payment routes have been exhausted');
      }
      
      // Score all available routes
      const scoredRoutes = await Promise.all(
        availableRoutes.map(async (route) => ({
          route,
          score: await this.evaluator.scoreRoute(route, payment)
        }))
      );
      
      // Sort by score (highest first)
      scoredRoutes.sort((a, b) => b.score - a.score);
      
      // Log route selection
      logger.info('Route selection completed', {
        paymentId: payment.id,
        selectedRoute: scoredRoutes[0].route.id,
        score: scoredRoutes[0].score,
        alternatives: scoredRoutes.slice(1, 3).map(r => ({
          route: r.route.id,
          score: r.score
        }))
      });
      
      return scoredRoutes[0].route;
      
    } catch (error: any) {
      logger.error('Route selection failed', {
        paymentId: payment.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Failover to next best route after a failure
   */
  async failover(payment: Payment, failedRoute: PaymentRoute): Promise<PaymentRoute> {
    try {
      // Mark route as failed for this payment
      if (!this.failedRoutes.has(payment.id)) {
        this.failedRoutes.set(payment.id, new Set());
      }
      this.failedRoutes.get(payment.id)!.add(failedRoute.id);
      
      // Update route metrics with failure
      await this.registry.updateRouteMetrics(failedRoute.id, false);
      
      // If too many failures, mark route as temporarily unavailable
      const metrics = await this.registry.getRouteMetrics(failedRoute.id);
      if (metrics.successRate < 0.7 && metrics.totalVolume > 5) {
        await this.registry.markRouteUnavailable(failedRoute.id, 600); // 10 min cooldown
      }
      
      // Select next best route
      const nextRoute = await this.selectRoute(payment);
      
      logger.info('Failover completed', {
        paymentId: payment.id,
        failedRoute: failedRoute.id,
        nextRoute: nextRoute.id
      });
      
      return nextRoute;
      
    } catch (error: any) {
      logger.error('Failover failed', {
        paymentId: payment.id,
        failedRoute: failedRoute.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get route recommendation with explanation
   */
  async getRouteRecommendation(payment: Payment): Promise<{
    route: PaymentRoute;
    reason: string;
    alternatives: Array<{ route: PaymentRoute; reason: string }>;
  }> {
    const route = await this.selectRoute(payment);
    const reason = await this.evaluator.getRouteRecommendationReason(route, payment);
    
    // Get alternatives
    const country = payment.metadata?.country || 'AU';
    const eligibleRoutes = await this.registry.getRoutesForCriteria(
      payment.amount,
      payment.currency,
      country
    );
    
    const alternatives = await Promise.all(
      eligibleRoutes
        .filter(r => r.id !== route.id)
        .slice(0, 2)
        .map(async (altRoute) => ({
          route: altRoute,
          reason: await this.evaluator.getRouteRecommendationReason(altRoute, payment)
        }))
    );
    
    return { route, reason, alternatives };
  }

  /**
   * Validate if a specific route can handle a payment
   */
  async validateRoute(routeId: string, payment: Payment): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const route = await this.registry.getRouteById(routeId);
    
    if (!route) {
      return { valid: false, reason: 'Route not found' };
    }
    
    if (!route.isActive) {
      return { valid: false, reason: 'Route is not active' };
    }
    
    if (payment.amount < route.limits.minAmount) {
      return { 
        valid: false, 
        reason: `Amount below minimum (${route.limits.minAmount} ${payment.currency})` 
      };
    }
    
    if (payment.amount > route.limits.maxAmount) {
      return { 
        valid: false, 
        reason: `Amount above maximum (${route.limits.maxAmount} ${payment.currency})` 
      };
    }
    
    if (!route.capabilities.currencies.includes(payment.currency)) {
      return { valid: false, reason: 'Currency not supported' };
    }
    
    if (!route.capabilities.cryptoCurrencies.includes(payment.cryptoCurrency)) {
      return { valid: false, reason: 'Crypto currency not supported' };
    }
    
    return { valid: true };
  }

  /**
   * Get all available routes for display/selection
   */
  async getAvailableRoutes(criteria: {
    amount?: number;
    currency?: string;
    country?: string;
  }): Promise<Array<{
    route: PaymentRoute;
    available: boolean;
    estimatedFee: number;
    estimatedSettlementTime: number;
  }>> {
    const routes = criteria.amount && criteria.currency && criteria.country
      ? await this.registry.getRoutesForCriteria(
          criteria.amount,
          criteria.currency,
          criteria.country
        )
      : await this.registry.getActiveRoutes();
    
    const routeInfo = await Promise.all(
      routes.map(async (route) => {
        const metrics = await this.registry.getRouteMetrics(route.id);
        const fee = criteria.amount
          ? route.fees.percentage * criteria.amount / 100 + route.fees.fixed
          : route.fees.percentage;
          
        return {
          route,
          available: true,
          estimatedFee: fee,
          estimatedSettlementTime: metrics.averageSettlementTime
        };
      })
    );
    
    return routeInfo;
  }

  /**
   * Clean up failed routes cache for completed payments
   */
  cleanupFailedRoutes(paymentId: string): void {
    this.failedRoutes.delete(paymentId);
  }

  /**
   * Get route statistics for monitoring
   */
  async getRouteStatistics(): Promise<Array<{
    routeId: string;
    type: string;
    provider: string;
    metrics: any;
    status: string;
  }>> {
    const routes = await this.registry.getActiveRoutes();
    
    const statistics = await Promise.all(
      routes.map(async (route) => {
        const metrics = await this.registry.getRouteMetrics(route.id);
        const isAvailable = await this.registry.getRoutesForCriteria(
          100, // Test amount
          'AUD', // Test currency
          'AU' // Test country
        ).then(routes => routes.some(r => r.id === route.id));
        
        return {
          routeId: route.id,
          type: route.type,
          provider: route.provider,
          metrics: {
            successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
            avgSettlementTime: `${Math.round(metrics.averageSettlementTime / 60)} min`,
            totalVolume: metrics.totalVolume,
            lastUpdated: metrics.lastUpdated
          },
          status: isAvailable ? 'available' : 'unavailable'
        };
      })
    );
    
    return statistics;
  }
}