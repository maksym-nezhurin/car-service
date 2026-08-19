import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStatsService } from './admin-stats.service';
import { CatalogInternalSecretGuard } from '../catalog/catalog-internal.guard';

/**
 * Internal platform stats for the admin panel, called server-to-server by the gateway
 * (never proxied to browsers). Guarded by the same shared GATEWAY_INTERNAL_SECRET as the
 * catalog community-seed export — this used to be open with only a "don't expose this
 * publicly" comment, which meant anyone who found the URL could read it with no auth at
 * all once car-service got a public Fly domain.
 */
@ApiTags('admin-stats')
@Controller('admin')
@UseGuards(CatalogInternalSecretGuard)
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @ApiOperation({ summary: 'Platform garage & vehicle counts' })
  @Get('stats')
  overview() {
    return this.stats.getOverview();
  }
}
