import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, SyncJobStatus, SyncJobType } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);
  private isProcessing = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      this.logger.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY - queued sync will remain pending');
      return;
    }

    this.client = createClient(url, key);
    this.logger.log('Client initialized');
  }

  getClient(): SupabaseClient | null {
    return this.client || null;
  }

  private getSucceededRetentionDays(): number {
    const rawValue = process.env.SUPABASE_SYNC_SUCCESS_RETENTION_DAYS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 7;
    }

    return Math.floor(parsed);
  }

  async getSyncDashboard(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const [statusCounts, typeCounts, recentFailures, oldestPending] = await Promise.all([
      this.prisma.supabaseSyncJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.supabaseSyncJob.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
      this.prisma.supabaseSyncJob.findMany({
        where: { status: SyncJobStatus.FAILED },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          type: true,
          status: true,
          dedupeKey: true,
          attempts: true,
          lastError: true,
          availableAt: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.supabaseSyncJob.findFirst({
        where: { status: SyncJobStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          status: true,
          dedupeKey: true,
          attempts: true,
          availableAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const countsByStatus = Object.values(SyncJobStatus).reduce(
      (result, status) => {
        result[status] = 0;
        return result;
      },
      {} as Record<SyncJobStatus, number>,
    );

    for (const row of statusCounts) {
      countsByStatus[row.status] = row._count._all;
    }

    const countsByType = Object.values(SyncJobType).reduce(
      (result, type) => {
        result[type] = 0;
        return result;
      },
      {} as Record<SyncJobType, number>,
    );

    for (const row of typeCounts) {
      countsByType[row.type] = row._count._all;
    }

    return {
      clientReady: Boolean(this.client),
      retentionDays: this.getSucceededRetentionDays(),
      queueDepth: countsByStatus.PENDING + countsByStatus.FAILED + countsByStatus.PROCESSING,
      countsByStatus,
      countsByType,
      oldestPending,
      recentFailures,
    };
  }

  async listSyncJobs(params?: {
    status?: SyncJobStatus;
    type?: SyncJobType;
    limit?: number;
    cursor?: string;
  }) {
    const safeLimit = Math.min(Math.max(Number(params?.limit) || 50, 1), 100);

    const jobs = await this.prisma.supabaseSyncJob.findMany({
      where: {
        status: params?.status,
        type: params?.type,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      ...(params?.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        type: true,
        status: true,
        dedupeKey: true,
        attempts: true,
        lastError: true,
        availableAt: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
        payload: true,
      },
    });

    const hasMore = jobs.length > safeLimit;
    const items = hasMore ? jobs.slice(0, safeLimit) : jobs;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async purgeSucceededJobs(retentionDays = this.getSucceededRetentionDays()) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.supabaseSyncJob.deleteMany({
      where: {
        status: SyncJobStatus.SUCCEEDED,
        processedAt: { lt: cutoff },
      },
    });

    return {
      deletedCount: result.count,
      retentionDays,
      cutoff,
    };
  }

  async enqueueLocationSync(data: {
    locationId: string;
    driverId: string;
    busId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    mileageKm?: number;
    createdAt: string;
  }) {
    await this.queueJob(SyncJobType.LOCATION, data, `location:${data.locationId}`);
  }

  async enqueueMileageSync(data: {
    driverId: string;
    busId?: string;
    totalKm: number;
    date: string;
  }) {
    await this.queueJob(
      SyncJobType.MILEAGE,
      data,
      `mileage:${data.driverId}:${data.busId || 'none'}:${data.date}`,
    );
  }

  async enqueueDriverStatusSync(data: {
    driverId: string;
    name: string;
    phone?: string;
    busId?: string;
    status: string;
  }) {
    await this.queueJob(SyncJobType.DRIVER_STATUS, data, `driver-status:${data.driverId}`);
  }

  async enqueueFuelLogSync(data: {
    fuelLogId: string;
    driverId: string;
    busId?: string;
    plateNo?: string;
    odometer: number;
    litres: number;
    fuelCostPerLitre?: number;
    totalCost?: number;
    note?: string;
    imageUrl?: string;
    timestamp: string;
  }) {
    await this.queueJob(SyncJobType.FUEL_LOG, data, `fuel-log:${data.fuelLogId}`);
  }

  private async queueJob(type: SyncJobType, payload: Prisma.InputJsonValue, dedupeKey?: string) {
    if (!dedupeKey) {
      await this.prisma.supabaseSyncJob.create({
        data: { type, payload },
      });
      return;
    }

    await this.prisma.supabaseSyncJob.upsert({
      where: { dedupeKey },
      update: {
        type,
        payload,
        status: SyncJobStatus.PENDING,
        availableAt: new Date(),
        processedAt: null,
        lastError: null,
      },
      create: {
        type,
        payload,
        dedupeKey,
      },
    });
  }

  @Cron('*/30 * * * * *')// Every 30 seconds
  async processPendingJobs() {
    if (this.isProcessing) {
      return;
    }

    if (!this.client) {
      return;
    }

    this.isProcessing = true;
    try {
      const now = new Date();
      const jobs = await this.prisma.supabaseSyncJob.findMany({
        where: {
          status: { in: [SyncJobStatus.PENDING, SyncJobStatus.FAILED] },
          availableAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const job of jobs) {
        const claimed = await this.prisma.supabaseSyncJob.updateMany({
          where: {
            id: job.id,
            status: { in: [SyncJobStatus.PENDING, SyncJobStatus.FAILED] },
          },
          data: {
            status: SyncJobStatus.PROCESSING,
            attempts: { increment: 1 },
            lastError: null,
          },
        });

        if (claimed.count === 0) {
          continue;
        }

        try {
          await this.dispatchJob(job.type, job.payload as Record<string, unknown>);
          await this.prisma.supabaseSyncJob.update({
            where: { id: job.id },
            data: {
              status: SyncJobStatus.SUCCEEDED,
              processedAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.prisma.supabaseSyncJob.update({
            where: { id: job.id },
            data: {
              status: SyncJobStatus.FAILED,
              lastError: message.slice(0, 1000),
              availableAt: new Date(Date.now() + Math.min((job.attempts + 1) * 60_000, 15 * 60_000)),
            },
          });
          this.logger.error(`Sync job ${job.id} failed: ${message}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron('0 15 */6 * * *')// Every 6 hours at 15 minutes past the hour
  async cleanupSucceededJobs() {
    const result = await this.purgeSucceededJobs();

    if (result.deletedCount > 0) {
      this.logger.log(
        `Purged ${result.deletedCount} succeeded sync job(s) older than ${result.retentionDays} day(s)`,
      );
    }
  }

  private async dispatchJob(type: SyncJobType, payload: Record<string, unknown>) {
    switch (type) {
      case SyncJobType.LOCATION:
        await this.syncLocation({
          driverId: String(payload.driverId),
          busId: payload.busId ? String(payload.busId) : undefined,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          speed: payload.speed == null ? undefined : Number(payload.speed),
          mileageKm: payload.mileageKm == null ? undefined : Number(payload.mileageKm),
          createdAt: String(payload.createdAt),
        });
        return;
      case SyncJobType.MILEAGE:
        await this.syncMileage({
          driverId: String(payload.driverId),
          busId: payload.busId ? String(payload.busId) : undefined,
          totalKm: Number(payload.totalKm),
          date: String(payload.date),
        });
        return;
      case SyncJobType.DRIVER_STATUS:
        await this.syncDriverStatus({
          driverId: String(payload.driverId),
          name: String(payload.name),
          phone: payload.phone ? String(payload.phone) : undefined,
          busId: payload.busId ? String(payload.busId) : undefined,
          status: String(payload.status),
        });
        return;
      case SyncJobType.FUEL_LOG:
        await this.syncFuelLog({
          driverId: String(payload.driverId),
          busId: payload.busId ? String(payload.busId) : undefined,
          plateNo: payload.plateNo ? String(payload.plateNo) : undefined,
          odometer: Number(payload.odometer),
          litres: Number(payload.litres),
          fuelCostPerLitre:
            payload.fuelCostPerLitre == null ? undefined : Number(payload.fuelCostPerLitre),
          totalCost: payload.totalCost == null ? undefined : Number(payload.totalCost),
          note: payload.note ? String(payload.note) : undefined,
          imageUrl: payload.imageUrl ? String(payload.imageUrl) : undefined,
          timestamp: payload.timestamp ? String(payload.timestamp) : undefined,
        });
        return;
      default:
        throw new Error(`Unsupported sync job type: ${type}`);
    }
  }

  async syncLocation(data: {
    driverId: string;
    busId?: string;
    latitude: number;
    longitude: number;
    speed?: number;
    mileageKm?: number;
    createdAt?: string;
  }) {
    if (!this.client) {
      throw new Error('Supabase client unavailable');
    }

    const { error } = await this.client.from('driver_locations').insert({
      driver_id: data.driverId,
      bus_id: data.busId || null,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed || null,
      mileage_km: data.mileageKm || 0,
      created_at: data.createdAt || new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async syncMileage(data: {
    driverId: string;
    busId?: string;
    totalKm: number;
    date: string;
  }) {
    if (!this.client) {
      throw new Error('Supabase client unavailable');
    }

    const { error } = await this.client.from('driver_mileage').upsert(
      {
        driver_id: data.driverId,
        bus_id: data.busId || null,
        total_km: data.totalKm,
        date: data.date,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,date' },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async syncDriverStatus(data: {
    driverId: string;
    name: string;
    phone?: string;
    busId?: string;
    status: string;
  }) {
    if (!this.client) {
      throw new Error('Supabase client unavailable');
    }

    const { error } = await this.client.from('drivers').upsert(
      {
        driver_id: data.driverId,
        name: data.name,
        phone: data.phone || null,
        bus_id: data.busId || null,
        status: data.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async syncFuelLog(data: {
    driverId: string;
    busId?: string;
    plateNo?: string;
    odometer: number;
    litres: number;
    fuelCostPerLitre?: number;
    totalCost?: number;
    note?: string;
    imageUrl?: string;
    timestamp?: string;
  }) {
    if (!this.client) {
      throw new Error('Supabase client unavailable');
    }

    const { error } = await this.client.from('fuel_logs').insert({
      driver_id: data.driverId,
      bus_id: data.busId || null,
      plate_no: data.plateNo || null,
      odometer: data.odometer,
      litres: data.litres,
      fuel_cost_per_litre: data.fuelCostPerLitre || null,
      total_cost: data.totalCost || null,
      note: data.note || null,
      image_url: data.imageUrl || null,
      timestamp: data.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}
