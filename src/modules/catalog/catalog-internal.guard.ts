import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Protects ops-only catalog endpoints (e.g. community-seed export) that must not be
 * anonymously scrapeable when car-service is reachable directly.
 *
 * Auth: shared `GATEWAY_INTERNAL_SECRET` via `x-internal-gateway-secret`.
 * - Secret configured → header must match (gateway attaches it; seed scripts pass it).
 * - Secret unset + non-production → allow (local seed without env friction).
 * - Secret unset + production → deny (fail closed; do not ship an open full-tree dump).
 *
 * Note: when traffic comes through the gateway, the proxy also attaches this secret to
 * every request — so gateway must separately require auth for export paths, otherwise
 * an anonymous `/v1/cars/catalog/export/...` would still succeed. See cars-auth.middleware.
 */
@Injectable()
export class CatalogInternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.GATEWAY_INTERNAL_SECRET?.trim();
    const provided = req.header('x-internal-gateway-secret')?.trim();

    if (expected) {
      if (provided !== expected) {
        throw new ForbiddenException('Internal access required');
      }
      return true;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'GATEWAY_INTERNAL_SECRET must be set to allow catalog internal endpoints in production',
      );
    }

    return true;
  }
}
