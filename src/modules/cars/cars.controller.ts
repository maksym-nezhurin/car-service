import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { Request } from 'express';
import { CarsService } from './cars.service';
import { CarDto } from './dto/car.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async create(
    @Body() data: CarDto,
    @UploadedFiles() images: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const ownerId = req.header('x-user-id') as string;

    return this.carsService.create({ ...data, ownerId }, images);
  }

  @Get('attributes')
  getAttributes() {
    return this.carsService.getAttributes();
  }

  @Get()
  findAll(@Query() query) {
    return this.carsService.findAll(query);
  }

  @Get('my')
  my(@Req() req: Request) {
    const ownerId = req.header('x-user-id') as string;
    return this.carsService.findByOwner(ownerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images'))
  async update(
    @Param('id') id: string,
    @Body() data: Partial<CarDto>,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    return this.carsService.update(id, data, images);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carsService.remove(id);
  }

  @Get('brands')
  getAllBrands() {
    console.log('getAllBrands');
    // return this.brandService.getAllBrands();
  }

  // @Get('brands/:brand/models')
  // getModelsByBrand(@Param('brand') brand: string) {
  //   console.log('get models');
  //   // return this.carsService.getModelsByBrand(brand);
  // }
}
