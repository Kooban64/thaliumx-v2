import { buildConfig, resetConfig, validateConfig } from './index';

type EnvSnapshot = NodeJS.ProcessEnv;

const ORIGINAL_ENV: EnvSnapshot = { ...process.env };

function setMinimalRequiredEnv(): void {
  process.env['DATABASE_PASSWORD'] = 'test-password';
}

describe('buildConfig', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    resetConfig();
    setMinimalRequiredEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    resetConfig();
  });

  it('uses default providers and optional websocket URLs only when non-empty', () => {
    process.env['ETH_WS_URL'] = 'wss://eth.example/ws';
    process.env['POLYGON_WS_URL'] = '   ';

    const config = buildConfig();

    expect(config.blockchain.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chainId: 1,
          name: 'Ethereum Mainnet',
          rpcUrl: 'https://eth.llamarpc.com',
          wsUrl: 'wss://eth.example/ws',
        }),
        expect.objectContaining({
          chainId: 137,
          name: 'Polygon',
          rpcUrl: 'https://polygon.llamarpc.com',
        }),
      ])
    );

    const polygonProvider = config.blockchain.providers.find(provider => provider.chainId === 137);
    expect(polygonProvider).toBeDefined();
    expect(polygonProvider).not.toHaveProperty('wsUrl');
  });

  it('rejects invalid provider JSON entries', () => {
    process.env['BLOCKCHAIN_PROVIDERS'] = JSON.stringify([
      {
        chainId: '1',
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://eth.llamarpc.com',
      },
    ]);

    expect(() => buildConfig()).toThrow('BLOCKCHAIN_PROVIDERS[0].chainId must be an integer');
  });
});

describe('validateConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetConfig();
    setMinimalRequiredEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    resetConfig();
  });

  it('reports invalid threshold ordering and missing external screening api key', () => {
    const config = buildConfig();
    config.riskThresholds.low = 60;
    config.riskThresholds.medium = 50;
    config.contentScreening.provider = 'external';
    config.contentScreening.apiKey = '';

    expect(validateConfig(config)).toEqual(
      expect.arrayContaining([
        'Low risk threshold must be less than medium',
        'Content screening API key is required for external providers',
      ])
    );
  });
});
