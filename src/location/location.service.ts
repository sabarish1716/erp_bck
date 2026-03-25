// location.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationGateway } from './location.gateway';

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private gateway: LocationGateway,
  ) {}

  async updateLocation(data: UpdateLocationDto) {
    const location = await this.prisma.location.create({
      data: {
        vanId: data.vanId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    // 🔥 Emit real-time update
    this.gateway.sendLocationUpdate({
      vanId: data.vanId,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date(),
    });

    return location;
  }

  async getLatestLocation(vanId: string) {
    return this.prisma.location.findFirst({
      where: { vanId },
      orderBy: { createdAt: 'desc' },
    });
  }
}