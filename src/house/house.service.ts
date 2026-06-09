import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';

@Injectable()
export class HouseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHouseDto) {
    return this.prisma.house.create({
      data: {
        name: dto.name,
        colorCode: dto.colorCode,
        motto: dto.motto,
      },
      include: this.fullInclude(),
    });
  }

  async findAll() {
    return this.prisma.house.findMany({
      include: this.fullInclude(),
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const house = await this.prisma.house.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
    if (!house) throw new NotFoundException('House not found');
    return house;
  }

  async update(id: string, dto: UpdateHouseDto) {
    const existing = await this.prisma.house.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('House not found');

    return this.prisma.house.update({
      where: { id },
      data: {
        name: dto.name,
        colorCode: dto.colorCode,
        motto: dto.motto,
        captainId:
          dto.captainId !== undefined ? dto.captainId || null : undefined,
        viceCaptainId:
          dto.viceCaptainId !== undefined
            ? dto.viceCaptainId || null
            : undefined,
        bandCaptainId:
          dto.bandCaptainId !== undefined
            ? dto.bandCaptainId || null
            : undefined,
      },
      include: this.fullInclude(),
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.house.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('House not found');

    // Remove house assignment from all students first
    await this.prisma.student.updateMany({
      where: { houseId: id },
      data: { houseId: null },
    });

    return this.prisma.house.delete({ where: { id } });
  }

  /**
   * Auto-allocate students to houses in round-robin order.
   * Only allocates students who don't already have a house.
   * Optionally filter by standard and academicYear.
   */
  async autoAllocate(filters?: { standard?: string; academicYear?: string }) {
    const houses = await this.prisma.house.findMany({
      orderBy: { name: 'asc' },
    });
    if (houses.length === 0) {
      throw new BadRequestException(
        'No houses configured. Create houses first.',
      );
    }

    const where: any = { houseId: null };
    if (filters?.standard) where.standard = filters.standard;
    if (filters?.academicYear) where.academicYear = filters.academicYear;

    const unassigned = await this.prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true },
    });

    if (unassigned.length === 0) {
      return {
        message: 'All students already have house assignments',
        allocated: 0,
      };
    }

    // Get current counts per house to balance
    const counts: Record<string, number> = {};
    for (const h of houses) {
      counts[h.id] = await this.prisma.student.count({
        where: { houseId: h.id },
      });
    }

    // Sort houses by current count ascending so lowest-count house gets next student
    const sortedHouses = [...houses].sort(
      (a, b) => counts[a.id] - counts[b.id],
    );

    const updates: Promise<any>[] = [];
    for (let i = 0; i < unassigned.length; i++) {
      const houseIdx = i % sortedHouses.length;
      updates.push(
        this.prisma.student.update({
          where: { id: unassigned[i].id },
          data: { houseId: sortedHouses[houseIdx].id },
        }),
      );
    }

    await Promise.all(updates);

    return {
      message: `Allocated ${unassigned.length} student(s) across ${houses.length} house(s)`,
      allocated: unassigned.length,
    };
  }

  /**
   * Assign a single student to a specific house.
   */
  async assignStudent(studentId: string, houseId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const house = await this.prisma.house.findUnique({
      where: { id: houseId },
    });
    if (!house) throw new NotFoundException('House not found');

    return this.prisma.student.update({
      where: { id: studentId },
      data: { houseId },
      select: { id: true, name: true, standard: true, houseId: true },
    });
  }

  /**
   * Remove student from their house.
   */
  async removeStudent(studentId: string) {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { houseId: null },
      select: { id: true, name: true, standard: true, houseId: true },
    });
  }

  private fullInclude() {
    return {
      captain: { select: { id: true, name: true, standard: true } },
      viceCaptain: { select: { id: true, name: true, standard: true } },
      bandCaptain: { select: { id: true, name: true, standard: true } },
      students: {
        select: { id: true, name: true, standard: true, section: true },
        orderBy: { name: 'asc' as const },
      },
    };
  }
}
