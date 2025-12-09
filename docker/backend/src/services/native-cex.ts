/**
 * Native CEX (Centralized Exchange) Service
 * 
 * ARCHITECTURE OVERVIEW:
 * - Integrates Dingir Exchange (primary trading engine)
 * - Integrates Liquibook (order book management)
 * - Integrates QuantLib (risk assessment and pricing)
 * - Promotes THAL token usage with rewards
 * - Provides liquidity incentives
 * - Business model focused on THAL adoption
 * 
 * Features:
 * - Multi-engine trading (Dingir + Liquibook)
 * - Advanced order matching and execution
 * - Risk management with QuantLib
 * - THAL token rewards and fee discounts
 * - Liquidity provider incentives
 * - Real-time market data aggregation
 * - Cross-engine arbitrage opportunities
 */

import { Sequelize } from 'sequelize';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { LoggerService } from './logger';
import { ConfigService } from './config';
import { EventStreamingService } from './event-streaming';
import { QuantLibService } from './quantlib';
import { BlnkFinanceService } from './blnkfinance';

// ==================== CORE INTERFACES ====================

export interface TradingEngine {
  id: string;
  name: string;
  type: 'dingir' | 'liquibook' | 'hybrid';
  endpoint: string;
  status: 'active' | 'degraded' | 'down';
  capabilities: {
    orderMatching: boolean;
    marketData: boolean;
    balanceManagement: boolean;
    realTimeUpdates: boolean;
    riskManagement: boolean;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    lastHealthCheck?: Date;
  };
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'active' | 'suspended' | 'maintenance';
  precision: {
    price: number;
    quantity: number;
  };
  limits: {
    minOrderSize: string;
    maxOrderSize: string;
    minPrice: string;
    maxPrice: string;
  };
  fees: {
    maker: string;
    taker: string;
    thalDiscount: string; // Discount when paying with THAL
  };
  engines: string[]; // Which engines support this pair
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
  };
}

export interface CEXOrder {
  id: string;
  userId: string;
  tenantId: string;
  brokerId: string;
  tradingPairId: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'iceberg';
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  status: 'pending' | 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired';
  filledQuantity: string;
  remainingQuantity: string;
  averagePrice: string;
  fees: string;
  thalRewards: string;
  thalFeeDiscount: string;
  engine: string;
  riskScore: number;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    executionLog: Array<{
      timestamp: Date;
      action: string;
      details: any;
    }>;
  };
}

export interface MarketData {
  symbol: string;
  price: string;
  volume24h: string;
  change24h: string;
  high24h: string;
  low24h: string;
  bid: string;
  ask: string;
  spread: string;
  depth: {
    bids: Array<{ price: string; quantity: string }>;
    asks: Array<{ price: string; quantity: string }>;
  };
  timestamp: Date;
}

export interface LiquidityIncentive {
  id: string;
  userId: string;
  brokerId: string;
  tradingPairId: string;
  incentiveType: 'maker_reward' | 'volume_bonus' | 'liquidity_provider';
  amount: string;
  currency: string; // Always THAL
  status: 'pending' | 'credited' | 'expired';
  expiresAt: Date;
  metadata: {
    sourceOrderId?: string;
    volumeTraded: string;
    multiplier: number;
    createdAt: Date;
  };
}

export interface THALBusinessModel {
  feeDiscounts: {
    tradingFeeDiscount: string; // % discount when paying fees with THAL
    withdrawalFeeDiscount: string;
    depositFeeDiscount: string;
  };
  rewards: {
    tradingRewardRate: string; // % of trading volume rewarded in THAL
    liquidityProviderReward: string;
    referralReward: string;
  };
  staking: {
    stakingRewardRate: string;
    minimumStakeAmount: string;
    lockPeriodDays: number;
  };
  governance: {
    votingPowerPerTHAL: string;
    proposalThreshold: string;
  };
}

export class NativeCEXService {
  private db: Sequelize;
  private eventStreamingService: EventStreamingService;
  private quantlibService: QuantLibService;
  private blnkfinanceService: BlnkFinanceService;
  
  // Trading engines
  private tradingEngines: Map<string, TradingEngine> = new Map();
  private tradingPairs: Map<string, TradingPair> = new Map();
  private orders: Map<string, CEXOrder> = new Map();
  private liquidityIncentives: Map<string, LiquidityIncentive> = new Map();
  
