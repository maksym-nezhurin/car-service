import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MaintenanceType } from '../../../prisma/generated-client';

export class AddMaintenanceRecordDto {
  @IsEnum(MaintenanceType)
  type!: MaintenanceType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  details?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileageKm!: number;

  @IsDateString()
  performedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  costAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  serviceCostAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  partsCostAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  costCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  serviceCenter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  partsSupplier?: string;
}
