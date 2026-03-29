import { Module } from '@nestjs/common';
import { PaymentLinkController } from './payment-link.controller';
import { PaymentLinkService } from './payment-link.service';
import { PhonePeService } from './phonepe.service';
import { NotificationService } from './notification.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentLinkController],
  providers: [PaymentLinkService, PhonePeService, NotificationService],
  exports: [PaymentLinkService],
})
export class PaymentLinkModule {}
