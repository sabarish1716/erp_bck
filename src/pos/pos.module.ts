import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  controllers: [PosController],
  providers: [PosService,PrismaService]
})
export class PosModule {}
