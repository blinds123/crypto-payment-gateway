import { PaymentRoute, RouteMetrics } from '../types';
import { routesConfig } from '../config/routes.config';
import Redis from 'ioredis';

export class RouteRegistry {
  private routes: Map<string, PaymentRoute> = new Map();
  private metrics: Map<string, RouteMetrics> = new Map();
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Initialize blockchain routes
    Object.entries(routesConfig.blockchain).forEach(([provider, config]) => {
      if ((config as any).enabled) {
        const routeId = `blockchain_${provider}`;
        this.routes.set(routeId, {
          id: routeId,
          type: 'blockchain' as any,
          provider,
          priority: (config as any).priority,
          isActive: true,
          capabilities: (config as any).capabilities,
          limits: (config as any).limits,
          fees: (config as any).fees
        });
      }
    });

    // Initialize DEX routes
    Object.entries(routesConfig.dex).forEach(([provider, config]) => {
      if ((config as any).enabled) {
        const routeId = `dex_${provider}`;
        this.routes.set(routeId, {
          id: routeId,
          type: 'dex' as any,
          provider,
          priority: (config as any).priority,
          isActive: true,
          capabilities: (config as any).capabilities,
          limits: (config as any).limits,
          fees: (config as any).fees
        });
      }
    });

    // Initialize scraping routes
    Object.entries(routesConfig.scraping).forEach(([provider, config]) => {
      if ((config as any).enabled) {
        const routeId = `scraping_${provider}`;
        this.routes.set(routeId, {
          id: routeId,
          type: 'scraping' as any,
          provider,
          priority: (config as any).priority,
          isActive: true,
          capabilities: (config as any).capabilities,
          limits: (config as any).limits,
          fees: (config as any).fees
        });
      }
    });

    // Initialize self-hosted routes
    Object.entries(routesConfig.selfhosted).forEach(([provider, config]) => {
      if ((config as any).enabled) {
        const routeId = `selfhosted_${provider}`;
        this.routes.set(routeId, {
          id: routeId,
          type: 'selfhosted' as any,
          provider,
          priority: (config as any).priority,
          isActive: true,
          capabilities: (config as any).capabilities,
          limits: (config as any).limits,
          fees: (config as any).fees
        });
      }
    });
  }

  async getActiveRoutes(): Promise<PaymentRoute[]> {
    const activeRoutes: PaymentRoute[] = [];
    
    for (const [routeId, route] of this.routes) {
      const isAvailable = await this.checkRouteAvailability(routeId);
      if (isAvailable && route.isActive) {
        activeRoutes.push(route);
      }
    }
    
    return activeRoutes.sort((a, b) => a.priority - b.priority);
  }

  async getRouteById(routeId: string): Promise<PaymentRoute | null> {
    return this.routes.get(routeId) || null;
  }

  async getRoutesByType(type: 'blockchain' | 'dex' | 'scraping' | 'selfhosted'): Promise<PaymentRoute[]> {
    const routes: PaymentRoute[] = [];
    
    for (const route of this.routes.values()) {
      if (route.type === type && route.isActive) {
        const isAvailable = await this.checkRouteAvailability(route.id);
        if (isAvailable) {
          routes.push(route);
        }
      }
    }
    
    return routes.sort((a, b) => a.priority - b.priority);
  }

  async updateRouteMetrics(routeId: string, success: boolean, settlementTime?: number): Promise<void> {
    const metricsKey = `route_metrics:${routeId}`;
    const metrics = await this.getRouteMetrics(routeId);
    
    // Update success rate
    const totalAttempts = metrics.successRate * 100 + 1;
    const successCount = success ? (metrics.successRate * 100) + 1 : metrics.successRate * 100;
    metrics.successRate = successCount / totalAttempts;
    
    // Update average settlement time
    if (success && settlementTime) {
      const totalTime = metrics.averageSettlementTime * (totalAttempts - 1) + settlementTime;
      metrics.averageSettlementTime = totalTime / totalAttempts;
    }
    
    // Update volume
    metrics.totalVolume += 1;
    metrics.lastUpdated = new Date();
    
    // Save to Redis
    await this.redis.set(metricsKey, JSON.stringify(metrics), 'EX', 86400); // 24 hour expiry
    this.metrics.set(routeId, metrics);
  }

  async getRouteMetrics(routeId: string): Promise<RouteMetrics> {
    // Check memory cache first
    if (this.metrics.has(routeId)) {
      return this.metrics.get(routeId)!;
    }
    
    // Check Redis
    const metricsKey = `route_metrics:${routeId}`;
    const cachedMetrics = await this.redis.get(metricsKey);
    
    if (cachedMetrics) {
      const metrics = JSON.parse(cachedMetrics);
      this.metrics.set(routeId, metrics);
      return metrics;
    }
    
    // Return default metrics
    const defaultMetrics: RouteMetrics = {
      routeId,
      successRate: 1.0,
      averageSettlementTime: 900, // 15 minutes default
      totalVolume: 0,
      failureReasons: {},
      lastUpdated: new Date()
    };
    
    this.metrics.set(routeId, defaultMetrics);
    return defaultMetrics;
  }

  private async checkRouteAvailability(routeId: string): Promise<boolean> {
    const availabilityKey = `route_availability:${routeId}`;
    const isUnavailable = await this.redis.get(availabilityKey);
    
    // If marked as unavailable, check if cooldown period has passed
    if (isUnavailable) {
      return false;
    }
    
    // Check if route has too many recent failures
    const metrics = await this.getRouteMetrics(routeId);
    if (metrics.successRate < 0.5 && metrics.totalVolume > 10) {
      // Mark route as temporarily unavailable
      await this.redis.set(availabilityKey, '1', 'EX', 300); // 5 minute cooldown
      return false;
    }
    
    return true;
  }

  async markRouteUnavailable(routeId: string, duration: number = 300): Promise<void> {
    const availabilityKey = `route_availability:${routeId}`;
    await this.redis.set(availabilityKey, '1', 'EX', duration);
  }

  async getRoutesForCriteria(
    amount: number,
    currency: string,
    country: string,
    paymentMethod?: string
  ): Promise<PaymentRoute[]> {
    const eligibleRoutes: PaymentRoute[] = [];
    
    for (const route of await this.getActiveRoutes()) {
      // Check amount limits
      if (amount < route.limits.minAmount || amount > route.limits.maxAmount) {
        continue;
      }
      
      // Check currency support
      if (!route.capabilities.currencies.includes(currency)) {
        continue;
      }
      
      // Check country support
      if (!route.capabilities.countries.includes(country) && 
          !route.capabilities.countries.includes('*')) {
        continue;
      }
      
      // Check payment method if specified
      if (paymentMethod && !route.capabilities.paymentMethods.includes(paymentMethod)) {
        continue;
      }
      
      eligibleRoutes.push(route);
    }
    
    return eligibleRoutes;
  }
}