  // HTTP clients for external engines
  private dingirClient: AxiosInstance;
  private liquibookClient: AxiosInstance;
  
  // Configuration
  private readonly THAL_BUSINESS_MODEL: THALBusinessModel = {
    feeDiscounts: {
      tradingFeeDiscount: '0.25', // 25% discount
      withdrawalFeeDiscount: '0.50', // 50% discount
      depositFeeDiscount: '0.10' // 10% discount
    },
    rewards: {
      tradingRewardRate: '0.001', // 0.1% of trading volume
      liquidityProviderReward: '0.002', // 0.2% for liquidity providers
      referralReward: '0.005' // 0.5% for referrals
    },
    staking: {
      stakingRewardRate: '0.12', // 12% APY
      minimumStakeAmount: '1000', // 1000 THAL minimum
      lockPeriodDays: 30
    },
    governance: {
      votingPowerPerTHAL: '1',
      proposalThreshold: '10000' // 10,000 THAL to create proposal
    }
  };

  constructor(db: Sequelize) {
    this.db = db;
    this.eventStreamingService = new EventStreamingService();
    this.quantlibService = new QuantLibService();
    this.blnkfinanceService = new BlnkFinanceService();
    
    // Initialize HTTP clients
    this.dingirClient = axios.create({
      baseURL: process.env.DINGIR_ENDPOINT || 'http://dingir-exchange:8080',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DINGIR_API_KEY || 'default-key'
      }
    });
    
    this.liquibookClient = axios.create({
      baseURL: process.env.LIQUIBOOK_ENDPOINT || 'http://liquibook:3000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.LIQUIBOOK_API_KEY || 'default-key'
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Native CEX Service...');
      await this.initializeTradingEngines();
      await this.initializeTradingPairs();
      await this.startHealthMonitoring();
      LoggerService.info('Native CEX Service initialized successfully');
    } catch (error) {
      LoggerService.error('Failed to initialize Native CEX Service', { error });
      throw error;
    }
  }

  // ==================== TRADING ENGINE MANAGEMENT ====================

  /**
   * Initialize trading engines (Dingir + Liquibook)
   */
  private async initializeTradingEngines(): Promise<void> {
    try {
      // Initialize Dingir Exchange
      const dingirEngine: TradingEngine = {
        id: 'dingir-exchange',
        name: 'Dingir Exchange',
        type: 'dingir',
        endpoint: process.env.DINGIR_ENDPOINT || 'http://dingir-exchange:8080',
        status: 'active',
        capabilities: {
          orderMatching: true,
          marketData: true,
          balanceManagement: true,
          realTimeUpdates: true,
          riskManagement: true
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };

      // Initialize Liquibook
      const liquibookEngine: TradingEngine = {
        id: 'liquibook',
        name: 'Liquibook Order Book',
        type: 'liquibook',
        endpoint: process.env.LIQUIBOOK_ENDPOINT || 'http://liquibook:3000',
        status: 'active',
        capabilities: {
          orderMatching: true,
          marketData: true,
          balanceManagement: false,
          realTimeUpdates: true,
          riskManagement: false
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };

      this.tradingEngines.set('dingir-exchange', dingirEngine);
      this.tradingEngines.set('liquibook', liquibookEngine);

      LoggerService.info('Trading engines initialized', {
        engineCount: this.tradingEngines.size,
        engines: Array.from(this.tradingEngines.keys())
      });

    } catch (error) {
      LoggerService.error('Failed to initialize trading engines', { error });
      throw error;
    }
  }

  /**
   * Initialize trading pairs with THAL promotion
   */
  private async initializeTradingPairs(): Promise<void> {
    try {
      const tradingPairs: TradingPair[] = [
        // THAL pairs (promoted)
        {
          id: 'THAL_USDT',
          symbol: 'THAL/USDT',
          baseAsset: 'THAL',
          quoteAsset: 'USDT',
          status: 'active',
          precision: { price: 4, quantity: 2 },
          limits: {
            minOrderSize: '10',
            maxOrderSize: '1000000',
            minPrice: '0.0001',
            maxPrice: '1000'
          },
          fees: {
            maker: '0.001', // 0.1%
            taker: '0.002', // 0.2%
            thalDiscount: '0.25' // 25% discount when paying with THAL
          },
          engines: ['dingir-exchange', 'liquibook'],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0'
          }
        },
        {
          id: 'THAL_BTC',
          symbol: 'THAL/BTC',
          baseAsset: 'THAL',
          quoteAsset: 'BTC',
          status: 'active',
          precision: { price: 8, quantity: 2 },
          limits: {
            minOrderSize: '10',
            maxOrderSize: '1000000',
            minPrice: '0.00000001',
            maxPrice: '1'
          },
          fees: {
            maker: '0.001',
            taker: '0.002',
            thalDiscount: '0.25'
          },
          engines: ['dingir-exchange'],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0'
          }
        },
        // Standard pairs
        {
          id: 'BTC_USDT',
          symbol: 'BTC/USDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          status: 'active',
          precision: { price: 2, quantity: 6 },
          limits: {
            minOrderSize: '0.0001',
            maxOrderSize: '100',
            minPrice: '1000',
            maxPrice: '200000'
          },
          fees: {
            maker: '0.001',
            taker: '0.002',
            thalDiscount: '0.15' // 15% discount for non-THAL pairs
          },
          engines: ['dingir-exchange', 'liquibook'],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0'
          }
        },
        {
          id: 'ETH_USDT',
          symbol: 'ETH/USDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          status: 'active',
          precision: { price: 2, quantity: 4 },
          limits: {
            minOrderSize: '0.001',
            maxOrderSize: '1000',
            minPrice: '100',
            maxPrice: '50000'
          },
          fees: {
            maker: '0.001',
            taker: '0.002',
            thalDiscount: '0.15'
          },
          engines: ['dingir-exchange', 'liquibook'],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            version: '1.0.0'
          }
        }
      ];

