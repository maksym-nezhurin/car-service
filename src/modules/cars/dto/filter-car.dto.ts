import { IsOptional, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { CarType } from './create-car.dto';

export class FilterCarDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  modelId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsEnum(CarType)
  type?: CarType;

  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;
}
