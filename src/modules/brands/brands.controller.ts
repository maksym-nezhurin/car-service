import { Controller, Get, Param } from '@nestjs/common';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  async getBrands() {
    return this.brandsService.getAllBrands();
  }

  @Get('by-year/:year')
  async getBrandsByYear(@Param('year') year: string) {
    return this.brandsService.getBrandsByYear(year);
  }
}
