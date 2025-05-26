import { CarType } from './create-car.dto';

export class CarResponseDto {
  id: string;
  brand: { id: string; name: string };
  model: { id: string; name: string };
  variant: { id: string; name: string };
  type: CarType;
  year: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}
