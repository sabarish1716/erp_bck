import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, SyncJobStatus, SyncJobType } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

const FUEL_LOG_IMPORT_STATE_KEY = 'supabase.fuelLogImportState';

type FuelLogImportState = {
  cursorTimestamp?: string;
  lastRunAt?: string;
  lastImportedAt?: string;
  lastImportedCount?: number;
  lastSkippedCount?: number;
  lastRepairedCount?: number;
  lastError?: string | null;
};

type RemoteFuelLogRow = {
  id: string;
  driver_id: string;
  bus_id: string | null;
  plate_no: string | null;
  odometer: number;
  litres: number;
  fuel_cost_per_litre: number | null;
  total_cost: number | null;
  note: string | null;
  image_url: string | null;
  timestamp: string;
  created_at: string | null;
};

type RemoteDriverLocationRow = {
  id: string;
  driver_id: string;
  bus_id: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  mileage_km: number | null;
  created_at: string;
};

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
      this.logger.warn(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY - queued sync will remain pending',
      );
      return;
    }

    this.client = createClient(url, key);
    this.logger.log('Client initialized');
  }

  getClient(): SupabaseClient | null {
    return this.client || null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTransientFetchFailure(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const causeCode =
      typeof error === 'object' && error !== null && 'cause' in error
        ? String((error as { cause?: { code?: unknown } }).cause?.code || '')
        : '';

    const haystack = `${message} ${causeCode}`.toLowerCase();
    return (
      haystack.includes('fetch failed') ||
      haystack.includes('econnreset') ||
      haystack.includes('etimedout') ||
      haystack.includes('enotfound') ||
      haystack.includes('eai_again') ||
      haystack.includes('network')
    );
  }

  private async withSupabaseRetry<T>(
    action: () => PromiseLike<T> | T,
    context: string,
    maxAttempts = 3,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        const shouldRetry =
          this.isTransientFetchFailure(error) && attempt < maxAttempts;
        if (!shouldRetry) {
          throw error;
        }

        this.logger.warn(
          `${context} attempt ${attempt} failed due to transient fetch error; retrying`,
        );
        await this.sleep(attempt * 500);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private getSucceededRetentionDays(): number {
    const rawValue = process.env.SUPABASE_SYNC_SUCCESS_RETENTION_DAYS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 7;
    }

    return Math.floor(parsed);
  }

  private getReverseImportLookbackHours(): number {
    const rawValue = process.env.SUPABASE_FUEL_IMPORT_LOOKBACK_HOURS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 72;
    }

    return Math.floor(parsed);
  }

  private async getFuelLogImportState(): Promise<FuelLogImportState> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: FUEL_LOG_IMPORT_STATE_KEY },
      select: { value: true },
    });

    if (
      !row ||
      !row.value ||
      typeof row.value !== 'object' ||
      Array.isArray(row.value)
    ) {
      return {};
    }

    return row.value as FuelLogImportState;
  }

  private async updateFuelLogImportState(state: FuelLogImportState) {
    await this.prisma.appSetting.upsert({
      where: { key: FUEL_LOG_IMPORT_STATE_KEY },
      update: { value: state },
      create: {
        key: FUEL_LOG_IMPORT_STATE_KEY,
        value: state,
      },
    });
  }

  private async resolveDriverByReference(driverRef: string) {
    const trimmedRef = String(driverRef || '').trim();
    if (!trimmedRef) {
      return null;
    }

    let driver = await this.prisma.driver.findFirst({
      where: {
        OR: [
          { id: trimmedRef },
          { phone: trimmedRef },
          { deviceId: trimmedRef },
        ],
      },
      include: { bus: true },
    });

    if (!driver) {
      const refDigits = trimmedRef.replace(/\D/g, '');
      if (refDigits.length >= 10) {
        const allDrivers = await this.prisma.driver.findMany({
          where: { phone: { not: null } },
          include: { bus: true },
        });
        const target = refDigits.slice(-10);
        const matches = allDrivers.filter(
          (candidate) =>
            (candidate.phone || '').replace(/\D/g, '').slice(-10) === target,
        );
        driver =
          matches.find((candidate) => candidate.busId) || matches[0] || null;
      }
    }

    return driver;
  }

  private async resolveDriverForImportedFuelLog(driverRef: string) {
    return this.resolveDriverByReference(driverRef);
  }

  private async resolveBusForImportedFuelLog(
    busId?: string | null,
    plateNo?: string | null,
    driver?: {
      busId?: string | null;
      bus?: { id: string; number: string } | null;
    } | null,
    localDriverId?: string,
  ) {
    if (busId) {
      const busById = await this.prisma.bus.findUnique({
        where: { id: busId },
        select: { id: true, number: true },
      });
      if (busById) {
        return busById;
      }
    }

    if (plateNo) {
      const busByNumber = await this.prisma.bus.findFirst({
        where: { number: plateNo },
        select: { id: true, number: true },
      });
      if (busByNumber) {
        return busByNumber;
      }
    }

    if (driver?.busId && driver.bus) {
      return {
        id: driver.bus.id,
        number: driver.bus.number,
      };
    }

    if (localDriverId) {
      const lastMappedLog = await this.prisma.fuelLog.findFirst({
        where: {
          driverId: localDriverId,
          busId: { not: null },
          plateNo: { not: null },
        },
        orderBy: { timestamp: 'desc' },
        select: { busId: true, plateNo: true },
      });

      if (lastMappedLog?.busId && lastMappedLog.plateNo) {
        return {
          id: lastMappedLog.busId,
          number: lastMappedLog.plateNo,
        };
      }
    }

    return null;
  }

  private async resolveBusIdForImportedLocation(
    remoteBusId: string | null | undefined,
    driver?: {
      id?: string;
      phone?: string | null;
      busId?: string | null;
    } | null,
    remoteDriverRef?: string | null,
  ) {
    if (driver?.busId) {
      return driver.busId;
    }

    if (remoteBusId) {
      const bus = await this.prisma.bus.findUnique({
        where: { id: remoteBusId },
        select: { id: true },
      });
      if (bus) {
        return bus.id;
      }
    }

    if (driver?.id) {
      const lastLocation = await this.prisma.location.findFirst({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
        select: { busId: true },
      });
      if (lastLocation?.busId) {
        return lastLocation.busId;
      }

      const lastFuelLog = await this.prisma.fuelLog.findFirst({
        where: { driverId: driver.id, busId: { not: null } },
        orderBy: { timestamp: 'desc' },
        select: { busId: true },
      });
      if (lastFuelLog?.busId) {
        return lastFuelLog.busId;
      }
    }

    const phoneCandidate = String(
      remoteDriverRef || driver?.phone || '',
    ).trim();
    if (this.client && phoneCandidate) {
      const response = await this.withSupabaseRetry(
        () =>
          this.client!.from('drivers')
            .select('bus_id,phone,driver_id,updated_at')
            .or(`phone.eq.${phoneCandidate},driver_id.eq.${phoneCandidate}`)
            .order('updated_at', { ascending: false })
            .limit(1),
        'Driver location remote bus lookup',
      );

      const remoteDriver = Array.isArray(response.data)
        ? response.data[0]
        : null;
      const remoteResolvedBusId = remoteDriver?.bus_id
        ? String(remoteDriver.bus_id)
        : null;

      if (remoteResolvedBusId) {
        const bus = await this.prisma.bus.findUnique({
          where: { id: remoteResolvedBusId },
          select: { id: true },
        });
        if (bus) {
          return bus.id;
        }
      }
    }

    return null;
  }

  async importRecentDriverLocationsToLocal(since: Date) {
    if (!this.client) {
      return {
        importedCount: 0,
        skippedCount: 0,
        fetchedCount: 0,
        reason: 'client-unavailable',
      };
    }

    const response = await this.withSupabaseRetry(
      () =>
        this.client!.from('driver_locations')
          .select(
            'id,driver_id,bus_id,latitude,longitude,speed,mileage_km,created_at',
          )
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(2000),
      'Driver location reverse import fetch',
    );

    if (response.error) {
      throw new Error(response.error.message);
    }

    const rows = (response.data || []) as RemoteDriverLocationRow[];
    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const driver = await this.resolveDriverByReference(row.driver_id);
      if (!driver) {
        skippedCount += 1;
        continue;
      }

      const busId = await this.resolveBusIdForImportedLocation(
        row.bus_id,
        driver,
        row.driver_id,
      );
      if (!busId) {
        skippedCount += 1;
        continue;
      }

      if (!row.bus_id) {
        try {
          const updateResponse = await this.withSupabaseRetry(
            () =>
              this.client!.from('driver_locations')
                .update({ bus_id: busId })
                .eq('id', row.id),
            'Driver location remote bus repair',
          );

          if (!updateResponse.error) {
            row.bus_id = busId;
          }
        } catch {
          // Keep local import working even if remote repair fails.
        }
      }

      const createdAt = new Date(row.created_at);
      if (Number.isNaN(createdAt.getTime())) {
        skippedCount += 1;
        continue;
      }

      await this.prisma.location.upsert({
        where: {
          driverId_createdAt: {
            driverId: driver.id,
            createdAt,
          },
        },
        update: {
          busId,
          latitude: row.latitude,
          longitude: row.longitude,
          speed: row.speed ?? null,
        },
        create: {
          driverId: driver.id,
          busId,
          latitude: row.latitude,
          longitude: row.longitude,
          speed: row.speed ?? null,
          createdAt,
        },
      });

      importedCount += 1;
    }

    return {
      importedCount,
      skippedCount,
      fetchedCount: rows.length,
      reason: null,
    };
  }

  private async importRemoteFuelLog(row: RemoteFuelLogRow) {
    const driver = await this.resolveDriverForImportedFuelLog(row.driver_id);
    if (!driver) {
      return { imported: false, skipped: true, reason: 'driver-not-found' };
    }

    const needsRemoteRepair = !row.bus_id || !row.plate_no;

    const bus = await this.resolveBusForImportedFuelLog(
      row.bus_id,
      row.plate_no,
      driver,
      driver.id,
    );

    if (bus && needsRemoteRepair) {
      const updateResponse = await this.withSupabaseRetry(
        () =>
          this.client!.from('fuel_logs')
            .update({
              bus_id: bus.id,
              plate_no: bus.number,
            })
            .eq('id', row.id),
        'Fuel log reverse import remote repair',
      );

      if (!updateResponse.error) {
        row = {
          ...row,
          bus_id: bus.id,
          plate_no: bus.number,
        };
      }
    }

    const existingBySourceFingerprint = await this.prisma.fuelLog.findFirst({
      where: {
        driverId: row.driver_id,
        busId: row.bus_id,
        plateNo: row.plate_no,
        odometer: row.odometer,
        litres: row.litres,
        timestamp: new Date(row.timestamp),
      },
      select: { id: true },
    });

    if (existingBySourceFingerprint) {
      return {
        imported: false,
        skipped: true,
        repaired: Boolean(bus && needsRemoteRepair),
        reason: 'already-present-source-fingerprint',
      };
    }

    const existingLocal = await this.prisma.fuelLog.findFirst({
      where: {
        driverId: driver.id,
        busId: bus?.id || null,
        plateNo: bus?.number || row.plate_no || null,
        odometer: row.odometer,
        litres: row.litres,
        timestamp: new Date(row.timestamp),
      },
      select: { id: true },
    });

    if (existingLocal) {
      return {
        imported: false,
        skipped: true,
        repaired: Boolean(bus && needsRemoteRepair),
        reason: 'already-present-local-fingerprint',
      };
    }

    await this.prisma.fuelLog.create({
      data: {
        driverId: driver.id,
        busId: bus?.id || null,
        plateNo: bus?.number || row.plate_no || null,
        odometer: row.odometer,
        litres: row.litres,
        fuelCostPerLitre: row.fuel_cost_per_litre,
        totalCost: row.total_cost,
        note: row.note,
        imageUrl: row.image_url,
        timestamp: new Date(row.timestamp),
        createdAt: row.created_at
          ? new Date(row.created_at)
          : new Date(row.timestamp),
      },
    });

    return {
      imported: true,
      skipped: false,
      repaired: Boolean(bus && needsRemoteRepair),
      reason: null,
    };
  }

  async importFuelLogsFromSupabase() {
    if (!this.client) {
      return {
        importedCount: 0,
        skippedCount: 0,
        fetchedCount: 0,
        cursorTimestamp: null,
        reason: 'client-unavailable',
      };
    }

    const previousState = await this.getFuelLogImportState();
    const defaultCursor = new Date(
      Date.now() - this.getReverseImportLookbackHours() * 60 * 60 * 1000,
    ).toISOString();
    const cursorTimestamp = previousState.cursorTimestamp || defaultCursor;

    const response = await this.withSupabaseRetry(
      () =>
        this.client!.from('fuel_logs')
          .select(
            'id,driver_id,bus_id,plate_no,odometer,litres,fuel_cost_per_litre,total_cost,note,image_url,timestamp,created_at',
          )
          .gte('timestamp', cursorTimestamp)
          .order('timestamp', { ascending: true })
          .limit(200),
      'Fuel log reverse import fetch',
    );

    if (response.error) {
      const nextState: FuelLogImportState = {
        ...previousState,
        lastRunAt: new Date().toISOString(),
        lastError: response.error.message,
      };
      await this.updateFuelLogImportState(nextState);
      throw new Error(response.error.message);
    }

    const rows = (response.data || []) as RemoteFuelLogRow[];
    let importedCount = 0;
    let skippedCount = 0;
    let repairedCount = 0;

    for (const row of rows) {
      const result = await this.importRemoteFuelLog(row);
      if (result.imported) {
        importedCount += 1;
      }
      if (result.skipped) {
        skippedCount += 1;
      }
      if (result.repaired) {
        repairedCount += 1;
      }
    }

    const nextCursor =
      rows.length > 0 ? rows[rows.length - 1].timestamp : cursorTimestamp;
    const nextState: FuelLogImportState = {
      cursorTimestamp: nextCursor,
      lastRunAt: new Date().toISOString(),
      lastImportedAt:
        importedCount > 0
          ? new Date().toISOString()
          : previousState.lastImportedAt,
      lastImportedCount: importedCount,
      lastSkippedCount: skippedCount,
      lastRepairedCount: repairedCount,
      lastError: null,
    };
    await this.updateFuelLogImportState(nextState);

    return {
      importedCount,
      skippedCount,
      repairedCount,
      fetchedCount: rows.length,
      cursorTimestamp: nextCursor,
      reason: null,
    };
  }

  async getSyncDashboard(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const [statusCounts, typeCounts, recentFailures, oldestPending] =
      await Promise.all([
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
      fuelLogImportState: await this.getFuelLogImportState(),
      queueDepth:
        countsByStatus.PENDING +
        countsByStatus.FAILED +
        countsByStatus.PROCESSING,
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
    await this.queueJob(
      SyncJobType.LOCATION,
      data,
      `location:${data.locationId}`,
    );
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
    await this.queueJob(
      SyncJobType.DRIVER_STATUS,
      data,
      `driver-status:${data.driverId}`,
    );
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
    await this.queueJob(
      SyncJobType.FUEL_LOG,
      data,
      `fuel-log:${data.fuelLogId}`,
    );
  }

  private async queueJob(
    type: SyncJobType,
    payload: Prisma.InputJsonValue,
    dedupeKey?: string,
  ) {
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

  @Cron('*/30 * * * * *') // Every 30 seconds
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
          await this.dispatchJob(
            job.type,
            job.payload as Record<string, unknown>,
          );
          await this.prisma.supabaseSyncJob.update({
            where: { id: job.id },
            data: {
              status: SyncJobStatus.SUCCEEDED,
              processedAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await this.prisma.supabaseSyncJob.update({
            where: { id: job.id },
            data: {
              status: SyncJobStatus.FAILED,
              lastError: message.slice(0, 1000),
              availableAt: new Date(
                Date.now() + Math.min((job.attempts + 1) * 60_000, 15 * 60_000),
              ),
            },
          });
          this.logger.error(`Sync job ${job.id} failed: ${message}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron('0 15 */6 * * *') // Every 6 hours at 15 minutes past the hour
  async cleanupSucceededJobs() {
    const result = await this.purgeSucceededJobs();

    if (result.deletedCount > 0) {
      this.logger.log(
        `Purged ${result.deletedCount} succeeded sync job(s) older than ${result.retentionDays} day(s)`,
      );
    }
  }

  @Cron('15 */2 * * * *')
  async importFuelLogsFromSupabaseCron() {
    try {
      const result = await this.importFuelLogsFromSupabase();
      if (result.importedCount > 0) {
        this.logger.log(
          `Imported ${result.importedCount} fuel log(s) from Supabase into PostgreSQL`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isTransientFetchFailure(error)) {
        this.logger.warn(
          `Fuel log reverse import transient fetch issue: ${message}`,
        );
        return;
      }

      this.logger.error(`Fuel log reverse import failed: ${message}`);
    }
  }

  @Cron('0 0 20 * * *')
  async clearDriverLocationsAt8Pm() {
    if (!this.client) {
      return;
    }

    try {
      const { error } = await this.withSupabaseRetry(
        () =>
          this.client!.from('driver_locations').delete().not('id', 'is', null),
        'Driver location nightly cleanup',
      );

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log('Cleared all Supabase driver_locations rows at 8 PM');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Driver location nightly cleanup failed: ${message}`);
    }
  }

  private async dispatchJob(
    type: SyncJobType,
    payload: Record<string, unknown>,
  ) {
    switch (type) {
      case SyncJobType.LOCATION:
        await this.syncLocation({
          driverId: String(payload.driverId),
          busId: payload.busId ? String(payload.busId) : undefined,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          speed: payload.speed == null ? undefined : Number(payload.speed),
          mileageKm:
            payload.mileageKm == null ? undefined : Number(payload.mileageKm),
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
            payload.fuelCostPerLitre == null
              ? undefined
              : Number(payload.fuelCostPerLitre),
          totalCost:
            payload.totalCost == null ? undefined : Number(payload.totalCost),
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
