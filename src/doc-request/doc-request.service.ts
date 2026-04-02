import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocRequestDto, ReviewDocRequestDto, IssueDocRequestDto } from './create-doc-request.dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DocRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private readonly INCLUDE_FULL = {
    student: {
      include: {
        family: true,
        address: true,
        admission: true,
        academics: { include: { subjects: true } },
      },
    },
    requestedBy: { select: { id: true, name: true, email: true, role: true } },
    reviewedBy: { select: { id: true, name: true, email: true, role: true } },
    issuedBy: { select: { id: true, name: true, email: true, role: true } },
  };

  /** Generate next ticket number: DOC-2026-00001 */
  private async nextTicketNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;

    const last = await this.prisma.docRequest.findFirst({
      where: { ticketNo: { startsWith: prefix } },
      orderBy: { ticketNo: 'desc' },
      select: { ticketNo: true },
    });

    let seq = 1;
    if (last) {
      const parts = last.ticketNo.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /** Create a new document request (ticket) */
  async create(dto: CreateDocRequestDto, requestedById: number) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const ticketNo = await this.nextTicketNo();

    return this.prisma.docRequest.create({
      data: {
        ticketNo,
        studentId: dto.studentId,
        type: dto.type,
        reason: dto.reason,
        requestedById,
      },
      include: this.INCLUDE_FULL,
    });
  }

  /** Get all requests (optionally filtered) */
  async findAll(filters?: { status?: string; type?: string; studentId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.studentId) where.studentId = filters.studentId;

    return this.prisma.docRequest.findMany({
      where,
      include: this.INCLUDE_FULL,
      orderBy: { requestedAt: 'desc' },
    });
  }

  /** Get single request by ID */
  async findOne(id: string) {
    const req = await this.prisma.docRequest.findUnique({
      where: { id },
      include: this.INCLUDE_FULL,
    });
    if (!req) throw new NotFoundException('Document request not found');
    return req;
  }

  /** Review a request: approve, reject, or mark in-review */
  async review(id: string, dto: ReviewDocRequestDto, reviewedById: number) {
    const existing = await this.prisma.docRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document request not found');

    if (existing.status === 'ISSUED') {
      throw new BadRequestException('Cannot modify an already-issued document');
    }

    const data: any = {
      status: dto.status,
      reviewedById,
      reviewedAt: new Date(),
      remarks: dto.remarks ?? existing.remarks,
    };

    if (dto.status === 'REJECTED') {
      data.rejectionReason = dto.rejectionReason || 'No reason provided';
    }

    return this.prisma.docRequest.update({
      where: { id },
      data,
      include: this.INCLUDE_FULL,
    });
  }

  /** Issue the document: mark as ISSUED, save TC fields, return data for PDF */
  async issue(id: string, dto: IssueDocRequestDto, issuedById: number) {
    const existing = await this.prisma.docRequest.findUnique({
      where: { id },
      include: this.INCLUDE_FULL,
    });
    if (!existing) throw new NotFoundException('Document request not found');

    if (existing.status === 'ISSUED') {
      throw new BadRequestException('Document has already been issued');
    }

    // TC: Block issuance if student has pending fees
    if (existing.type === 'TRANSFER_CERTIFICATE') {
      const studentFees = await this.prisma.studentFee.findMany({
        where: { studentId: existing.studentId },
        include: { payments: true },
      });
      let totalPending = 0;
      for (const fee of studentFees) {
        const effectivePaid = fee.payments.reduce((sum, p) => {
          if (p.status === 'CANCELLED') return sum;
          if (p.status === 'REFUNDED') return sum + p.amount - (p.refundAmount || 0);
          return sum + p.amount;
        }, 0);
        totalPending += fee.netFee - effectivePaid;
      }
      if (totalPending > 0) {
        throw new BadRequestException(
          `Cannot issue Transfer Certificate. Student has pending fees of ₹${totalPending.toFixed(2)}. Clear all dues first.`,
        );
      }
    }

    const data: any = {
      status: 'ISSUED',
      issuedAt: new Date(),
      issuedById,
    };

    // TC-specific fields
    if (existing.type === 'TRANSFER_CERTIFICATE') {
      data.tcNo = dto.tcNo || existing.tcNo;
      data.tcDate = dto.tcDate ? new Date(dto.tcDate) : new Date();
      data.leavingReason = dto.leavingReason || existing.leavingReason;
      data.conductRemark = dto.conductRemark || existing.conductRemark || 'Good';
      data.qualifiedForPromotion = dto.qualifiedForPromotion ?? existing.qualifiedForPromotion ?? true;
      data.dateOfLeaving = dto.dateOfLeaving ? new Date(dto.dateOfLeaving) : undefined;
      data.lastAttendedDate = dto.lastAttendedDate ? new Date(dto.lastAttendedDate) : undefined;
    }

    return this.prisma.docRequest.update({
      where: { id },
      data,
      include: this.INCLUDE_FULL,
    });
  }

  /** Get data needed for PDF generation (school settings + student + request) */
  async getIssueData(id: string) {
    const req = await this.findOne(id);
    const schoolSettings = await this.settings.getAdminSettings();
    return { request: req, school: schoolSettings };
  }

  /** Dashboard statistics */
  async getStats() {
    const [total, requested, inReview, approved, issued, rejected] = await Promise.all([
      this.prisma.docRequest.count(),
      this.prisma.docRequest.count({ where: { status: 'REQUESTED' } }),
      this.prisma.docRequest.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.docRequest.count({ where: { status: 'APPROVED' } }),
      this.prisma.docRequest.count({ where: { status: 'ISSUED' } }),
      this.prisma.docRequest.count({ where: { status: 'REJECTED' } }),
    ]);
    return { total, requested, inReview, approved, issued, rejected };
  }

  /** Delete a request (only if not yet issued) */
  async remove(id: string) {
    const existing = await this.prisma.docRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document request not found');
    if (existing.status === 'ISSUED') {
      throw new BadRequestException('Cannot delete an already-issued document');
    }
    return this.prisma.docRequest.delete({ where: { id } });
  }
}
