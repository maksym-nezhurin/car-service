// update-car.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CarDto } from './car.dto';
import { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateCarDto extends PartialType(CarDto) {}

export type UpdateCarData = Partial<Prisma.CarUpdateInput>;
