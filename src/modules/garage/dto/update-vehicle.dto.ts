import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';

export class UpdateVehicleDto {
  @ApiPropertyOptional({
    description: 'Vehicle identification number',
    minLength: 11,
    maxLength: 17,
    example: 'TMAJ3815GJJ442677',
  })
  @IsOptional()
  @IsString()
  @Length(11, 17)
  vin?: string;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2100, example: 2018 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ minLength: 2, example: 'KR1234A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  plateNumber?: string;

  @ApiPropertyOptional({ example: 'Hyunday' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ example: 'Tucson' })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiPropertyOptional({ example: '1.6 CRDi' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ example: 'SUV' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'Black' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '2.0' })
  @IsOptional()
  @IsString()
  engine?: string;

  @ApiPropertyOptional({ example: 'Automatic' })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiPropertyOptional({ example: 'Diesel' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ minimum: 0, example: 193000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentMileageKm?: number;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, example: 'PL' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}
