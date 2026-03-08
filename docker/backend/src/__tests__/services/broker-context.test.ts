import { resolveBrokerChannelContext, requireMandateScopes } from '../../middleware/broker-context';

describe('broker-context middleware', () => {
  const baseReq = () =>
    ({
      headers: {
        host: 'broker1.thaliumx.com',
        'x-resolved-host': 'broker1.thaliumx.com',
        'x-channel': 'broker',
        'x-broker-id': 'broker-123',
        'x-broker-slug': 'broker1',
      },
      user: {
        userId: 'u1',
        email: 'u@example.com',
        role: 'broker_admin',
        roles: ['broker_admin'],
        tenantId: 'tenant-1',
        permissions: [],
        iat: 1,
        exp: 2,
        channel: 'broker',
        brokerId: 'broker-123',
        brokerSlug: 'broker1',
        mandateScopes: ['trade:place'],
      },
    }) as any;

  beforeEach(() => {
    process.env.AUTH_ALLOWED_HOSTS = 'thaliumx.com,*.thaliumx.com';
    process.env.AUTH_ALLOW_DIRECT_BROKER_CONTEXT = 'false';
  });

  it('resolves valid broker context and normalizes request fields', () => {
    const req = baseReq();
    const next = jest.fn();

    resolveBrokerChannelContext(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.channel).toBe('broker');
    expect(req.brokerId).toBe('broker-123');
    expect(req.brokerSlug).toBe('broker1');
  });

  it('denies on token/header broker mismatch', () => {
    const req = baseReq();
    req.headers['x-broker-id'] = 'different-broker';
    const next = jest.fn();

    resolveBrokerChannelContext(req, {} as any, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeTruthy();
    expect(errorArg.code).toBe('AUTH_CONTEXT_MISMATCH');
  });

  it('enforces mandate scope for broker-role delegated calls', () => {
    const req = baseReq();
    req.authContext = { mandateScopes: ['trade:amend'] };
    const next = jest.fn();

    const middleware = requireMandateScopes(['trade:place']);
    middleware(req, {} as any, next);

    const errorArg = next.mock.calls[0]?.[0];
    expect(errorArg).toBeTruthy();
    expect(errorArg.code).toBe('MANDATE_SCOPE_REQUIRED');
  });
});

