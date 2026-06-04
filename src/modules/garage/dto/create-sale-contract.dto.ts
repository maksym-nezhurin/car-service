import { Type } from 'class-transformer';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSaleContractDto {
  @IsOptional()
  @IsString()
  buyerUserId?: string;

  @IsObject()
  sellerSnapshot!: Record<string, unknown>;

  @IsObject()
  buyerSnapshot!: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  salePriceAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  salePriceCurrency?: string;

  @IsDateString()
  contractDate!: string;
}
