import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class TransportExpenseService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateExpenseDto) {
    return this.prisma.transportExpense.create({
      data: {
        ...dto,
        date: new Date(dto.date),
      },
    });
  }

  findAll() {
    return this.prisma.transportExpense.findMany({
      include: { bus: true },
      orderBy: { date: 'desc' },
    });
  }
}