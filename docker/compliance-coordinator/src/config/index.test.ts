import { buildConfig, resetConfig, validateConfig } from './index';

type EnvSnapshot = NodeJS.ProcessEnv;

const ORIGINAL_ENV: EnvSnapshot = { ...process.env };

function setMinimalRequiredEnv(): void {
  process.env['CORS_ORIGINS'] = 'http://localhost:3000';
  process.env['KAFKA_BROKERS'] = 'localhost:9092';
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

  it('parses submission endpoints from json and omits blank array values', () => {
    process.env['CORS_ORIGINS'] = 'http://localhost:3000,  ,https://example.com';
    process.env['REGULATORY_SUBMISSION_ENDPOINTS'] = JSON.stringify({
      US: 'https://us.example/submit',
      EU: 'https://eu.example/submit',
    });

    const config = buildConfig();

    expect(config.server.corsOrigins).toEqual(['http://localhost:3000', 'https://example.com']);
    expect(config.regulatory.submissionEndpoints).toEqual({
      US: 'https://us.example/submit',
      EU: 'https://eu.example/submit',
    });
  });

  it('rejects non-object regulatory submission endpoint payloads', () => {
    process.env['REGULATORY_SUBMISSION_ENDPOINTS'] = JSON.stringify(['https://us.example/submit']);

    expect(() => buildConfig()).toThrow(
      'Environment variable REGULATORY_SUBMISSION_ENDPOINTS must be a JSON object'
    );
  });

  it('rejects non-string regulatory submission endpoint values', () => {
    process.env['REGULATORY_SUBMISSION_ENDPOINTS'] = JSON.stringify({
      US: 42,
    });

    expect(() => buildConfig()).toThrow(
      'Environment variable REGULATORY_SUBMISSION_ENDPOINTS must contain only string values. Invalid key: US'
    );
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

  it('reports when all compliance services are disabled', () => {
    const config = buildConfig();
    config.services.cex.enabled = false;
    config.services.dex.enabled = false;
    config.services.nft.enabled = false;
    config.services.token.enabled = false;
    config.services.chainanalysis.enabled = false;

    expect(validateConfig(config)).toContain('At least one compliance service must be enabled');
  });
});
