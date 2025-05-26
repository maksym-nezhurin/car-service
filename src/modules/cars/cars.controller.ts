import { Controller, Get, Post, Body, Param, Patch, Delete, Req } from '@nestjs/common';
import { Request } from 'express';
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';

@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Body() data: CreateCarDto, @Req() req: Request) {
    const ownerId = req.header('x-user-id') as string;
    const carData = { ...data, ownerId };
    console.log('Creating car with data:', carData);
    return this.carsService.create(carData);
  }

  @Get()
  findAll() {
    return this.carsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Partial<CreateCarDto>) {
    return this.carsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.carsService.remove(id);
  }
}
