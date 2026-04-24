import { IsNumber } from 'class-validator';

export class UpdateActingDriverRateDto {
  @IsNumber()
  dailyRate!: number;
}
