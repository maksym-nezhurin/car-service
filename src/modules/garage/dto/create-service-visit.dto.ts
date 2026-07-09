import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PartPurchasedBy } from '../../../prisma/generated-client';

export class ServicePartDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(PartPurchasedBy)
  purchasedBy!: PartPurchasedBy;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  productUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  partNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  cost?: number;
}

export class ServiceLineItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  partsCost?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  lineTotal?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicePartDto)
  parts?: ServicePartDto[];
}

export class ProviderSnapshotDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsString()
  @MaxLength(40)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nip?: string;
}

export class CreateServiceVisitDto {
  @IsDateString()
  performedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  odometerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  totalCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  costCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  draftCompanyId?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ProviderSnapshotDto)
  providerSnapshot!: ProviderSnapshotDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceLineItemDto)
  lineItems!: ServiceLineItemDto[];
}
