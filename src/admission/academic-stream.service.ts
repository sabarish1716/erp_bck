import { Injectable, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicStreamDto } from './create-academic-stream.dto';

const DEFAULT_STREAMS = [
  { name: 'BIO_MATHS', label: 'Biology & Maths', isCustom: false },
  { name: 'CS_MATHS', label: 'Computer Science & Maths', isCustom: false },
  { name: 'BIO_CS', label: 'Biology & Computer Science', isCustom: false },
  { name: 'COMMERCE', label: 'Commerce', isCustom: false },
  { name: 'HUMANITIES', label: 'Humanities', isCustom: false },
];

@Injectable()
export class AcademicStreamService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    for (const stream of DEFAULT_STREAMS) {
      await this.prisma.academicStream.upsert({
        where: { name: stream.name },
        update: {},
        create: {
          ...stream,
          isActive: true
        },
      });
    }
  }

  async findAll() {
    return this.prisma.academicStream.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateAcademicStreamDto) {
    const existing = await this.prisma.academicStream.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictException('Academic stream already exists');
    }

    return this.prisma.academicStream.create({
      data: {
        ...data,
        isCustom: data.isCustom ?? true,
      },
    });
  }

  async findOrCreate(name: string, label: string) {
    const existing = await this.prisma.academicStream.findUnique({
      where: { name },
    });

    if (existing) return existing;

    return this.prisma.academicStream.create({
      data: {
        name,
        label,
        isCustom: true,
      },
    });
  }
}

