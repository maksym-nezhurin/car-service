import { IsString, IsNumber, IsEnum, IsOptional, IsArray } from 'class-validator';

export enum CarType {
  SEDAN = 'sedan',
  HATCHBACK = 'hatchback',
  SUV = 'suv',
  COUPE = 'coupe',
}

export class CreateCarDto {
  @IsString()
  ownerId: string;

  @IsString()
  complectation: string;

  @IsNumber()
  engine: number;

  @IsString()
  model: string;

  @IsEnum(CarType)
  type: CarType;

  @IsNumber()
  price: number;

  @IsNumber()
  year: number;

  @IsNumber()
  mileage: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
