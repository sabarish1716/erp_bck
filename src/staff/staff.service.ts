import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private resolveStaffUserRole(role?: Role) {
    if (!role || role === Role.STAFF) {
      return Role.STAFF;
    }

    if (role === Role.TRANSPORT_MANAGER) {
      return Role.TRANSPORT_MANAGER;
    }

    throw new BadRequestException(
      'Staff users can only be created with STAFF or TRANSPORT_MANAGER role',
    );
  }

  private async generateEmployeeId(client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const staffMembers = await client.staff.findMany({
      select: { employeeId: true },
      orderBy: { createdAt: 'desc' },
    });

    const maxSequence = staffMembers.reduce((maxValue, staff) => {
      const match = staff.employeeId.match(/(\d+)(?!.*\d)/);
      if (!match) return maxValue;
      return Math.max(maxValue, parseInt(match[1], 10));
    }, 0);

    return `EMP${String(maxSequence + 1).padStart(4, '0')}`;
  }

  private handleStaffWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : String(error.meta?.target || 'staff record');

      if (target.includes('employeeId')) {
        throw new ConflictException('Employee ID already exists');
      }

      if (target.includes('email')) {
        throw new ConflictException('A staff record with this email already exists');
      }

      throw new ConflictException('A duplicate staff record already exists');
    }

    throw error;
  }

  async getNextEmployeeId() {
    return { employeeId: await this.generateEmployeeId() };
  }

  async create(data: CreateStaffDto) {
    if (!data.password) {
      throw new BadRequestException('Password is required when creating staff');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const isActive = data.isActive ?? true;
    const userRole = this.resolveStaffUserRole(data.role);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const employeeId = data.employeeId?.trim() || await this.generateEmployeeId(tx);

        const staff = await tx.staff.create({
          data: {
            employeeId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            designation: data.designation,
            department: data.department,
            qualification: data.qualification,
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
            salary: data.salary,
            isActive,
            category: (data.category as any) || 'TEACHING_REGULAR',
            paymentMode: data.paymentMode,
            bankName: data.bankName,
            bankAccountNo: data.bankAccountNo,
            bankIfsc: data.bankIfsc,
            pfJoiningDate: data.pfJoiningDate ? new Date(data.pfJoiningDate) : null,
          },
          include: { children: { select: { id: true, name: true, standard: true } } },
        });

        await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: userRole,
            staffId: staff.id,
            isActive,
          },
        });

        return staff;
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
  }

  async findAll() {
    return this.prisma.staff.findMany({
      include: { children: { select: { id: true, name: true, standard: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTransportManagers() {
    const transportManagerUsers = await this.prisma.user.findMany({
      where: {
        role: Role.TRANSPORT_MANAGER,
        staffId: { not: null },
      },
      select: {
        id: true,
        staffId: true,
        role: true,
        isActive: true,
        email: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const staffIds = transportManagerUsers
      .map((user) => user.staffId)
      .filter((staffId): staffId is string => Boolean(staffId));

    if (staffIds.length === 0) {
      return [];
    }

    const staffMembers = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      include: { children: { select: { id: true, name: true, standard: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const usersByStaffId = new Map(
      transportManagerUsers.map((user) => [user.staffId, user]),
    );

    return staffMembers.map((staff) => ({
      ...staff,
      user: usersByStaffId.get(staff.id)
        ? {
            id: usersByStaffId.get(staff.id)!.id,
            email: usersByStaffId.get(staff.id)!.email,
            role: usersByStaffId.get(staff.id)!.role,
            isActive: usersByStaffId.get(staff.id)!.isActive,
          }
        : null,
    }));
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
    const userRole = this.resolveStaffUserRole(data.role);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const staff = await tx.staff.update({
          where: { id },
          data: {
            employeeId: data.employeeId?.trim() || existing.employeeId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            designation: data.designation,
            department: data.department,
            qualification: data.qualification,
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
            salary: data.salary,
            isActive: data.isActive,
            category: (data.category as any) || undefined,
            paymentMode: data.paymentMode,
            bankName: data.bankName,
            bankAccountNo: data.bankAccountNo,
            bankIfsc: data.bankIfsc,
            pfJoiningDate: data.pfJoiningDate ? new Date(data.pfJoiningDate) : null,
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
              role: userRole,
              staffId: staff.id,
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
              role: userRole,
              staffId: staff.id,
              isActive: data.isActive ?? true,
            },
          });
        }

        return staff;
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
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
