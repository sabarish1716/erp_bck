import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt.guard';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RolePermissionsService } from './role-permissions.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PermissionsGuard, PrismaService, RolePermissionsService],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, RolePermissionsService],
})
export class AuthModule {}