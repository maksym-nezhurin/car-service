import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { RegistrationEventType } from '../../../prisma/generated-client';

export class AddRegistrationEventDto {
  @IsEnum(RegistrationEventType)
  eventType!: RegistrationEventType;

  @IsDateString()
  eventDate!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
