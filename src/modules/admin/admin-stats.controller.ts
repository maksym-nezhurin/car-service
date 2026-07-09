import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminStatsService } from './admin-stats.service';

/**
 * Wewnętrzne statystyki dla panelu admin (user-service / gateway).
 * Nie wystawiać publicznie bez dodatkowej ochrony sieciowej.
 */
@ApiTags('admin-stats')
@Controller('admin')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @ApiOperation({ summary: 'Platform garage & vehicle counts' })
  @Get('stats')
  overview() {
    return this.stats.getOverview();
  }
}