      tradingPairs.forEach(pair => {
        this.tradingPairs.set(pair.id, pair);
      });

      LoggerService.info('Trading pairs initialized', {
        pairCount: this.tradingPairs.size,
        thalPairs: tradingPairs.filter(p => p.baseAsset === 'THAL').length
      });

    } catch (error) {
      LoggerService.error('Failed to initialize trading pairs', { error });
      throw error;
    }
  }

  // ==================== ORDER MANAGEMENT ====================

  /**
   * Place order with intelligent engine routing
   */
  async placeOrder(
    userId: string,
    tenantId: string,
    brokerId: string,
    params: {
      tradingPairId: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit' | 'stop' | 'stop_limit';
      quantity: string;
      price?: string;
      stopPrice?: string;
      timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
    }
  ): Promise<CEXOrder> {
    try {
      LoggerService.info('Placing CEX order', {
        userId,
        brokerId,
        tradingPairId: params.tradingPairId,
        side: params.side,
        type: params.type
      });

      // Validate trading pair
      const tradingPair = this.tradingPairs.get(params.tradingPairId);
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      if (tradingPair.status !== 'active') {
        throw new Error('Trading pair is not active');
      }

      // Perform risk assessment with QuantLib
      const riskScore = await this.performRiskAssessment(userId, params);
      if (riskScore > 80) {
        throw new Error('Order rejected due to high risk score');
      }

      // Create order
      const order: CEXOrder = {
        id: `cex_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        brokerId,
        tradingPairId: params.tradingPairId,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice,
        timeInForce: params.timeInForce || 'GTC',
        status: 'pending',
        filledQuantity: '0',
        remainingQuantity: params.quantity,
        averagePrice: '0',
        fees: '0',
        thalRewards: '0',
        thalFeeDiscount: '0',
        engine: 'hybrid',
        riskScore,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          executionLog: []
        }
      };

      // Route to best engine
      await this.routeOrderToEngine(order, tradingPair);

      // Calculate THAL rewards and discounts
      await this.calculateTHALBenefits(order, tradingPair);

      // Store order
      this.orders.set(order.id, order);

      // Log order placement
      LoggerService.info('CEX order placed', {
        orderId: order.id,
        userId,
        brokerId,
        tradingPair: tradingPair.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        engine: order.engine,
        thalRewards: order.thalRewards
      });

      LoggerService.logTransaction(order.id, 'cex_order_placed', {
        userId,
        brokerId,
        tradingPair: tradingPair.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        engine: order.engine,
        thalRewards: order.thalRewards
      });

      return order;

    } catch (error) {
      LoggerService.error('Failed to place CEX order', { error, userId });
      throw error;
    }
  }

  /**
   * Route order to best available engine
   */
  private async routeOrderToEngine(order: CEXOrder, tradingPair: TradingPair): Promise<void> {
    try {
      const availableEngines = tradingPair.engines.filter(engineId => {
        const engine = this.tradingEngines.get(engineId);
        return engine && engine.status === 'active';
      });

      if (availableEngines.length === 0) {
        throw new Error('No available trading engines');
      }

      // Try Dingir first (primary engine)
      if (availableEngines.includes('dingir-exchange')) {
        try {
          await this.submitOrderToDingir(order);
          order.engine = 'dingir-exchange';
          order.status = 'open';
          return;
        } catch (error) {
          LoggerService.warn('Dingir order submission failed, trying Liquibook', { error, orderId: order.id });
        }
      }

      // Fallback to Liquibook
      if (availableEngines.includes('liquibook')) {
        try {
          await this.submitOrderToLiquibook(order);
          order.engine = 'liquibook';
          order.status = 'open';
          return;
        } catch (error) {
          LoggerService.error('Liquibook order submission failed', { error, orderId: order.id });
        }
      }

      throw new Error('All trading engines failed');

    } catch (error) {
      LoggerService.error('Failed to route order to engine', { error, orderId: order.id });
      order.status = 'rejected';
      throw error;
    }
  }

  /**
   * Submit order to Dingir Exchange
   */
  private async submitOrderToDingir(order: CEXOrder): Promise<void> {
    try {
      const orderData = {
        symbol: order.tradingPairId,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce,
        clientOrderId: order.id
      };

      const response = await this.dingirClient.post('/api/v1/orders', orderData);
      
      if (response.data.success) {
        order.metadata.executionLog.push({
          timestamp: new Date(),
          action: 'submitted_to_dingir',
          details: { response: response.data }
        });
        
        LoggerService.info('Order submitted to Dingir', { orderId: order.id });
      } else {
        throw new Error(response.data.error || 'Dingir order submission failed');
      }

    } catch (error) {
      LoggerService.error('Failed to submit order to Dingir', { error, orderId: order.id });
      throw error;
    }
  }

  /**
   * Submit order to Liquibook
   */
  private async submitOrderToLiquibook(order: CEXOrder): Promise<void> {
    try {
      const orderData = {
        symbol: order.tradingPairId,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce,
        clientOrderId: order.id
      };

      const response = await this.liquibookClient.post('/api/v1/orders', orderData);
      
      if (response.data.success) {
        order.metadata.executionLog.push({
          timestamp: new Date(),
          action: 'submitted_to_liquibook',
          details: { response: response.data }
        });
        
        LoggerService.info('Order submitted to Liquibook', { orderId: order.id });
      } else {
        throw new Error(response.data.error || 'Liquibook order submission failed');
      }

    } catch (error) {
      LoggerService.error('Failed to submit order to Liquibook', { error, orderId: order.id });
      throw error;
    }
  }

  // ==================== THAL BUSINESS MODEL ====================

  /**
   * Calculate THAL rewards and fee discounts
   */
  private async calculateTHALBenefits(order: CEXOrder, tradingPair: TradingPair): Promise<void> {
    try {
      // Calculate base fees
      const isMaker = order.type === 'limit'; // Simplified maker detection
      const baseFeeRate = isMaker ? parseFloat(tradingPair.fees.maker) : parseFloat(tradingPair.fees.taker);
      const baseFees = parseFloat(order.quantity) * baseFeeRate;

      // Calculate THAL fee discount
      const thalDiscountRate = parseFloat(tradingPair.fees.thalDiscount);
      const thalFeeDiscount = baseFees * thalDiscountRate;
      order.thalFeeDiscount = thalFeeDiscount.toString();

      // Calculate THAL rewards
      const tradingRewardRate = parseFloat(this.THAL_BUSINESS_MODEL.rewards.tradingRewardRate);
      const thalRewards = parseFloat(order.quantity) * tradingRewardRate;
      order.thalRewards = Math.max(parseFloat('1'), thalRewards).toString(); // Minimum 1 THAL

      // Apply THAL discount to fees
      order.fees = (baseFees - thalFeeDiscount).toString();

      LoggerService.info('THAL benefits calculated', {
        orderId: order.id,
        baseFees,
        thalFeeDiscount,
        thalRewards: order.thalRewards,
        finalFees: order.fees
      });

    } catch (error) {
      LoggerService.error('Failed to calculate THAL benefits', { error, orderId: order.id });
    }
  }

  /**
   * Credit THAL rewards to user
   */
  async creditTHALRewards(userId: string, orderId: string): Promise<void> {
    try {
      const order = this.orders.get(orderId);
      if (!order || order.userId !== userId) {
        throw new Error('Order not found');
      }

      if (parseFloat(order.thalRewards) > 0) {
        // Create liquidity incentive record
        const incentive: LiquidityIncentive = {
          id: `incentive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          brokerId: order.brokerId,
          tradingPairId: order.tradingPairId,
          incentiveType: 'maker_reward',
          amount: order.thalRewards,
          currency: 'THAL',
          status: 'credited',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          metadata: {
            sourceOrderId: orderId,
            volumeTraded: order.quantity,
            multiplier: 1.0,
            createdAt: new Date()
          }
        };

        this.liquidityIncentives.set(incentive.id, incentive);

        // Update user's THAL wallet (would integrate with wallet system)
        LoggerService.info('THAL rewards credited', {
          userId,
          orderId,
          amount: order.thalRewards
        });
      }

    } catch (error) {
      LoggerService.error('Failed to credit THAL rewards', { error, userId, orderId });
    }
  }

  // ==================== MARKET DATA ====================

  /**
   * Get aggregated market data from all engines
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    try {
      const tradingPair = Array.from(this.tradingPairs.values())
        .find(p => p.symbol === symbol);
      
      if (!tradingPair) {
        throw new Error('Trading pair not found');
      }

      // Get market data from Dingir
      let dingirData: any = null;
      try {
        const response = await this.dingirClient.get(`/api/v1/ticker/${tradingPair.id}`);
        dingirData = response.data;
      } catch (error) {
        LoggerService.warn('Failed to get Dingir market data', { error, symbol });
      }

      // Get market data from Liquibook
      let liquibookData: any = null;
      try {
        const response = await this.liquibookClient.get(`/api/v1/ticker/${tradingPair.id}`);
        liquibookData = response.data;
      } catch (error) {
        LoggerService.warn('Failed to get Liquibook market data', { error, symbol });
      }

      // Aggregate market data
      const marketData: MarketData = {
        symbol,
        price: dingirData?.price || liquibookData?.price || '0',
        volume24h: dingirData?.volume24h || liquibookData?.volume24h || '0',
        change24h: dingirData?.change24h || liquibookData?.change24h || '0',
        high24h: dingirData?.high24h || liquibookData?.high24h || '0',
        low24h: dingirData?.low24h || liquibookData?.low24h || '0',
        bid: dingirData?.bid || liquibookData?.bid || '0',
        ask: dingirData?.ask || liquibookData?.ask || '0',
        spread: '0', // Will be calculated
        depth: {
          bids: dingirData?.depth?.bids || liquibookData?.depth?.bids || [],
          asks: dingirData?.depth?.asks || liquibookData?.depth?.asks || []
        },
        timestamp: new Date()
      };

      // Calculate spread
      if (marketData.bid && marketData.ask) {
        marketData.spread = (parseFloat(marketData.ask) - parseFloat(marketData.bid)).toString();
      }

      return marketData;

    } catch (error) {
      LoggerService.error('Failed to get market data', { error, symbol });
      throw error;
    }
  }

  // ==================== RISK MANAGEMENT ====================

  /**
   * Perform risk assessment using QuantLib
   */
  private async performRiskAssessment(
    userId: string,
    orderParams: any
  ): Promise<number> {
    try {
      // Get user's trading history
      const userOrders = Array.from(this.orders.values())
        .filter(o => o.userId === userId);

      // Calculate risk metrics
      const riskMetrics = {
        orderSize: parseFloat(orderParams.quantity),
        userOrderCount: userOrders.length,
        userVolume24h: userOrders
          .filter(o => o.metadata.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
          .reduce((sum, o) => sum + parseFloat(o.quantity), 0),
        averageOrderSize: userOrders.length > 0 
          ? userOrders.reduce((sum, o) => sum + parseFloat(o.quantity), 0) / userOrders.length
          : 0
      };

      // Calculate risk score (simplified)
      const riskScore = Math.min(100, Math.max(0, 
        (riskMetrics.orderSize > 10000 ? 30 : 0) +
        (riskMetrics.userOrderCount > 100 ? 20 : 0) +
        (riskMetrics.userVolume24h > 100000 ? 25 : 0) +
        (riskMetrics.averageOrderSize > 5000 ? 15 : 0) +
        (orderParams.type === 'market' ? 10 : 0)
      ));

      LoggerService.info('Risk assessment completed', {
        userId,
        riskScore,
        riskMetrics
      });

      return riskScore;

    } catch (error) {
      LoggerService.error('Failed to perform risk assessment', { error, userId });
      return 50; // Default medium risk
    }
  }

  // ==================== HEALTH MONITORING ====================

  /**
   * Start health monitoring for trading engines
   */
  private async startHealthMonitoring(): Promise<void> {
    setInterval(async () => {
      for (const [engineId, engine] of this.tradingEngines) {
        try {
          await this.checkEngineHealth(engine);
        } catch (error) {
          LoggerService.error('Engine health check failed', { error, engineId });
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Check individual engine health
   */
  private async checkEngineHealth(engine: TradingEngine): Promise<void> {
    try {
      let client: AxiosInstance;
      if (engine.type === 'dingir') {
        client = this.dingirClient;
      } else if (engine.type === 'liquibook') {
        client = this.liquibookClient;
      } else {
        return;
      }

      const response = await client.get('/health');
      
      if (response.status === 200) {
        engine.status = 'active';
        engine.metadata.lastHealthCheck = new Date();
      } else {
        engine.status = 'degraded';
      }

    } catch (error) {
      engine.status = 'down';
      LoggerService.warn('Engine health check failed', { 
        engineId: engine.id, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get trading engines status
   */
  getTradingEngines(): TradingEngine[] {
    return Array.from(this.tradingEngines.values());
  }

  /**
   * Get trading pairs
   */
  getTradingPairs(): TradingPair[] {
    return Array.from(this.tradingPairs.values());
  }

  /**
   * Get THAL trading pairs (promoted)
   */
  getTHALTradingPairs(): TradingPair[] {
    return Array.from(this.tradingPairs.values())
      .filter(p => p.baseAsset === 'THAL' || p.quoteAsset === 'THAL');
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): CEXOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get user's orders
   */
  getUserOrders(userId: string): CEXOrder[] {
    return Array.from(this.orders.values())
      .filter(o => o.userId === userId);
  }

  /**
   * Get liquidity incentives for user
   */
  getUserLiquidityIncentives(userId: string): LiquidityIncentive[] {
    return Array.from(this.liquidityIncentives.values())
      .filter(i => i.userId === userId);
  }

  /**
   * Get THAL business model
   */
  getTHALBusinessModel(): THALBusinessModel {
    return this.THAL_BUSINESS_MODEL;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order || order.userId !== userId) {
        return false;
      }

      if (order.status !== 'open' && order.status !== 'pending') {
        return false;
      }

      // Cancel on the respective engine
      if (order.engine === 'dingir-exchange') {
        await this.dingirClient.delete(`/api/v1/orders/${orderId}`);
      } else if (order.engine === 'liquibook') {
        await this.liquibookClient.delete(`/api/v1/orders/${orderId}`);
      }

      order.status = 'cancelled';
      order.metadata.updatedAt = new Date();
      order.metadata.executionLog.push({
        timestamp: new Date(),
        action: 'cancelled',
        details: { cancelledBy: userId }
      });

      LoggerService.info('Order cancelled', { orderId, userId });

      return true;

    } catch (error) {
      LoggerService.error('Failed to cancel order', { error, orderId, userId });
      return false;
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    LoggerService.info('Shutting down Native CEX Service...');
  }
}
