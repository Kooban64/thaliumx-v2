// Mock dependencies
jest.mock('../../services/blnkfinance', () => ({
  BlnkFinanceService: {
    recordTransaction: jest.fn().mockResolvedValue({ id: 'transaction-123' }),
    createAccount: jest.fn().mockResolvedValue({ id: 'account-123' }),
    getAccountBalance: jest.fn().mockResolvedValue({ balance: 1000 }),
    processPayment: jest.fn().mockResolvedValue({ id: 'payment-123' })
  },
  TransactionType: {
    MARGIN_CALL: 'MARGIN_CALL',
    DEPOSIT: 'DEPOSIT',
    WITHDRAWAL: 'WITHDRAWAL'
  }
}));
jest.mock('../../services/omni-exchange');
jest.mock('../../services/database', () => ({
  DatabaseService: {
    getModel: jest.fn((name: string) => {
      // Return a mock model for any model name
      return {
        name,
        create: jest.fn().mockResolvedValue({ id: 'mock-id', get: jest.fn((key: string) => key) }),
        findOne: jest.fn().mockResolvedValue(null),
        findAll: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue([1]),
        destroy: jest.fn().mockResolvedValue(1)
      };
    }),
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true)
  }
}));

describe('AdvancedMarginTradingService', () => {
  let AdvancedMarginTradingService: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    // With `resetModules: true` in Jest config, importing the service inside the test
    // ensures mocks are applied consistently.
    const mod = await import('../../services/advanced-margin');
    AdvancedMarginTradingService = mod.AdvancedMarginTradingService;

    // Reset service state
    AdvancedMarginTradingService.accounts = new Map();
    AdvancedMarginTradingService.positions = new Map();
    AdvancedMarginTradingService.orders = new Map();
    AdvancedMarginTradingService.transfers = new Map();
    AdvancedMarginTradingService.liquidations = new Map();
    AdvancedMarginTradingService.riskLimits = new Map();
    AdvancedMarginTradingService.fundingRates = new Map();
  });

  describe('createMarginAccount', () => {
    it('should create margin account successfully', async () => {
      const result = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 1000 }
      );

      expect(result).toHaveProperty('id');
      expect(result.userId).toBe('user-123');
      expect(result.accountType).toBe('cross');
      expect(result.totalEquity).toBe(1000);
      expect(result.marginLevel).toBe(0); // No positions, so 0%
    });

    it('should validate required fields', async () => {
      await expect(AdvancedMarginTradingService.createMarginAccount('', '', '', 'cross'))
        .rejects.toThrow();
    });
  });

  describe('createMarginPosition', () => {
    it('should create long position successfully', async () => {
      // Setup account first
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 10000 }
      );

      const result = await AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        5,
        'market'
      );

      expect(result).toHaveProperty('id');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe('long');
      expect(result.leverage).toBe(5);
      expect(result.status).toBe('open');
    });

    it('should validate leverage limits', async () => {
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 10000 }
      );

      await expect(AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        100, // Too high
        'market'
      )).rejects.toThrow('Invalid leverage');
    });

    it('should check margin requirements', async () => {
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 100 } // Insufficient for position
      );

      await expect(AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        10,
        'market'
      )).rejects.toThrow('Insufficient margin available');
    });
  });

  describe('closeMarginPosition', () => {
    it('should close position and calculate PnL', async () => {
      // Setup account and position
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 10000 }
      );

      const position = await AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        5,
        'market'
      );

      // Mock closing price (profit scenario)
      (AdvancedMarginTradingService as any).getCurrentPrice = jest.fn().mockResolvedValue(50000);

      const result = await AdvancedMarginTradingService.closeMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        position.id
      );

      expect(result.position.status).toBe('closed');
      expect(result.realizedPnl).toBeGreaterThan(0); // Profit
    });

    it('should handle loss scenarios', async () => {
      // Setup account and position
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 10000 }
      );

      const position = await AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        5,
        'market'
      );

      // Mock closing price (loss scenario)
      (AdvancedMarginTradingService as any).getCurrentPrice = jest.fn().mockResolvedValue(27000);

      const result = await AdvancedMarginTradingService.closeMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        position.id
      );

      expect(result.position.status).toBe('closed');
      expect(result.realizedPnl).toBeLessThan(0); // Loss
    });
  });

  describe('liquidatePosition', () => {
    it('should liquidate position when margin level is too low', async () => {
      // Setup account with low balance
      const account = await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 5000 }
      );

      const position = await AdvancedMarginTradingService.createMarginPosition(
        'user-123',
        'tenant-456',
        'broker-789',
        account.id,
        'BTCUSDT',
        'long',
        1,
        10,
        'market'
      );

      // Mock price drop that triggers liquidation
      (AdvancedMarginTradingService as any).getCurrentPrice = jest.fn().mockResolvedValue(25000);

      const result = await AdvancedMarginTradingService.liquidatePosition(position.id, 'forced_liquidation');

      expect(result).toHaveProperty('liquidationPrice');
      expect(result.status).toBe('executed');
    });
  });

  describe('getUserRiskLimits', () => {
    it('should return risk limits for user', async () => {
      const result = await AdvancedMarginTradingService.getUserRiskLimits('user-123', 'tenant-456', 'broker-789');

      expect(result).toHaveProperty('maxLeverage');
      expect(result).toHaveProperty('maxPositionSize');
      expect(result).toHaveProperty('maxDrawdown');
      expect(result).toHaveProperty('maintenanceMarginRatio');
      expect(result).toHaveProperty('liquidationThreshold');
      expect(result).toHaveProperty('marginCallThreshold');
    });
  });

  describe('getUserFundSegregation', () => {
    it('should return fund segregation data', async () => {
      await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 1000 }
      );

      const result = await AdvancedMarginTradingService.getUserFundSegregation('user-123', 'tenant-456', 'broker-789');

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('accountId');
      expect(result).toHaveProperty('userSegregation');
      expect(result.userSegregation).toHaveProperty('userBalance');
    });
  });

  describe('updateUserRiskScore', () => {
    it('should update user risk score', async () => {
      await AdvancedMarginTradingService.createMarginAccount(
        'user-123',
        'tenant-456',
        'broker-789',
        'cross',
        undefined,
        { asset: 'USDT', amount: 1000 }
      );

      await expect(AdvancedMarginTradingService.updateUserRiskScore('user-123', 'tenant-456', 'broker-789', 75))
        .resolves.not.toThrow();
    });

    it('should validate risk score range', async () => {
      await expect(AdvancedMarginTradingService.updateUserRiskScore('user-123', 'tenant-456', 'broker-789', 150))
        .rejects.toThrow('Risk score must be between 0 and 100');
    });
  });

  describe('isHealthy', () => {
    it('should return health status', () => {
      const result = AdvancedMarginTradingService.isHealthy();
      expect(typeof result).toBe('boolean');
    });
  });
});
