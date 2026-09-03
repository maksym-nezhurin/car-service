import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class ScanVehicleImportDto {
  @ApiPropertyOptional({
    description: 'Base64-encoded photo of the registration document',
  })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiPropertyOptional({
    description:
      'Pre-decoded raw text, if decoding already happened client-side',
  })
  @IsOptional()
  @IsString()
  rawText?: string;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 2,
    example: 'PL',
    default: 'PL',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Import adapter to use',
    default: 'mock',
    example: 'mock',
  })
  @IsOptional()
  @IsString()
  method?: string;
}
