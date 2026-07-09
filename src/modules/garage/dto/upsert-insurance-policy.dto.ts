import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { InsurancePolicyType } from '../../../prisma/generated-client';

export class UpsertInsurancePolicyDto {
  @IsEnum(InsurancePolicyType)
  type!: InsurancePolicyType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  insurerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  policyNumber?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  premiumAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  premiumCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** When false, deactivates active policy of this type (e.g. user removed AC). */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
