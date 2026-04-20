import { Controller, Post, Body, Get } from '@nestjs/common';
import { TransportExpenseService } from './transport-expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';   // 👈 ADD HERE

@Controller('transport-expense')
export class TransportExpenseController {
  constructor(private service: TransportExpenseService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto) {
    return this.service.create(dto);
  }

  @Get()
  getAll() {
    return this.service.findAll();
  }
}