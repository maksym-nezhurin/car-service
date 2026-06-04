import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  // IsBoolean,
} from 'class-validator';

export enum CarType {
  SEDAN = 'sedan',
  HATCHBACK = 'hatchback',
  SUV = 'suv',
  COUPE = 'coupe',
}

export class AttributeValueDto {
  @IsString()
  attributeId: string;

  @IsString()
  value: string;
}

export class MediaDto {
  @IsString()
  url: string;

  @IsString()
  type: string; // 'image' | 'video' etc.

  @IsOptional()
  @IsNumber()
  position?: number;
}

// export class CarDto {
//   @IsString()
//   ownerId: string;

//   @IsString()
//   complectation: string;

//   @IsNumber()
//   engine: number;

//   @IsString()
//   brand: string;

//   @IsString()
//   model: string;

//   @IsBoolean()
//   isRentable?: boolean | string;

//   @IsString()
//   @IsOptional()
//   rentPricePerDay?: string;

//   @IsString()
//   type: string;

//   @IsNumber()
//   price: number;

//   @IsNumber()
//   year: number;

//   @IsNumber()
//   mileage: number;

//   @IsString()
//   description: string;

//   @IsOptional()
//   @IsString()
//   color?: string;

//   @IsOptional()
//   @IsArray()
//   @IsString({ each: true })
//   images?: string[];
// }

export class CarDto {
  @IsString()
  ownerId: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsArray()
  attributes?: AttributeValueDto[] | string;

  @IsOptional()
  @IsArray()
  media?: MediaDto[];
}
