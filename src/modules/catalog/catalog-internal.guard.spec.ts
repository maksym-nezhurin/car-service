import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CatalogInternalSecretGuard } from './catalog-internal.guard';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  const header = (name: string) => headers[name.toLowerCase()];
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header }),
    }),
  } as unknown as ExecutionContext;
}

describe('CatalogInternalSecretGuard', () => {
  const guard = new CatalogInternalSecretGuard();
  const originalSecret = process.env.GATEWAY_INTERNAL_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.GATEWAY_INTERNAL_SECRET;
    } else {
      process.env.GATEWAY_INTERNAL_SECRET = originalSecret;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('with GATEWAY_INTERNAL_SECRET configured', () => {
    beforeEach(() => {
      process.env.GATEWAY_INTERNAL_SECRET = 'test-secret';
      process.env.NODE_ENV = 'production';
    });

    it('allows a request with the matching secret', () => {
      expect(
        guard.canActivate(
          contextWithHeaders({ 'x-internal-gateway-secret': 'test-secret' }),
        ),
      ).toBe(true);
    });

    it('rejects a missing secret', () => {
      expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(ForbiddenException);
    });

    it('rejects a wrong secret', () => {
      expect(() =>
        guard.canActivate(
          contextWithHeaders({ 'x-internal-gateway-secret': 'wrong' }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('without GATEWAY_INTERNAL_SECRET', () => {
    beforeEach(() => {
      delete process.env.GATEWAY_INTERNAL_SECRET;
    });

    it('allows local/dev so community:seed works without extra env', () => {
      process.env.NODE_ENV = 'development';
      expect(guard.canActivate(contextWithHeaders({}))).toBe(true);
    });

    it('fails closed in production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(ForbiddenException);
    });
  });
});
