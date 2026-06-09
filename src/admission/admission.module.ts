import { Module } from '@nestjs/common';
import { AdmissionController } from './admission.controller';
import { AdmissionService } from './admission.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AcademicStreamService } from './academic-stream.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdmissionController],
  providers: [AdmissionService, AcademicStreamService],
  exports: [AcademicStreamService],
})
export class AdmissionModule {}
