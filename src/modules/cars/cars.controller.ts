import {
  Controller,
  Get,
  Post,
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
    // Передаємо DTO і файли окремо
    return this.carsService.create({ ...data, ownerId }, images);
  }

  @Get()
  findAll() {
    return this.carsService.findAll();
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

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() data: Partial<CarDto>) {
  //   return this.carsService.update(id, data);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carsService.remove(id);
  }
}
