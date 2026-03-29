import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateStaffDto) {
    if (!data.password) {
      throw new BadRequestException('Password is required when creating staff');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const isActive = data.isActive ?? true;

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          employeeId: data.employeeId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          designation: data.designation,
          department: data.department,
          qualification: data.qualification,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
          salary: data.salary,
          isActive,
        },
        include: { children: { select: { id: true, name: true, standard: true } } },
      });

      await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
          role: Role.STAFF,
          isActive,
        },
      });

      return staff;
    });
  }

  async findAll() {
    return this.prisma.staff.findMany({
      include: { children: { select: { id: true, name: true, standard: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: { children: { select: { id: true, name: true, standard: true } } },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async update(id: string, data: CreateStaffDto) {
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff not found');

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({
        where: { id },
        data: {
          employeeId: data.employeeId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          designation: data.designation,
          department: data.department,
          qualification: data.qualification,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
          salary: data.salary,
          isActive: data.isActive,
        },
        include: { children: { select: { id: true, name: true, standard: true } } },
      });

      const existingUser = await tx.user.findUnique({ where: { email: existing.email } });

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: data.name,
            email: data.email,
            isActive: data.isActive,
            ...(hashedPassword ? { password: hashedPassword } : {}),
          },
        });
      } else {
        await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword ?? (await bcrypt.hash('changeme123', 10)),
            role: Role.STAFF,
            isActive: data.isActive ?? true,
          },
        });
      }

      return staff;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff not found');

    // Soft delete
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.user.updateMany({
        where: { email: existing.email },
        data: { isActive: false },
      });

      return staff;
    });
  }

  async linkChildToStaff(staffId: string, studentId: string) {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { staffParentId: staffId },
    });
  }

  async unlinkChildFromStaff(studentId: string) {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { staffParentId: null },
    });
  }
}
