// src/transport-expense/dto/create-expense.dto.ts

export class CreateExpenseDto {
  busId!: string;
  date!: string;
  category!: 'FUEL' | 'MAINTENANCE' | 'PARTS' | 'TAX';
  amount!: number;

  fuelStation?: string;
  paymentMode?: 'CASH' | 'CARD';
  litres?: number;
  pricePerLitre?: number;

  workshop?: string;
  description?: string;

  partName?: string;
  isShared?: boolean;

  taxType?: string;
}