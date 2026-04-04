import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  create(name: string, email: string, phone: string, busId: string) {
    return this.prisma.driver.create({
      data: { name, email, phone, busId },
    });
  }

  findAll() {
    return this.prisma.driver.findMany();
  }
}