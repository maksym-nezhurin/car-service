import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateSaleListingDto {
  @ApiPropertyOptional({ example: 'Hyunday Tucson 2018' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Well maintained, single owner.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 8900 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'PLN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    example: {
      bodyType: 'SUV',
      driveType: '4x4',
      countryOfOrigin: 'PL',
      countryOfRegistration: 'PL',
      isDamaged: false,
    },
  })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      color: 'Black',
      upholsteryType: 'Leather',
      upholsteryColor: 'Black',
      paintTypes: ['metallic'],
    },
  })
  @IsOptional()
  @IsObject()
  appearance?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      security: ['ABS', 'Lane Assist'],
      comfort: ['Heated seats', 'Adaptive cruise'],
      extras: ['Apple CarPlay', '360 camera'],
    },
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      name: 'John',
      phone: '+48...',
      email: 'john@email.com',
      city: 'Warsaw',
      postalCode: '00-000',
    },
  })
  @IsOptional()
  @IsObject()
  contact?: Record<string, unknown>;
}
