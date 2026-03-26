import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        driverId: dto.driverId,
        busId: dto.busId || "",
        createdAt: new Date(),
      },
    });
  }

  async getLatestLocation(driverId: string) {
    return this.prisma.location.findFirst({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }
}