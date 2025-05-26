import { Controller, Get, Param } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('brands/:id/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  async getModels(@Param('id') brandId: string) {
    return this.modelsService.getModelsByBrand(brandId);
  }
}
