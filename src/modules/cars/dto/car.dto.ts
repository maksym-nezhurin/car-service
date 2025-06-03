import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

export enum CarType {
  SEDAN = 'sedan',
  HATCHBACK = 'hatchback',
  SUV = 'suv',
  COUPE = 'coupe',
}

export class CarDto {
  @IsString()
  ownerId: string;

  @IsString()
  complectation: string;

  @IsNumber()
  engine: number;

  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsBoolean()
  isRentable?: boolean | string;

  @IsString()
  @IsOptional()
  rentPricePerDay?: string;

  @IsString()
  type: string;

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
