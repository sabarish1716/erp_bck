import { Controller, Get, Query } from '@nestjs/common';
import { SyncJobStatus, SyncJobType } from '@prisma/client';
import { Permission } from '../auth/permission.enum';
import { Permissions } from '../auth/permissions.decorator';
import { SupabaseService } from './supabase.service';

@Controller('supabase-sync')
export class SupabaseController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('dashboard')
  @Permissions(Permission.SETTINGS_READ)
  getDashboard(@Query('limit') limit?: string) {
    return this.supabaseService.getSyncDashboard(Number(limit));
  }

  @Get('jobs')
  @Permissions(Permission.SETTINGS_READ)
  listJobs(
    @Query('status') status?: SyncJobStatus,
    @Query('type') type?: SyncJobType,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.supabaseService.listSyncJobs({
      status:
        status && Object.values(SyncJobStatus).includes(status)
          ? status
          : undefined,
      type:
        type && Object.values(SyncJobType).includes(type) ? type : undefined,
      limit: Number(limit),
      cursor,
    });
  }
}
