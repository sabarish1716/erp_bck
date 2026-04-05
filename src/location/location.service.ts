import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

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
        driver =
          allDrivers.find((d) => (d.phone || '').replace(/\D/g, '').slice(-10) === target) ||
          null;
        if (!driver) {
          // Log all driver phone numbers and their last 10 digits for troubleshooting
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
    return this.prisma.location.create({
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      driverId: driver.id,
        busId,
        createdAt: new Date(),
      },
    });
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

    // Get latest bus locations for all buses assigned to these drivers
    const busIds = Array.from(new Set(latestCandidates.map(item => item.busId).filter(Boolean)));
    const latestBusLocationsRaw = await this.prisma.location.findMany({
      where: {
        busId: { in: busIds },
        createdAt: { lte: now, gt: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    // Only keep the latest per bus
    const seenBus = new Set<string>();
    const latestBusLocations: Record<string, typeof latestBusLocationsRaw[0]> = {};
    for (const loc of latestBusLocationsRaw) {
      if (!loc.busId || seenBus.has(loc.busId)) continue;
      seenBus.add(loc.busId);
      latestBusLocations[loc.busId] = loc;
    }

    const seen = new Set<string>();
    const latestPerDriver = [] as typeof latestCandidates;
    for (const item of latestCandidates) {
      if (seen.has(item.driverId)) continue;
      seen.add(item.driverId);
      latestPerDriver.push(item);
    }

    const IN_BUS_RADIUS_METERS = 50; // configurable threshold

    const drivers = latestPerDriver.map((item) => {
      const distanceToSchool = this.haversineDistanceMeters(
        geofence.centerLat,
        geofence.centerLng,
        item.latitude,
        item.longitude,
      );

      let busLocation: { latitude: number; longitude: number; createdAt: Date } | null = null;
      let distanceToBus: number | null = null;
      let inBusStatus: string | null = null;
      if (item.busId && latestBusLocations[item.busId]) {
        busLocation = {
          latitude: latestBusLocations[item.busId].latitude,
          longitude: latestBusLocations[item.busId].longitude,
          createdAt: latestBusLocations[item.busId].createdAt,
        };
        distanceToBus = this.haversineDistanceMeters(
          item.latitude,
          item.longitude,
          busLocation.latitude,
          busLocation.longitude,
        );
        inBusStatus = distanceToBus <= IN_BUS_RADIUS_METERS ? 'in-bus' : 'outside';
      }

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
        busLocation,
        distanceToBusMeters: distanceToBus != null ? Math.round(distanceToBus) : null,
        driverBusStatus: inBusStatus,
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