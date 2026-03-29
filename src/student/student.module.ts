import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [StudentController   ],
  providers: [StudentService, PrismaService],
  exports: [StudentService, PrismaService],
})
export class StudentModule {}
