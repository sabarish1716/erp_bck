// dto/update-location.dto.ts
import { IsNumber, IsString } from 'class-validator';

export class UpdateLocationDto {
  @IsString()
  vanId: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}