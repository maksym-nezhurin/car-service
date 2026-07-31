import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

const LIST_CACHE = 'public, s-maxage=86400, stale-while-revalidate=3600';
const DETAIL_CACHE = 'public, s-maxage=3600, stale-while-revalidate=600';

function parseIncludeLegacy(value?: string): boolean {
  return value === 'true' || value === '1';
}

function parseFull(value?: string): boolean {
  return value === 'true' || value === '1';
}

/** Proxied via gateway as `/v1/cars/catalog/*` → `/api/cars/catalog/*` */
@Controller('cars/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('stats')
  @Header('Cache-Control', LIST_CACHE)
  getStats() {
    return this.catalogService.getPublicStats();
  }

  @Get('makes')
  @Header('Cache-Control', LIST_CACHE)
  listMakes(
    @Query('includeLegacy') includeLegacy?: string,
    @Query('full') full?: string,
  ) {
    return this.catalogService.listMakes({
      includeLegacy: parseIncludeLegacy(includeLegacy),
      full: parseFull(full),
    });
  }

  @Get('makes/:makeSlug/models')
  @Header('Cache-Control', LIST_CACHE)
  listModelsByMake(
    @Param('makeSlug') makeSlug: string,
    @Query('includeLegacy') includeLegacy?: string,
    @Query('full') full?: string,
  ) {
    return this.catalogService.listModelsByMakeSlug(makeSlug, {
      includeLegacy: parseIncludeLegacy(includeLegacy),
      full: parseFull(full),
    });
  }

  @Get('makes/:makeSlug/models/:modelSlug/generations')
  @Header('Cache-Control', LIST_CACHE)
  listGenerationsByModel(
    @Param('makeSlug') makeSlug: string,
    @Param('modelSlug') modelSlug: string,
    @Query('includeLegacy') includeLegacy?: string,
  ) {
    return this.catalogService.listGenerationsByModelPath(makeSlug, modelSlug, {
      includeLegacy: parseIncludeLegacy(includeLegacy),
    });
  }

  @Get('by-path/:makeSlug/:modelSlug/:generationSlug')
  @Header('Cache-Control', DETAIL_CACHE)
  getGenerationByPath(
    @Param('makeSlug') makeSlug: string,
    @Param('modelSlug') modelSlug: string,
    @Param('generationSlug') generationSlug: string,
    @Query('includeLegacy') includeLegacy?: string,
  ) {
    return this.catalogService.getGenerationByPath(
      makeSlug,
      modelSlug,
      generationSlug,
      { includeLegacy: parseIncludeLegacy(includeLegacy) },
    );
  }

  @Get('by-path/:makeSlug/:modelSlug/:generationSlug/:trimSlug')
  @Header('Cache-Control', DETAIL_CACHE)
  getTrimByPath(
    @Param('makeSlug') makeSlug: string,
    @Param('modelSlug') modelSlug: string,
    @Param('generationSlug') generationSlug: string,
    @Param('trimSlug') trimSlug: string,
    @Query('includeLegacy') includeLegacy?: string,
  ) {
    return this.catalogService.getTrimByPath(
      makeSlug,
      modelSlug,
      generationSlug,
      trimSlug,
      { includeLegacy: parseIncludeLegacy(includeLegacy) },
    );
  }

  @Get('trims/:trimId')
  @Header('Cache-Control', DETAIL_CACHE)
  getTrimById(@Param('trimId') trimId: string) {
    return this.catalogService.getTrimById(trimId);
  }

  @Get('engines')
  @Header('Cache-Control', LIST_CACHE)
  listEngines() {
    return this.catalogService.listEngines();
  }

  @Get('engines/:slug')
  @Header('Cache-Control', DETAIL_CACHE)
  getEngine(@Param('slug') slug: string) {
    return this.catalogService.getEngineBySlug(slug);
  }

  @Get('transmissions')
  @Header('Cache-Control', LIST_CACHE)
  listTransmissions() {
    return this.catalogService.listTransmissions();
  }

  @Get('transmissions/:slug')
  @Header('Cache-Control', DETAIL_CACHE)
  getTransmission(@Param('slug') slug: string) {
    return this.catalogService.getTransmissionBySlug(slug);
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
