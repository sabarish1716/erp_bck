import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAdvanceRequestDto {
  @IsNotEmpty() @IsString() staffId: string;
  @IsNotEmpty() @IsString() type: string;
  @IsNotEmpty() @IsNumber() amount: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsNumber() monthlyDeduction?: number;
}

export class ApproveAdvanceDto {
  @IsNotEmpty() @IsString() email: string;
}

export class RejectAdvanceDto {
  @IsNotEmpty() @IsString() email: string;
  @IsOptional() @IsString() reason?: string;
}
