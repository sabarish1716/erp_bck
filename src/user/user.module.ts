import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module'; // 👈 IMPORT

@Module({
  imports: [PrismaModule], // 👈 REQUIRED
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
