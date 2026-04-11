import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  private toRad(value: number) {
    return (value * Math.PI) / 180;
  }

  private haversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
// 13.01496, 80.15369
  getGeofenceConfig() {
    const centerLat = Number(process.env.SCHOOL_GEOFENCE_LAT || 13.01496);
    const centerLng = Number(process.env.SCHOOL_GEOFENCE_LNG || 80.15369);
    const radiusMeters = Number(process.env.SCHOOL_GEOFENCE_RADIUS_M || 250);

    return {
      centerLat,
      centerLng,
      radiusMeters,
    };
  }

  private async resolveDriverAndBus(dto: CreateLocationDto) {
    const driverRef = String(dto.driverId || '').trim();
    console.log(`[LocationService] Resolving locator for: ${driverRef}`);
    
    if (!driverRef) {
      throw new BadRequestException('driverId is required');
    }

    // Find all matching drivers and prefer the one with a bus assigned
    const candidates = await this.prisma.driver.findMany({
      where: {
        OR: [{ id: driverRef }, { phone: driverRef }, { deviceId: driverRef }],
      },
      include: { bus: true },
    });
    let driver = candidates.find((d) => d.busId) || candidates[0] || null;

    if (!driver) {
      const refDigits = driverRef.replace(/\D/g, '');
      if (refDigits.length >= 10) {
        const allDrivers = await this.prisma.driver.findMany({
          where: { phone: { not: null } },
          include: { bus: true },
        });
        const target = refDigits.slice(-10);
        const phoneMatches = allDrivers.filter((d) => (d.phone || '').replace(/\D/g, '').slice(-10) === target);
        driver = phoneMatches.find((d) => d.busId) || phoneMatches[0] || null;
        if (!driver) {
          console.error('[LocationService] No driver matched. Debug phone numbers:');
          allDrivers.forEach((d) => {
            const phone = d.phone || '';
            const last10 = phone.replace(/\D/g, '').slice(-10);
            console.error(`Driver: ${d.name}, Phone: ${phone}, Last10: ${last10}`);
          });
        }
      }
    }

    if (!driver) {
      console.error(`[LocationService] Driver NOT found: ${driverRef}`);
      throw new NotFoundException(`Driver not found for reference: ${driverRef}`);
    }

    const busId = dto.busId || driver.busId;
    if (!busId) {
      console.error(`[LocationService] Bus not mapped for driver ${driver.name} (Ref: ${driverRef})`);
      throw new BadRequestException(`Bus is not mapped for driver ${driver.name}. Use HR management to assign a bus first.`);
    }

    console.log(`[LocationService] Resolved to Driver: ${driver.name}, Bus: ${busId}`);
    return { driver, busId };
  }

  async create(dto: CreateLocationDto) {
    const { driver, busId } = await this.resolveDriverAndBus(dto);
    const location = await this.prisma.location.create({
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      driverId: driver.id,
        busId,
        createdAt: new Date(),
      },
    });

    // Sync to Supabase (non-blocking)
    this.supabase.syncLocation({
      driverId: driver.id,
      busId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    return location;
  }

  async saveMileageFromDriver(data: { driverId: string; distanceKm: number; date: string }) {
    const driverRef = String(data.driverId || '').trim();
    
    // Resolve driver
    let driver = await this.prisma.driver.findFirst({
      where: {
        OR: [{ id: driverRef }, { phone: driverRef }, { deviceId: driverRef }],
      },
      include: { bus: true },
    });

    if (!driver) {
      const refDigits = driverRef.replace(/\D/g, '');
      if (refDigits.length >= 10) {
        const allDrivers = await this.prisma.driver.findMany({
          where: { phone: { not: null } },
          include: { bus: true },
        });
        const target = refDigits.slice(-10);
        driver = allDrivers.find((d) => (d.phone || '').replace(/\D/g, '').slice(-10) === target) || null;
      }
    }

    if (!driver) {
      throw new NotFoundException(`Driver not found for reference: ${driverRef}`);
    }

    // Sync mileage to Supabase
    this.supabase.syncMileage({
      driverId: driver.id,
      busId: driver.busId || undefined,
      totalKm: data.distanceKm,
      date: data.date,
    });

    // If driver has a bus, create a mileage record in local DB too
    if (driver.busId) {
      // Check if there's an existing snapshot for today
      const today = new Date(data.date);
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);

      const existing = await this.prisma.mileage.findFirst({
        where: {
          busId: driver.busId,
          driverId: driver.id,
          snapshotTime: { gte: start, lte: end },
        },
        orderBy: { snapshotTime: 'desc' },
      });

      // Store as GPS-based mileage snapshot (odometer = accumulated GPS km)
      await this.prisma.mileage.create({
        data: {
          busId: driver.busId,
          driverId: driver.id,
          odometer: data.distanceKm,
          snapshotTime: new Date(),
        },
      });
    }

    return { success: true, driverId: driver.id, distanceKm: data.distanceKm };
  }

  async getLatestLocation(driverRef: string) {
    let driver = await this.prisma.driver.findFirst({
      where: {
        OR: [{ id: driverRef }, { phone: driverRef }, { deviceId: driverRef }],
      },
      select: { id: true },
    });

    if (!driver) {
      const refDigits = String(driverRef || '').replace(/\D/g, '');
      if (refDigits.length >= 10) {
        const allDrivers = await this.prisma.driver.findMany({
          where: { phone: { not: null } },
          select: { id: true, phone: true },
        });
        const target = refDigits.slice(-10);
        const found = allDrivers.find(
          (d) => String(d.phone || '').replace(/\D/g, '').slice(-10) === target,
        );
        if (found) {
          driver = { id: found.id };
        }
      }
    }

    if (!driver) {
      throw new NotFoundException(`Driver not found for reference: ${driverRef}`);
    }

    return this.prisma.location.findFirst({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLiveDriverLocations() {
    const geofence = this.getGeofenceConfig();

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Get latest driver locations
    const latestCandidates = await this.prisma.location.findMany({
      where: {
        createdAt: {
          lte: now,
          gt: fiveMinutesAgo,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            bus: {
              select: {
                id: true,
                number: true,
                routeName: true,
              },
            },
          },
        },
      },
    });

    // Get latest per driver only
    const seen = new Set<string>();
    const latestPerDriver = [] as typeof latestCandidates;
    for (const item of latestCandidates) {
      if (seen.has(item.driverId)) continue;
      seen.add(item.driverId);
      latestPerDriver.push(item);
    }

    const drivers = latestPerDriver.map((item) => {
      const distanceToSchool = this.haversineDistanceMeters(
        geofence.centerLat,
        geofence.centerLng,
        item.latitude,
        item.longitude,
      );

      // NOTE: Bus GPS comes from APM hardware tracker (external API), not from
      // the Location table. The Location table only stores driver app pings.
      // Bus proximity is calculated on the frontend using live APM data.

      return {
        id: item.id,
        createdAt: item.createdAt,
        latitude: item.latitude,
        longitude: item.longitude,
        driverId: item.driverId,
        busId: item.busId,
        driver: item.driver,
        distanceToSchoolMeters: Math.round(distanceToSchool),
        insideSchoolGeofence: distanceToSchool <= geofence.radiusMeters,
        busLocation: null,
        distanceToBusMeters: null,
        driverBusStatus: null,
      };
    });

    return {
      geofence,
      drivers,
      total: drivers.length,
      insideGeofenceCount: drivers.filter((x) => x.insideSchoolGeofence).length,
      outsideGeofenceCount: drivers.filter((x) => !x.insideSchoolGeofence).length,
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}