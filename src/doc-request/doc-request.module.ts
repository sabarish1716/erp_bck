import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocRequestController } from './doc-request.controller';
import { DocRequestService } from './doc-request.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [DocRequestController],
  providers: [DocRequestService],
})
export class DocRequestModule {}
