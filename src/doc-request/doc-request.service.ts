import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDocRequestDto,
  ReviewDocRequestDto,
  IssueDocRequestDto,
  BonafideScenarioType,
} from './create-doc-request.dto';
import { SettingsService } from '../settings/settings.service';

const BONAFIDE_TEMPLATE_MAP: Record<
  BonafideScenarioType,
  {
    code: BonafideScenarioType;
    label: string;
    title: string;
    bodyTemplate: string;
  }
> = {
  [BonafideScenarioType.STUDY_PURPOSE]: {
    code: BonafideScenarioType.STUDY_PURPOSE,
    label: 'General Study Purpose',
    title: 'BONAFIDE CERTIFICATE',
    bodyTemplate:
      'This is to certify that {{studentName}}, {{parentRef}}, DOB {{dob}}, Admission No {{admissionNo}}, is/was a bonafide student of this school from {{fromStd}} to {{toStd}} during the academic year {{academicYear}}. This certificate is issued for {{purpose}}.',
  },
  [BonafideScenarioType.PASSPORT_VISA]: {
    code: BonafideScenarioType.PASSPORT_VISA,
    label: 'Passport / Visa',
    title: 'BONAFIDE CERTIFICATE - PASSPORT / VISA',
    bodyTemplate:
      'This is to certify that {{studentName}}, {{parentRef}}, DOB {{dob}}, Admission No {{admissionNo}}, is/was a bonafide student of this school from {{fromStd}} to {{toStd}} during the academic year {{academicYear}}. This certificate is issued for Passport / Visa processing before {{authority}}.',
  },
  [BonafideScenarioType.SCHOLARSHIP]: {
    code: BonafideScenarioType.SCHOLARSHIP,
    label: 'Scholarship Application',
    title: 'BONAFIDE CERTIFICATE - SCHOLARSHIP',
    bodyTemplate:
      'This is to certify that {{studentName}}, {{parentRef}}, DOB {{dob}}, Admission No {{admissionNo}}, is/was a bonafide student of this school from {{fromStd}} to {{toStd}} during the academic year {{academicYear}}. This certificate is issued for scholarship submission to {{authority}}.',
  },
  [BonafideScenarioType.EDUCATION_LOAN]: {
    code: BonafideScenarioType.EDUCATION_LOAN,
    label: 'Education Loan',
    title: 'BONAFIDE CERTIFICATE - EDUCATION LOAN',
    bodyTemplate:
      'This is to certify that {{studentName}}, {{parentRef}}, DOB {{dob}}, Admission No {{admissionNo}}, is/was a bonafide student of this school from {{fromStd}} to {{toStd}} during the academic year {{academicYear}}. This certificate is issued for education loan processing at {{authority}}.',
  },
};

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

    if (dto.type === 'BONAFIDE_CERTIFICATE' && !dto.bonafideScenario) {
      throw new BadRequestException('Bonafide scenario is required for bonafide certificate requests');
    }

    if (dto.type !== 'BONAFIDE_CERTIFICATE' && dto.bonafideScenario) {
      throw new BadRequestException('Bonafide scenario can only be used with bonafide certificate requests');
    }

    const createData: any = {
      ticketNo,
      studentId: dto.studentId,
      type: dto.type,
      reason: dto.reason,
      bonafideScenario: dto.type === 'BONAFIDE_CERTIFICATE' ? dto.bonafideScenario : undefined,
      bonafidePurpose: dto.type === 'BONAFIDE_CERTIFICATE' ? dto.bonafidePurpose : undefined,
      bonafideAuthority: dto.type === 'BONAFIDE_CERTIFICATE' ? dto.bonafideAuthority : undefined,
      bonafideTemplateText: dto.type === 'BONAFIDE_CERTIFICATE' ? dto.bonafideTemplateText : undefined,
      requestedById,
    };

    return this.prisma.docRequest.create({
      data: createData,
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
    const existing: any = await this.prisma.docRequest.findUnique({
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

    if (existing.type === 'BONAFIDE_CERTIFICATE') {
      if (dto.bonafideScenario) {
        data.bonafideScenario = dto.bonafideScenario;
      }
      if (dto.bonafidePurpose !== undefined) {
        data.bonafidePurpose = dto.bonafidePurpose;
      }
      if (dto.bonafideAuthority !== undefined) {
        data.bonafideAuthority = dto.bonafideAuthority;
      }
      if (dto.bonafideTemplateText !== undefined) {
        data.bonafideTemplateText = dto.bonafideTemplateText;
      }

      const finalScenario = (data.bonafideScenario || existing.bonafideScenario) as BonafideScenarioType | undefined;
      if (!finalScenario) {
        throw new BadRequestException('Bonafide scenario is required before issuing bonafide certificate');
      }
    }

    return this.prisma.docRequest.update({
      where: { id },
      data,
      include: this.INCLUDE_FULL,
    });
  }

  /** Get data needed for PDF generation (school settings + student + request) */
  async getIssueData(id: string) {
    const req: any = await this.findOne(id);
    const schoolSettings = await this.settings.getAdminSettings();
    const selectedTemplate =
      req.type === 'BONAFIDE_CERTIFICATE' && req.bonafideScenario
        ? BONAFIDE_TEMPLATE_MAP[req.bonafideScenario as BonafideScenarioType]
        : null;

    return {
      request: req,
      school: schoolSettings,
      bonafideTemplate: selectedTemplate,
      bonafideTemplates: this.getBonafideTemplates(),
    };
  }

  getBonafideTemplates() {
    return Object.values(BONAFIDE_TEMPLATE_MAP);
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
