import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class UpdateActingDriverDaysDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string;

  @IsNumber()
  @Min(0)
  days!: number;
}
