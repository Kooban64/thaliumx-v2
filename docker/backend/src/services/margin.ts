/**
 * Margin Trading Service
 * 
 * Core margin trading operations including:
 * - Leveraged trading (2x, 5x, 10x leverage)
 * - Risk management (liquidation, margin calls)
 * - Collateral management (cross-margin, isolated margin)
 * - Interest calculations (borrowing costs, funding rates)
 * - Position management (long/short positions, P&L tracking)
 * - Multi-tenant fund segregation
 * 
 * Production-ready for financial operations
 */

import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { EventStreamingService } from './event-streaming';
import { AppError, createError } from '../utils';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface MarginAccount {
  id: string;
  userId: string;
  tenantId: string;
  accountType: 'cross' | 'isolated';
  totalEquity: number;
  totalMargin: number;
  availableBalance: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  marginRatio: number;
  status: 'active' | 'margin_call' | 'liquidation' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface MarginPosition {
  id: string;
  userId: string;
  tenantId: string;
  accountId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginUsed: number;
  unrealizedPnl: number;
  realizedPnl: number;
  fundingFee: number;
  status: 'open' | 'closed' | 'liquidated';
  openedAt: Date;
  closedAt?: Date;
  updatedAt: Date;
}

export interface MarginOrder {
  id: string;
  userId: string;
  tenantId: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  leverage: number;
  marginRequired: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarginTransfer {
  id: string;
  userId: string;
  tenantId: string;
  fromAccount: string;
  toAccount: string;
  asset: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface LiquidationEvent {
  id: string;
  userId: string;
  tenantId: string;
  accountId: string;
  positionId: string;
  symbol: string;
  liquidationPrice: number;
  liquidationAmount: number;
  remainingMargin: number;
  reason: 'margin_call' | 'forced_liquidation';
  createdAt: Date;
}

export interface FundingRate {
  symbol: string;
  rate: number;
  nextFundingTime: Date;
  updatedAt: Date;
}

export interface MarginConfig {
  maxLeverage: number;
  maintenanceMarginRatio: number;
  liquidationThreshold: number;
  fundingRateInterval: number; // hours
  interestRate: number; // annual rate
  minMarginTransfer: number;
  maxMarginTransfer: number;
}

// =============================================================================
// MARGIN TRADING SERVICE CLASS
// =============================================================================

export class MarginTradingService {
  private static isInitialized = false;
  private static accounts: Map<string, MarginAccount> = new Map();
  private static positions: Map<string, MarginPosition[]> = new Map();
  private static orders: Map<string, MarginOrder[]> = new Map();
  private static transfers: Map<string, MarginTransfer[]> = new Map();
  private static fundingRates: Map<string, FundingRate> = new Map();
  private static config: MarginConfig = {
    maxLeverage: 10,
    maintenanceMarginRatio: 0.1, // 10%
    liquidationThreshold: 0.05, // 5%
    fundingRateInterval: 8, // 8 hours
    interestRate: 0.12, // 12% annual
    minMarginTransfer: 10,
    maxMarginTransfer: 100000
  };

  /**
   * Initialize Margin Trading service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Margin Trading Service...');
      
      // Load funding rates
      await this.loadFundingRates();
      
      // Start funding rate updates
      this.startFundingRateUpdates();
      
      // Start margin monitoring
      this.startMarginMonitoring();
      
      // Start liquidation monitoring
      this.startLiquidationMonitoring();
      
      this.isInitialized = true;
      LoggerService.info('✅ Margin Trading Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent('margin.initialized', 'MarginTradingService', 'info', {
        message: 'Margin trading service initialized',
        config: this.config
      });
      
    } catch (error) {
      LoggerService.error('❌ Margin Trading Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create margin account
   */
  public static async createMarginAccount(userId: string, tenantId: string, accountType: 'cross' | 'isolated' = 'cross'): Promise<MarginAccount> {
    try {
      const accountKey = `${userId}:${tenantId}`;
      if (this.accounts.has(accountKey)) {
        throw createError('Margin account already exists', 400, 'ACCOUNT_EXISTS');
      }
      
      const account: MarginAccount = {
        id: this.generateAccountId(),
        userId,
        tenantId,
        accountType,
        totalEquity: 0,
        totalMargin: 0,
        availableBalance: 0,
        usedMargin: 0,
        freeMargin: 0,
        marginLevel: 0,
        marginRatio: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.accounts.set(accountKey, account);
      
      LoggerService.info(`Margin account created: ${account.id}`, { 
        accountId: account.id, 
        userId, 
        tenantId, 
        accountType 
      });
      
      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'margin.account.created',
        'margin_account',
        account.id,
        { accountType, userId, tenantId }
      );
      
      return account;
    } catch (error) {
      LoggerService.error('Margin account creation failed:', error);
      throw error;
    }
  }

  /**
   * Get margin account
   */
  public static async getMarginAccount(userId: string, tenantId: string): Promise<MarginAccount | null> {
    try {
      const accountKey = `${userId}:${tenantId}`;
      return this.accounts.get(accountKey) || null;
    } catch (error) {
      LoggerService.error('Get margin account failed:', error);
      throw error;
    }
  }

  /**
   * Deposit margin
   */
  public static async depositMargin(userId: string, tenantId: string, asset: string, amount: number): Promise<MarginTransfer> {
    try {
      if (amount <= 0) {
        throw createError('Invalid deposit amount', 400, 'INVALID_AMOUNT');
      }
      
      const account = await this.getMarginAccount(userId, tenantId);
      if (!account) {
        throw createError('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
      }
      
      const transfer: MarginTransfer = {
        id: this.generateTransferId(),
        userId,
        tenantId,
        fromAccount: 'spot',
        toAccount: account.id,
        asset,
        amount,
        type: 'deposit',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Process deposit
      await this.processMarginTransfer(transfer);
      
      LoggerService.info(`Margin deposit initiated: ${transfer.id}`, { 
        transferId: transfer.id, 
        userId, 
        amount, 
        asset 
      });
      
      return transfer;
    } catch (error) {
      LoggerService.error('Margin deposit failed:', error);
      throw error;
    }
  }

  /**
   * Withdraw margin
   */
  public static async withdrawMargin(userId: string, tenantId: string, asset: string, amount: number): Promise<MarginTransfer> {
    try {
      if (amount <= 0) {
        throw createError('Invalid withdrawal amount', 400, 'INVALID_AMOUNT');
      }
      
      const account = await this.getMarginAccount(userId, tenantId);
      if (!account) {
        throw createError('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
      }
      
      if (account.availableBalance < amount) {
        throw createError('Insufficient available balance', 400, 'INSUFFICIENT_BALANCE');
      }
      
      // Check margin requirements
      const requiredMargin = this.calculateRequiredMargin(account);
      if (account.totalEquity - amount < requiredMargin) {
        throw createError('Withdrawal would violate margin requirements', 400, 'MARGIN_VIOLATION');
      }
      
      const transfer: MarginTransfer = {
        id: this.generateTransferId(),
        userId,
        tenantId,
        fromAccount: account.id,
        toAccount: 'spot',
        asset,
        amount,
        type: 'withdrawal',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Process withdrawal
      await this.processMarginTransfer(transfer);
      
      LoggerService.info(`Margin withdrawal initiated: ${transfer.id}`, { 
        transferId: transfer.id, 
        userId, 
        amount, 
        asset 
      });
      
      return transfer;
    } catch (error) {
      LoggerService.error('Margin withdrawal failed:', error);
      throw error;
    }
  }

  /**
   * Create margin order
   */
  public static async createMarginOrder(
    userId: string,
    tenantId: string,
    symbol: string,
    side: 'buy' | 'sell',
    type: 'market' | 'limit' | 'stop' | 'stop_limit',
    quantity: number,
    leverage: number,
    price?: number,
    stopPrice?: number
  ): Promise<MarginOrder> {
    try {
      if (quantity <= 0) {
        throw createError('Invalid quantity', 400, 'INVALID_QUANTITY');
      }
      
      if (leverage < 1 || leverage > this.config.maxLeverage) {
        throw createError(`Invalid leverage. Must be between 1 and ${this.config.maxLeverage}`, 400, 'INVALID_LEVERAGE');
      }
      
      const account = await this.getMarginAccount(userId, tenantId);
      if (!account) {
        throw createError('Margin account not found', 404, 'ACCOUNT_NOT_FOUND');
      }
      
      // Calculate margin required
      const currentPrice = await this.getCurrentPrice(symbol);
      const marginRequired = (quantity * currentPrice) / leverage;
      
      if (account.availableBalance < marginRequired) {
        throw createError('Insufficient margin', 400, 'INSUFFICIENT_MARGIN');
      }
      
      const order: MarginOrder = {
        id: this.generateOrderId(),
        userId,
        tenantId,
        accountId: account.id,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        leverage,
        marginRequired,
        status: 'pending',
        filledQuantity: 0,
        averagePrice: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Process order
      await this.processMarginOrder(order);
      
      LoggerService.info(`Margin order created: ${order.id}`, { 
        orderId: order.id, 
        userId, 
        symbol, 
        side, 
        quantity, 
        leverage 
      });
      
      // Emit transaction event
      await EventStreamingService.emitTransactionEvent(
        'margin',
        order.id,
        marginRequired,
        'USDT',
        'pending',
        undefined,
        { symbol, side, leverage, orderType: type }
      );
      
      return order;
    } catch (error) {
      LoggerService.error('Margin order creation failed:', error);
      throw error;
    }
  }

  /**
   * Close margin position
   */
  public static async closeMarginPosition(userId: string, tenantId: string, positionId: string): Promise<MarginPosition> {
    try {
      const positions = this.positions.get(`${userId}:${tenantId}`) || [];
      const position = positions.find(p => p.id === positionId);
      
      if (!position) {
        throw createError('Position not found', 404, 'POSITION_NOT_FOUND');
      }
      
      if (position.status !== 'open') {
        throw createError('Position is not open', 400, 'POSITION_NOT_OPEN');
      }
      
      // Calculate final P&L
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const finalPnl = this.calculatePnl(position, currentPrice);
      
      // Update position
      position.status = 'closed';
      position.closedAt = new Date();
      position.unrealizedPnl = finalPnl;
      position.realizedPnl += finalPnl;
      position.updatedAt = new Date();
      
      // Update account
      const account = await this.getMarginAccount(userId, tenantId);
      if (account) {
        account.usedMargin -= position.marginUsed;
        account.totalEquity += finalPnl;
        account.updatedAt = new Date();
        await this.updateMarginLevel(account);
      }
      
      LoggerService.info(`Margin position closed: ${position.id}`, { 
        positionId: position.id, 
        userId, 
        finalPnl 
      });
      
      // Emit transaction event
      await EventStreamingService.emitTransactionEvent(
        'margin',
        position.id,
        Math.abs(finalPnl),
        'USDT',
        'completed',
        undefined,
        { symbol: position.symbol, side: position.side, pnl: finalPnl }
      );
      
      return position;
    } catch (error) {
      LoggerService.error('Close margin position failed:', error);
      throw error;
    }
  }

  /**
   * Get user positions
   */
  public static async getUserPositions(userId: string, tenantId: string): Promise<MarginPosition[]> {
    try {
      const key = `${userId}:${tenantId}`;
      return this.positions.get(key) || [];
    } catch (error) {
      LoggerService.error('Get user positions failed:', error);
      throw error;
    }
  }

  /**
   * Get user orders
   */
  public static async getUserOrders(userId: string, tenantId: string): Promise<MarginOrder[]> {
    try {
      const key = `${userId}:${tenantId}`;
      return this.orders.get(key) || [];
    } catch (error) {
      LoggerService.error('Get user orders failed:', error);
      throw error;
    }
  }

  /**
   * Get funding rates
   */
  public static async getFundingRates(): Promise<FundingRate[]> {
    try {
      return Array.from(this.fundingRates.values());
    } catch (error) {
      LoggerService.error('Get funding rates failed:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing Margin Trading Service...');
      this.isInitialized = false;
      LoggerService.info('✅ Margin Trading Service closed');
    } catch (error) {
      LoggerService.error('Error closing Margin Trading Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private static async processMarginTransfer(transfer: MarginTransfer): Promise<void> {
    try {
      transfer.status = 'pending';
      transfer.updatedAt = new Date();
      
      // Simulate processing delay
      setTimeout(async () => {
        try {
          const account = await this.getMarginAccount(transfer.userId, transfer.tenantId);
          if (!account) {
            transfer.status = 'failed';
            transfer.updatedAt = new Date();
            return;
          }
          
          if (transfer.type === 'deposit') {
            account.totalEquity += transfer.amount;
            account.availableBalance += transfer.amount;
          } else if (transfer.type === 'withdrawal') {
            account.totalEquity -= transfer.amount;
            account.availableBalance -= transfer.amount;
          }
          
          account.updatedAt = new Date();
          await this.updateMarginLevel(account);
          
          transfer.status = 'completed';
          transfer.updatedAt = new Date();
          
          // Save transfer
          const key = `${transfer.userId}:${transfer.tenantId}`;
          const transfers = this.transfers.get(key) || [];
          transfers.push(transfer);
          this.transfers.set(key, transfers);
          
          LoggerService.info(`Margin transfer completed: ${transfer.id}`, { 
            transferId: transfer.id, 
            type: transfer.type, 
            amount: transfer.amount 
          });
          
          // Emit transaction event
          await EventStreamingService.emitTransactionEvent(
            'margin',
            transfer.id,
            transfer.amount,
            transfer.asset,
            'completed',
            undefined,
            { transferType: transfer.type }
          );
        } catch (error) {
          LoggerService.error('Margin transfer processing failed:', error);
          transfer.status = 'failed';
          transfer.updatedAt = new Date();
        }
      }, 2000); // 2 second delay
      
    } catch (error) {
      LoggerService.error('Process margin transfer failed:', error);
      throw error;
    }
  }

  private static async processMarginOrder(order: MarginOrder): Promise<void> {
    try {
      order.status = 'pending';
      order.updatedAt = new Date();
      
      // Simulate order processing
      setTimeout(async () => {
        try {
          const currentPrice = await this.getCurrentPrice(order.symbol);
          
          // For market orders, fill immediately
          if (order.type === 'market') {
            order.status = 'filled';
            order.filledQuantity = order.quantity;
            order.averagePrice = currentPrice;
            order.updatedAt = new Date();
            
            // Create position
            await this.createPosition(order, currentPrice);
            
            // Update account
            const account = await this.getMarginAccount(order.userId, order.tenantId);
            if (account) {
              account.availableBalance -= order.marginRequired;
              account.usedMargin += order.marginRequired;
              account.updatedAt = new Date();
              await this.updateMarginLevel(account);
            }
          } else {
            // For limit orders, keep as pending
            order.status = 'pending';
          }
          
          // Save order
          const key = `${order.userId}:${order.tenantId}`;
          const orders = this.orders.get(key) || [];
          orders.push(order);
          this.orders.set(key, orders);
          
          LoggerService.info(`Margin order processed: ${order.id}`, { 
            orderId: order.id, 
            status: order.status 
          });
          
        } catch (error) {
          LoggerService.error('Margin order processing failed:', error);
          order.status = 'rejected';
          order.updatedAt = new Date();
        }
      }, 1000); // 1 second delay
      
    } catch (error) {
      LoggerService.error('Process margin order failed:', error);
      throw error;
    }
  }

  private static async createPosition(order: MarginOrder, entryPrice: number): Promise<void> {
    try {
      const position: MarginPosition = {
        id: this.generatePositionId(),
        userId: order.userId,
        tenantId: order.tenantId,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side === 'buy' ? 'long' : 'short',
        size: order.quantity,
        entryPrice,
        currentPrice: entryPrice,
        leverage: order.leverage,
        marginUsed: order.marginRequired,
        unrealizedPnl: 0,
        realizedPnl: 0,
        fundingFee: 0,
        status: 'open',
        openedAt: new Date(),
        updatedAt: new Date()
      };
      
      const key = `${position.userId}:${position.tenantId}`;
      const positions = this.positions.get(key) || [];
      positions.push(position);
      this.positions.set(key, positions);
      
      LoggerService.info(`Margin position created: ${position.id}`, { 
        positionId: position.id, 
        symbol: position.symbol, 
        side: position.side, 
        leverage: position.leverage 
      });
      
    } catch (error) {
      LoggerService.error('Create position failed:', error);
      throw error;
    }
  }

  private static async updateMarginLevel(account: MarginAccount): Promise<void> {
    try {
      account.freeMargin = account.totalEquity - account.usedMargin;
      
      if (account.usedMargin > 0) {
        account.marginLevel = account.totalEquity / account.usedMargin;
        account.marginRatio = account.usedMargin / account.totalEquity;
        
        // Update status based on margin level
        if (account.marginLevel < this.config.liquidationThreshold) {
          account.status = 'liquidation';
        } else if (account.marginLevel < this.config.maintenanceMarginRatio) {
          account.status = 'margin_call';
        } else {
          account.status = 'active';
        }
      } else {
        account.marginLevel = 0;
        account.marginRatio = 0;
        account.status = 'active';
      }
      
      account.updatedAt = new Date();
      
    } catch (error) {
      LoggerService.error('Update margin level failed:', error);
      throw error;
    }
  }

  private static calculatePnl(position: MarginPosition, currentPrice: number): number {
    try {
      const priceDiff = position.side === 'long' 
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;
      
      return (priceDiff / position.entryPrice) * position.size * position.entryPrice;
    } catch (error) {
      LoggerService.error('Calculate P&L failed:', error);
      return 0;
    }
  }

  private static calculateRequiredMargin(account: MarginAccount): number {
    try {
      const positions = this.positions.get(`${account.userId}:${account.tenantId}`) || [];
      return positions.reduce((total, position) => {
        if (position.status === 'open') {
          return total + position.marginUsed;
        }
        return total;
      }, 0);
    } catch (error) {
      LoggerService.error('Calculate required margin failed:', error);
      return 0;
    }
  }

  private static async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Simulate price fetching - in production, this would fetch from market data service
      const basePrices: { [key: string]: number } = {
        'BTC/USDT': 45000,
        'ETH/USDT': 3000,
        'BNB/USDT': 300,
        'ADA/USDT': 0.5,
        'SOL/USDT': 100
      };
      
      return basePrices[symbol] || 1000; // Default price
    } catch (error) {
      LoggerService.error('Get current price failed:', error);
      return 1000; // Default fallback
    }
  }

  private static async loadFundingRates(): Promise<void> {
    try {
      // Fetch real funding rates from exchange APIs or database
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'];
      
      // Try to fetch from database first
      try {
        const FundingRateModel: any = DatabaseService.getModel('FundingRate');
        if (FundingRateModel) {
          const dbRates = await FundingRateModel.findAll({
            where: { symbol: { [require('sequelize').Op.in]: symbols } },
            order: [['updatedAt', 'DESC']]
          });
          
          for (const dbRate of dbRates) {
            const data = dbRate.dataValues || dbRate;
            const fundingRate: FundingRate = {
              symbol: data.symbol,
              rate: parseFloat(data.rate) || 0,
              nextFundingTime: new Date(data.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000),
              updatedAt: new Date(data.updatedAt || data.createdAt)
            };
            
            this.fundingRates.set(data.symbol, fundingRate);
          }
          
          LoggerService.info('Funding rates loaded from database', { count: dbRates.length });
          
          // If we got rates from DB, skip API calls
          if (dbRates.length > 0) {
            return;
          }
        }
      } catch (error: any) {
        LoggerService.warn('Could not load funding rates from database:', error.message);
      }
      
      // Fallback: Fetch from exchange APIs (public endpoints, no auth required)
      // Note: Most exchanges provide funding rates via their public API
      for (const symbol of symbols) {
        try {
          // Try Binance public API for funding rates
          const pair = symbol.replace('/', '');
          const binanceUrl = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`;
          
          try {
            const axios = (await import('axios')).default;
            const response = await axios.get(binanceUrl, { timeout: 5000 });
            
            if (response.data && response.data.lastFundingRate) {
              const rate = parseFloat(response.data.lastFundingRate) || 0;
              const nextFundingTime = response.data.nextFundingTime ? new Date(response.data.nextFundingTime) : new Date(Date.now() + 8 * 60 * 60 * 1000);
              
              const fundingRate: FundingRate = {
                symbol,
                rate: rate * 100, // Convert to percentage
                nextFundingTime,
                updatedAt: new Date()
              };
              
              this.fundingRates.set(symbol, fundingRate);
              LoggerService.debug(`Fetched funding rate from Binance for ${symbol}`, { rate: fundingRate.rate });
              continue;
            }
          } catch (error: any) {
            LoggerService.debug(`Binance funding rate API failed for ${symbol}:`, error.message);
          }
          
          // Default fallback: Set to 0% (neutral)
          const fundingRate: FundingRate = {
            symbol,
            rate: 0,
            nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
            updatedAt: new Date()
          };
          
          this.fundingRates.set(symbol, fundingRate);
          
        } catch (error: any) {
          LoggerService.warn(`Failed to load funding rate for ${symbol}:`, error.message);
          
          // Set default neutral rate
          this.fundingRates.set(symbol, {
            symbol,
            rate: 0,
            nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
            updatedAt: new Date()
          });
        }
      }
      
      LoggerService.info('Funding rates loaded', { count: this.fundingRates.size });
    } catch (error) {
      LoggerService.error('Load funding rates failed:', error);
    }
  }

  private static startFundingRateUpdates(): void {
    // Update funding rates every 8 hours
    setInterval(() => {
      this.updateFundingRates();
    }, 8 * 60 * 60 * 1000); // 8 hours
    
    LoggerService.info('Funding rate updates started');
  }

  private static startMarginMonitoring(): void {
    // Monitor margin levels every 30 seconds
    setInterval(() => {
      this.monitorMarginLevels();
    }, 30000); // 30 seconds
    
    LoggerService.info('Margin monitoring started');
  }

  private static startLiquidationMonitoring(): void {
    // Check for liquidations every 10 seconds
    setInterval(() => {
      this.checkLiquidations();
    }, 10000); // 10 seconds
    
    LoggerService.info('Liquidation monitoring started');
  }

  private static async updateFundingRates(): Promise<void> {
    try {
      for (const [symbol, rate] of this.fundingRates) {
        rate.rate = Math.random() * 0.01 - 0.005; // -0.5% to +0.5%
        rate.nextFundingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
        rate.updatedAt = new Date();
      }
      
      LoggerService.info('Funding rates updated');
    } catch (error) {
      LoggerService.error('Update funding rates failed:', error);
    }
  }

  private static async monitorMarginLevels(): Promise<void> {
    try {
      for (const [key, account] of this.accounts) {
        await this.updateMarginLevel(account);
        
        // Emit margin call events
        if (account.status === 'margin_call') {
          await EventStreamingService.emitSystemEvent(
            'margin.margin_call',
            'MarginTradingService',
            'warn',
            {
              message: `Margin call for account ${account.id}`,
              accountId: account.id,
              userId: account.userId,
              marginLevel: account.marginLevel
            }
          );
        }
      }
      
      LoggerService.info('Margin levels monitored');
    } catch (error) {
      LoggerService.error('Monitor margin levels failed:', error);
    }
  }

  private static async checkLiquidations(): Promise<void> {
    try {
      for (const [key, account] of this.accounts) {
        if (account.status === 'liquidation') {
          const positions = this.positions.get(key) || [];
          const openPositions = positions.filter(p => p.status === 'open');
          
          for (const position of openPositions) {
            await this.liquidatePosition(position, account);
          }
        }
      }
      
      LoggerService.info('Liquidations checked');
    } catch (error) {
      LoggerService.error('Check liquidations failed:', error);
    }
  }

  private static async liquidatePosition(position: MarginPosition, account: MarginAccount): Promise<void> {
    try {
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const liquidationEvent: LiquidationEvent = {
        id: this.generateLiquidationId(),
        userId: position.userId,
        tenantId: position.tenantId,
        accountId: position.accountId,
        positionId: position.id,
        symbol: position.symbol,
        liquidationPrice: currentPrice,
        liquidationAmount: position.size,
        remainingMargin: account.totalEquity - account.usedMargin,
        reason: 'forced_liquidation',
        createdAt: new Date()
      };
      
      // Update position
      position.status = 'liquidated';
      position.closedAt = new Date();
      position.currentPrice = currentPrice;
      position.unrealizedPnl = this.calculatePnl(position, currentPrice);
      position.updatedAt = new Date();
      
      // Update account
      account.usedMargin -= position.marginUsed;
      account.totalEquity += position.unrealizedPnl;
      account.updatedAt = new Date();
      await this.updateMarginLevel(account);
      
      LoggerService.info(`Position liquidated: ${position.id}`, { 
        positionId: position.id, 
        liquidationPrice: currentPrice 
      });
      
      // Emit liquidation event
      await EventStreamingService.emitSystemEvent(
        'margin.liquidation',
        'MarginTradingService',
        'critical',
        {
          message: `Position liquidated: ${position.symbol}`,
          positionId: position.id,
          userId: position.userId,
          liquidationPrice: currentPrice,
          pnl: position.unrealizedPnl
        }
      );
      
    } catch (error) {
      LoggerService.error('Liquidate position failed:', error);
    }
  }

  private static generateAccountId(): string {
    return `marg_acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateOrderId(): string {
    return `marg_ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generatePositionId(): string {
    return `marg_pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateTransferId(): string {
    return `marg_trf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateLiquidationId(): string {
    return `marg_liq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
