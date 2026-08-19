import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Gateway is the real trust boundary: it verifies the caller's JWT, strips any
 * client-supplied x-user-id/x-user-roles, and re-sets x-user-roles only from the
 * verified token (see services/gateway/src/middleware/cars-auth.middleware.ts).
 *
 * This guard adds a second, independent check — a shared secret gateway attaches to
 * every proxied request — so that even if car-service's own URL is ever reachable
 * directly (bypassing the gateway), a caller can't just forge the roles header.
 * GATEWAY_INTERNAL_SECRET unset (local dev) skips that check; role check always applies.
 */
@Injectable()
export class CatalogAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    const expectedSecret = process.env.GATEWAY_INTERNAL_SECRET;
    if (expectedSecret && req.header('x-internal-gateway-secret') !== expectedSecret) {
      throw new ForbiddenException('Admin access required');
    }

    const roles = (req.header('x-user-roles') ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (!roles.some((r) => ADMIN_ROLES.has(r))) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
