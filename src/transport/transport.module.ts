import { Module, forwardRef } from '@nestjs/common';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FeesModule } from 'src/fees/fees.module';

@Module({
  imports: [PrismaModule, forwardRef(() => FeesModule)],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}
