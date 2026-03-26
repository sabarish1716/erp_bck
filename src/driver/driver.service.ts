import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  create(name: string, email: string) {
    return this.prisma.driver.create({
      data: { name, email },
    });
  }

  findAll() {
    return this.prisma.driver.findMany();
  }
}