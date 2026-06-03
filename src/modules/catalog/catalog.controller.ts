import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/** Proxied via gateway as `/v1/cars/catalog/*` → `/api/cars/catalog/*` */
@Controller('cars/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('makes')
  listMakes() {
    return this.catalogService.listMakes();
  }

  @Get('generations')
  listGenerations(
    @Query('makeId') makeId?: string,
    @Query('q') q?: string,
  ) {
    return this.catalogService.listGenerations({ makeId, q });
  }

  @Get('generations/:id')
  getGeneration(@Param('id') id: string) {
    return this.catalogService.getGeneration(id);
  }

  /** Used by `community:seed` in user-service — full tree, no live CarQuery. */
  @Get('export/community-seed')
  exportForCommunitySeed() {
    return this.catalogService.exportForCommunitySeed();
  }
}
