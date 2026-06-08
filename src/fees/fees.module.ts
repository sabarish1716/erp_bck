import { Module, forwardRef } from '@nestjs/common';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TransportModule } from 'src/transport/transport.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TransportModule)],
  controllers: [FeesController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
