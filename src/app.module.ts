import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';
import { AuthModule } from './auth/auth.module';
import { AdmissionModule } from './admission/admission.module';
import { DriverModule } from './driver/driver.module';
import { LocationModule } from './location/location.module';

@Module({
  imports: [UserModule, AuthModule, AdmissionModule, DriverModule, LocationModule],
  providers: [PrismaService,UserService],
})
export class AppModule {}