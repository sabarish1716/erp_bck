import { IsObject } from 'class-validator';

export class UpdateStandardSeatsDto {
  @IsObject()
  seats: Record<string, number>;
}
