import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, StaffDocumentType } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { CreateStaffDocumentDto } from './dto/staff-document.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  private sanitizePerDaySalary(value?: number) {
    if (value === undefined || value === null) return undefined;
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException('perDaySalary must be a positive number');
    }
    return Number(normalized.toFixed(2));
  }

  private withPerDaySalary<T extends { staffStatutory?: { dailyRate?: number | null } | null }>(staff: T) {
    return {
      ...staff,
      perDaySalary: staff.staffStatutory?.dailyRate ?? null,
    };
  }

  private getLeaveEntitlementByCategory(
    leaveCode: string,
    category: Role | string | undefined,
    fallback: number,
  ) {
    const normalizedCategory = String(category || 'TEACHING_REGULAR');
    const teachingPolicy: Record<string, number> = {
      CL: 12,
      SL: 10,
      EL: 15,
      ML: 180,
      PL: 15,
      LOP: 999,
    };
    const nonTeachingPolicy: Record<string, number> = {
      CL: 12,
      SL: 10,
      EL: 15,
      ML: 180,
      PL: 15,
      LOP: 999,
    };
    const policy = normalizedCategory.startsWith('NON_TEACHING')
      ? nonTeachingPolicy
      : teachingPolicy;
    return policy[leaveCode] ?? fallback;
  }

  private getAcademicYearForDate(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

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
    const perDaySalary = this.sanitizePerDaySalary(data.perDaySalary);

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
            city:data.city,
            pincode:data.pincode,
            area:data.area,
            doorno:data.doorNo,
            state:data.state
            // state:data.state
          },
          include: {
            children: { select: { id: true, name: true, standard: true } },
            staffStatutory: { select: { dailyRate: true } },
          },
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

        await tx.staffStatutory.upsert({
          where: { staffId: staff.id },
          update: {
            ...(perDaySalary !== undefined ? { dailyRate: perDaySalary } : {}),
          },
          create: {
            staffId: staff.id,
            basicSalary: data.salary ?? undefined,
            grossSalary: data.salary ?? undefined,
            ...(perDaySalary !== undefined ? { dailyRate: perDaySalary } : {}),
          },
        });

        const currentAcademicYear = this.getAcademicYearForDate(new Date());
        const activeLeaveTypes = await tx.leaveType.findMany({
          where: { isActive: true },
          select: { id: true, code: true, maxPerYear: true },
        });

        if (activeLeaveTypes.length > 0) {
          const staffCategory = (data.category as string) || 'TEACHING_REGULAR';
          await tx.leaveBalance.createMany({
            data: activeLeaveTypes.map((leaveType) => ({
              staffId: staff.id,
              leaveTypeId: leaveType.id,
              year: currentAcademicYear,
              total: this.getLeaveEntitlementByCategory(
                leaveType.code,
                staffCategory,
                leaveType.maxPerYear,
              ),
              used: 0,
              remaining: this.getLeaveEntitlementByCategory(
                leaveType.code,
                staffCategory,
                leaveType.maxPerYear,
              ),
            })),
            skipDuplicates: true,
          });
        }

        const refreshed = await tx.staff.findUniqueOrThrow({
          where: { id: staff.id },
          include: {
            children: { select: { id: true, name: true, standard: true } },
            staffStatutory: { select: { dailyRate: true } },
          },
        });

        return this.withPerDaySalary(refreshed);
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
  }

  async findAll() {
    const rows = await this.prisma.staff.findMany({
      where:{
        isActive:true,
      },
      include: {
        children: { select: { id: true, name: true, standard: true } },
        staffStatutory: { select: { dailyRate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.withPerDaySalary(row));
  }

  async findTransportManagers() {
    const transportManagerUsers = await this.prisma.user.findMany({
      where: {
        role: Role.TRANSPORT_MANAGER,
        staffId: { not: null },
        isActive:true
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
      include: {
        children: { select: { id: true, name: true, standard: true } },
        staffStatutory: { select: { dailyRate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const usersByStaffId = new Map(
      transportManagerUsers.map((user) => [user.staffId, user]),
    );

    return staffMembers.map((staff) => ({
      ...this.withPerDaySalary(staff),
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
      include: {
        children: { select: { id: true, name: true, standard: true } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        staffStatutory: { select: { dailyRate: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return this.withPerDaySalary(staff);
  }

  async addDocument(staffId: string, data: CreateStaffDocumentDto, file: Express.Multer.File) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    const normalizedPath = file.path.replace(/\\/g, '/');
    const documentType = data.type || StaffDocumentType.OTHER;
    const title = data.title?.trim() || this.buildDocumentTitle(documentType, file.originalname);

    return this.prisma.staffDocument.create({
      data: {
        staffId,
        type: documentType,
        title,
        filePath: normalizedPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        description: data.description?.trim() || null,
        documentNumber: data.documentNumber?.trim() || null,
        issuedDate: data.issuedDate ? new Date(data.issuedDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        isVerified: Boolean(data?.isVerified ?? false),
      },
    });
  }

  async listDocuments(staffId: string, type?: StaffDocumentType) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return this.prisma.staffDocument.findMany({
      where: {
        staffId,
        ...(type ? { type } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async removeDocument(staffId: string, documentId: string) {
    const document = await this.prisma.staffDocument.findFirst({
      where: { id: documentId, staffId },
    });

    if (!document) {
      throw new NotFoundException('Staff document not found');
    }

    await this.prisma.staffDocument.delete({ where: { id: documentId } });

    if (document.filePath && existsSync(document.filePath)) {
      try {
        unlinkSync(document.filePath);
      } catch {
        // File cleanup failures should not block DB deletion.
      }
    }

    return { success: true };
  }

  private buildDocumentTitle(type: StaffDocumentType, originalName: string) {
    const baseName = originalName.replace(/\.[^.]+$/, '').trim();
    if (baseName) return baseName;
    return type.replace(/_/g, ' ');
  }

  async update(id: string, data: CreateStaffDto) {
    const existing = await this.prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Staff not found');

    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;
    const userRole = this.resolveStaffUserRole(data.role);
    const perDaySalary = this.sanitizePerDaySalary(data.perDaySalary);

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
            city:data.city,
            doorno:data.doorNo,
            pincode:data.pincode,
            area:data.area,
            state:data.state
          },
          include: {
            children: { select: { id: true, name: true, standard: true } },
            staffStatutory: { select: { dailyRate: true } },
          },
        });

        if (perDaySalary !== undefined) {
          await tx.staffStatutory.upsert({
            where: { staffId: staff.id },
            update: { dailyRate: perDaySalary },
            create: {
              staffId: staff.id,
              basicSalary: data.salary ?? undefined,
              grossSalary: data.salary ?? undefined,
              dailyRate: perDaySalary,
            },
          });
        }

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

        const refreshed = await tx.staff.findUniqueOrThrow({
          where: { id: staff.id },
          include: {
            children: { select: { id: true, name: true, standard: true } },
            staffStatutory: { select: { dailyRate: true } },
          },
        });

        return this.withPerDaySalary(refreshed);
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
