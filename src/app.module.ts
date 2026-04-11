import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';
import { AuthModule } from './auth/auth.module';
import { AdmissionModule } from './admission/admission.module';
import { DriverModule } from './driver/driver.module';
import { LocationModule } from './location/location.module';
import { StudentModule } from './student/student.module';
import { FeesModule } from './fees/fees.module';
import { TransportModule } from './transport/transport.module';
import { StaffModule } from './staff/staff.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentLinkModule } from './payment-link/payment-link.module';
import { HrModule } from './hr/hr.module';
import { PosModule } from './pos/pos.module';
import { DocRequestModule } from './doc-request/doc-request.module';
import { HouseModule } from './house/house.module';
import { SupabaseModule } from './supabase/supabase.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { PermissionsGuard } from './auth/permissions.guard';

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule, UserModule, AuthModule, AdmissionModule, DriverModule, LocationModule, StudentModule, FeesModule, TransportModule, StaffModule, SettingsModule, PaymentLinkModule, HrModule, PosModule, DocRequestModule, HouseModule],
  providers: [
    PrismaService,
    UserService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}