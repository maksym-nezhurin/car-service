import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { DistributionPlatform } from '../../../prisma/generated-client';

export class PublishSaleListingDto {
  @ApiProperty({
    isArray: true,
    enum: DistributionPlatform,
    required: false,
    example: ['OUR_SITE', 'OTOMOTO', 'FACEBOOK_MARKETPLACE'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DistributionPlatform, { each: true })
  platforms?: DistributionPlatform[];
}
