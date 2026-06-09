import { Module } from '@nestjs/common';
import { TransportExpenseController } from './transport-expense.controller';
import { TransportExpenseService } from './transport-expense.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [TransportExpenseController],
  providers: [TransportExpenseService, PrismaService],
})
export class TransportExpenseModule {}
