import { Global, Module } from '@nestjs/common';
import { SupabaseController } from './supabase.controller';
import { SupabaseService } from './supabase.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Global()
@Module({
  controllers: [SupabaseController],
  providers: [SupabaseService, PrismaService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
