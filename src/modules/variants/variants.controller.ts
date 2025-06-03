import { Controller, Get, Param } from '@nestjs/common';
import { VariantsService } from './variants.service';

@Controller('models/:id/variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get()
  async getVariants(@Param('id') modelId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.variantsService.getVariantsByModel(modelId);
  }

  @Get('by-year/:year')
  async getVariantsByYear(
    @Param('id') modelId: string,
    @Param('year') year: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.variantsService.getVariantsByModelAndYear(modelId, year);
  }
}
