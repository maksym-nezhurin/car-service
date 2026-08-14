import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CatalogAdminGuard } from './catalog-admin.guard';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  const header = (name: string) => headers[name.toLowerCase()];
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header }),
    }),
  } as unknown as ExecutionContext;
}

describe('CatalogAdminGuard', () => {
  const guard = new CatalogAdminGuard();
  const originalSecret = process.env.GATEWAY_INTERNAL_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.GATEWAY_INTERNAL_SECRET;
    } else {
      process.env.GATEWAY_INTERNAL_SECRET = originalSecret;
    }
  });

  describe('without GATEWAY_INTERNAL_SECRET configured (local dev)', () => {
    beforeEach(() => {
      delete process.env.GATEWAY_INTERNAL_SECRET;
    });

    it('allows a request carrying the ADMIN role', () => {
      expect(guard.canActivate(contextWithHeaders({ 'x-user-roles': 'USER,ADMIN' }))).toBe(true);
    });

    it('allows a request carrying the SUPER_ADMIN role', () => {
      expect(guard.canActivate(contextWithHeaders({ 'x-user-roles': 'SUPER_ADMIN' }))).toBe(true);
    });

    it('rejects a request with no admin role', () => {
      expect(() => guard.canActivate(contextWithHeaders({ 'x-user-roles': 'USER' }))).toThrow(
        ForbiddenException,
      );
    });

    it('rejects a request with no roles header at all', () => {
      expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(ForbiddenException);
    });
  });

  describe('with GATEWAY_INTERNAL_SECRET configured', () => {
    beforeEach(() => {
      process.env.GATEWAY_INTERNAL_SECRET = 'test-secret';
    });

    it('allows a request with the correct secret and an admin role', () => {
      expect(
        guard.canActivate(
          contextWithHeaders({
            'x-internal-gateway-secret': 'test-secret',
            'x-user-roles': 'ADMIN',
          }),
        ),
      ).toBe(true);
    });

    it('rejects a forged admin role without the matching internal secret', () => {
      // The exact scenario this guard exists for: someone hitting car-service directly
      // and forging x-user-roles without ever going through the gateway's JWT check.
      expect(() =>
        guard.canActivate(contextWithHeaders({ 'x-user-roles': 'ADMIN' })),
      ).toThrow(ForbiddenException);
    });

    it('rejects a wrong secret even with an admin role', () => {
      expect(() =>
        guard.canActivate(
          contextWithHeaders({
            'x-internal-gateway-secret': 'wrong-secret',
            'x-user-roles': 'ADMIN',
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('rejects the correct secret without an admin role', () => {
      expect(() =>
        guard.canActivate(
          contextWithHeaders({
            'x-internal-gateway-secret': 'test-secret',
            'x-user-roles': 'USER',
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
