import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTechnicalInspectionDto {
  @IsDateString()
  performedAt!: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  stationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  certificateNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
