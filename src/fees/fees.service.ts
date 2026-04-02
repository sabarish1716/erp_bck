import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransportService } from '../transport/transport.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { AssignFeeDto } from './dto/assign-fee.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CancelPaymentDto, RefundPaymentDto } from './dto/payment-status.dto';
import { DiscountType, Prisma, Standard } from '@prisma/client';

// Map frontend standard values to Prisma Standard enum
function toStandardEnum(val?: string): Standard {
  if (!val) return Standard.STD_1;
  const upper = val.toUpperCase().trim();
  if (upper === 'LKG') return Standard.LKG;
  if (upper === 'UKG') return Standard.UKG;
  const numMatch = upper.replace(/[^0-9]/g, '');
  if (numMatch) {
    const num = parseInt(numMatch, 10);
    if (num >= 1 && num <= 12) return (`STD_${num}` as Standard);
  }
  if (Object.values(Standard).includes(upper as Standard)) return upper as Standard;
  return Standard.STD_1;
}

@Injectable()
export class FeesService {
  constructor(
    private prisma: PrismaService,
    private transportService: TransportService,
  ) {}

  private getEffectivePaymentAmount(payment: {
    amount: number;
    status?: string | null;
    refundAmount?: number | null;
  }) {
    const status = payment.status || 'SUCCESS';
    if (status === 'CANCELLED') return 0;
    if (status === 'REFUNDED') {
      const refunded = Number(payment.refundAmount ?? payment.amount);
      return Math.max(Number(payment.amount) - refunded, 0);
    }
    return Number(payment.amount);
  }

  private getTotalEffectivePaid(
    payments: Array<{
      amount: number;
      status?: string | null;
      refundAmount?: number | null;
    }>,
  ) {
    return payments.reduce(
      (sum, payment) => sum + this.getEffectivePaymentAmount(payment),
      0,
    );
  }

  private async recalculateTermStatuses(
    studentFeeId: string,
    tx: Prisma.TransactionClient,
  ) {
    const fee = await tx.studentFee.findUnique({
      where: { id: studentFeeId },
      include: {
        terms: { orderBy: { termNumber: 'asc' } },
        payments: true,
      },
    });
    if (!fee) return;

    for (const term of fee.terms) {
      const termPaid = fee.payments
        .filter((p) => p.termNumber === term.termNumber)
        .reduce((sum, p) => sum + this.getEffectivePaymentAmount(p), 0);

      let status = 'PENDING';
      if (termPaid >= term.amount) status = 'PAID';
      else if (termPaid > 0) status = 'PARTIAL';

      await tx.studentFeeTerm.update({
        where: { id: term.id },
        data: { status },
      });
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // FEE STRUCTURE (template per standard + year)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async createFeeStructure(data: CreateFeeStructureDto) {
    const numberOfTerms = data.numberOfTerms || 1;
    const totalBase = data.tuitionFee + (data.transportFee || 0) + (data.bookFee || 0) + (data.hostelFee || 0) + (data.otherFee || 0);

    // Auto-generate terms if not provided
    let termsData = data.terms || [];
    if (termsData.length === 0 && numberOfTerms > 1) {
      const perTerm = Math.round((totalBase / numberOfTerms) * 100) / 100;
      for (let i = 1; i <= numberOfTerms; i++) {
        termsData.push({
          termNumber: i,
          termName: `Term ${i}`,
          amount: i === numberOfTerms ? totalBase - perTerm * (numberOfTerms - 1) : perTerm,
        });
      }
    }

    return await this.prisma.feeStructure.create({
      data: {
        standard: toStandardEnum(data.standard),
        academicYear: data.academicYear,
        tuitionFee: data.tuitionFee,
        transportFee: data.transportFee || 0,
        bookFee: data.bookFee || 0,
        hostelFee: data.hostelFee || 0,
        otherFee: data.otherFee || 0,
        numberOfTerms,
        customItems:
          data.customItems && data.customItems.length > 0
            ? { create: data.customItems }
            : undefined,
        terms:
          termsData.length > 0
            ? { create: termsData.map((t) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null })) }
            : undefined,
      },
      include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
    });
  }

  async updateFeeStructure(id: string, data: CreateFeeStructureDto) {
    const numberOfTerms = data.numberOfTerms || 1;
    const totalBase = data.tuitionFee + (data.transportFee || 0) + (data.bookFee || 0) + (data.hostelFee || 0) + (data.otherFee || 0);

    let termsData = data.terms || [];
    if (termsData.length === 0 && numberOfTerms > 1) {
      const perTerm = Math.round((totalBase / numberOfTerms) * 100) / 100;
      for (let i = 1; i <= numberOfTerms; i++) {
        termsData.push({
          termNumber: i,
          termName: `Term ${i}`,
          amount: i === numberOfTerms ? totalBase - perTerm * (numberOfTerms - 1) : perTerm,
        });
      }
    }

    return await this.prisma.feeStructure.update({
      where: { id },
      data: {
        standard: toStandardEnum(data.standard),
        academicYear: data.academicYear,
        tuitionFee: data.tuitionFee,
        transportFee: data.transportFee || 0,
        bookFee: data.bookFee || 0,
        hostelFee: data.hostelFee || 0,
        otherFee: data.otherFee || 0,
        numberOfTerms,
        customItems: {
          deleteMany: {},
          create: data.customItems || [],
        },
        terms: {
          deleteMany: {},
          create: termsData.map((t) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate) : null })),
        },
      },
      include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
    });
  }

  async getAllFeeStructures() {
    return await this.prisma.feeStructure.findMany({
      include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFeeStructure(id: string) {
    return await this.prisma.feeStructure.findUnique({
      where: { id },
      include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
    });
  }

  async getFeeStructureByStandard(standard: string, academicYear: string) {
    try{
    const structure = await this.prisma.feeStructure.findFirst({
      where: { standard: toStandardEnum(standard), academicYear },
      include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
    });
    console.log('Fetched fee structure:', structure);
    console.log('Standard:', standard, 'Academic Year:', academicYear);
    if (!structure) {
        
      throw new NotFoundException('Fee structure not found for this standard and academic year');
    }
    return structure;
  }catch(error){
    console.error('Error fetching fee structure:', error);
    throw new NotFoundException('Fee structure not found for this standard and academic year');
  }
}

  async deleteFeeStructure(id: string) {
    return await this.prisma.feeStructure.delete({ where: { id } });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ASSIGN FEE TO STUDENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async assignFeeToStudent(data: AssignFeeDto) {
    // If no individual fees provided, try to load from structure
    let tuitionFee = data.tuitionFee ?? 0;
    let transportFee = data.transportFee ?? 0;
    let bookFee = data.bookFee ?? 0;
    let hostelFee = data.hostelFee ?? 0;
    let otherFee = data.otherFee ?? 0;
    let customItems = data.customItems || [];
    let numberOfTerms = 1;
    let structureTerms: { termNumber: number; termName: string; dueDate: Date | null; amount: number }[] = [];
    let customStudentTerms = data.terms || [];

    // Check if student exists (include staffParent for teacher discount check)
    const student = await this.prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        staffParent: true,
        admission: {
          select: {
            isApproved: true,
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.admission?.isApproved) {
      throw new BadRequestException('Fees can be assigned only for approved students');
    }

    // Auto-pull transport fee from route assignment
    try {
      const routeFee = await this.transportService.getTransportFeeForStudent(data.studentId);
      if (routeFee > 0 && data.transportFee === undefined) {
        transportFee = routeFee;
      }
    } catch {
      // Student may not have transport assigned â€” that's fine
    }

    // If tuitionFee not explicitly passed, load from FeeStructure template
    if (data.tuitionFee === undefined) {
      const structure = await this.prisma.feeStructure.findUnique({
        where: {
          standard_academicYear: {
            standard: student.standard,
            academicYear: data.academicYear,
          },
        },
        include: { customItems: true, terms: { orderBy: { termNumber: 'asc' } } },
      });

      if (!structure) {
        throw new BadRequestException(
          `No fee structure found for standard ${student.standard} and academic year ${data.academicYear}. Create a fee structure first.`,
        );
      }

      tuitionFee = structure.tuitionFee;
      transportFee = data.transportFee ?? (transportFee || structure.transportFee);
      bookFee = data.bookFee ?? structure.bookFee;
      hostelFee = data.hostelFee ?? structure.hostelFee;
      otherFee = data.otherFee ?? structure.otherFee;
      numberOfTerms = structure.numberOfTerms;
      structureTerms = structure.terms;

      // Merge custom items: structure defaults + any extra from request
      if (customItems.length === 0 && structure.customItems.length > 0) {
        customItems = structure.customItems.map((ci) => ({
          name: ci.name,
          amount: ci.amount,
        }));
      }
    }

    const customTotal = customItems.reduce((sum, ci) => sum + ci.amount, 0);
    const totalFee = tuitionFee + transportFee + bookFee + hostelFee + otherFee + customTotal;

    // Build discount list: start with explicitly passed discounts
    const allDiscounts: { type: DiscountType; value: number; reason?: string }[] = [...(data.discounts || [])].map((d) => ({
      type: d.type as DiscountType,
      value: d.value,
      reason: d.reason,
    }));

    // Auto-detect teacher discount: student's parent is staff
    if (data.autoTeacherDiscount && student.staffParentId && student.staffParent?.isActive) {
      const alreadyHas = allDiscounts.some((d) => d.type === DiscountType.TEACHER_DISCOUNT);
      if (!alreadyHas) {
        allDiscounts.push({
          type: DiscountType.TEACHER_DISCOUNT,
          value: 10,
          reason: `Staff child discount (Parent: ${student.staffParent.name})`,
        });
      }
    }

    // Auto-detect sibling discount: check if other students share the same siblingGroupId
    if (data.autoSiblingDiscount && student.siblingGroupId) {
      const siblingsCount = await this.prisma.student.count({
        where: {
          siblingGroupId: student.siblingGroupId,
          id: { not: student.id },
        },
      });
      if (siblingsCount > 0) {
        const alreadyHas = allDiscounts.some((d) => d.type === DiscountType.SIBLING_DISCOUNT);
        if (!alreadyHas) {
          allDiscounts.push({
            type: DiscountType.SIBLING_DISCOUNT,
            value: Math.min(siblingsCount * 5, 25),
            reason: `Sibling discount (${siblingsCount} sibling(s) enrolled)`,
          });
        }
      }
    }

    // Auto-detect RTE / community discount
    if (data.autoRteDiscount && (student.rte || ['SC', 'ST', 'SCA'].includes(student.community))) {
      const alreadyHas = allDiscounts.some((d) => d.type === DiscountType.RTE_COMMUNITY);
      if (!alreadyHas) {
        let rtePercent = 0;
        if (student.rte) {
          rtePercent = 100;
        } else if (['SC', 'ST', 'SCA'].includes(student.community)) {
          rtePercent = 50;
        }
        if (rtePercent > 0) {
          allDiscounts.push({
            type: DiscountType.RTE_COMMUNITY,
            value: rtePercent,
            reason: `RTE/Community discount (${student.rte ? 'RTE' : student.community})`,
          });
        }
      }
    }

    // Calculate total discount amount
    let discountAmount = 0;
    for (const d of allDiscounts) {
      if (d.type === DiscountType.FLAT) {
        discountAmount += d.value;
      } else {
        // PERCENTAGE, TEACHER_DISCOUNT, SIBLING_DISCOUNT, RTE_COMMUNITY â€” all percentage-based
        discountAmount += Math.round((totalFee * d.value) / 100 * 100) / 100;
      }
    }
    // Cap discount: cannot exceed totalFee
    discountAmount = Math.min(discountAmount, totalFee);
    const netFee = Math.max(totalFee - discountAmount, 0);

    // Build student term records from custom terms if provided, else from structure
    let studentTerms: { termNumber: number; termName: string; amount: number; dueDate?: Date | null }[] = [];
    if (customStudentTerms.length > 0) {
      // Validate sum of custom term amounts matches netFee
      const sumCustomTerms = customStudentTerms.reduce((sum, t) => sum + t.amount, 0);
      if (Math.abs(sumCustomTerms - netFee) > 0.01) {
        throw new BadRequestException(`Sum of custom term amounts (${sumCustomTerms}) does not match net fee (${netFee})`);
      }
      studentTerms = customStudentTerms.map((t) => ({
        termNumber: t.termNumber,
        termName: t.termName,
        amount: t.amount,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
      }));
      numberOfTerms = customStudentTerms.length;
    } else if (structureTerms.length > 0) {
      // Scale term amounts proportionally to netFee
      const structureTotal = structureTerms.reduce((s, t) => s + t.amount, 0);
      const ratio = structureTotal > 0 ? netFee / structureTotal : 1;
      studentTerms = structureTerms.map((t) => ({
        termNumber: t.termNumber,
        termName: t.termName,
        amount: Math.round(t.amount * ratio * 100) / 100,
        dueDate: t.dueDate,
      }));
      numberOfTerms = structureTerms.length;
    } else if (numberOfTerms > 1) {
      const perTerm = Math.round((netFee / numberOfTerms) * 100) / 100;
      for (let i = 1; i <= numberOfTerms; i++) {
        studentTerms.push({
          termNumber: i,
          termName: `Term ${i}`,
          amount: i === numberOfTerms ? netFee - perTerm * (numberOfTerms - 1) : perTerm,
        });
      }
    }

    return await this.prisma.studentFee.create({
      data: {
        studentId: data.studentId,
        academicYear: data.academicYear,
        tuitionFee,
        transportFee,
        bookFee,
        hostelFee,
        otherFee,
        totalFee,
        discount: discountAmount,
        netFee,
        numberOfTerms,
        customItems:
          customItems.length > 0 ? { create: customItems } : undefined,
        discounts:
          allDiscounts.length > 0
            ? { create: allDiscounts }
            : undefined,
        terms:
          studentTerms.length > 0 ? { create: studentTerms } : undefined,
      },
      include: {
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
        student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
      },
    });
  }

  async updateStudentFee(id: string, data: AssignFeeDto) {
    const existing = await this.prisma.studentFee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Student fee record not found');

    const tuitionFee = data.tuitionFee ?? existing.tuitionFee;
    let transportFee = data.transportFee ?? existing.transportFee;
    const bookFee = data.bookFee ?? existing.bookFee;
    const hostelFee = data.hostelFee ?? existing.hostelFee;
    const otherFee = data.otherFee ?? existing.otherFee;
    const customItems = data.customItems || [];

    // Auto-pull transport fee if not explicitly set
    if (data.transportFee === undefined) {
      try {
        const routeFee = await this.transportService.getTransportFeeForStudent(existing.studentId);
        if (routeFee > 0) transportFee = routeFee;
      } catch {
        // no transport assigned
      }
    }

    const customTotal = customItems.reduce((sum, ci) => sum + ci.amount, 0);
    const totalFee = tuitionFee + transportFee + bookFee + hostelFee + otherFee + customTotal;

    // Build discount list with auto-detection support
    const allDiscounts: { type: DiscountType; value: number; reason?: string }[] = [...(data.discounts || [])].map((d) => ({
      type: d.type as DiscountType,
      value: d.value,
      reason: d.reason,
    }));

    if (data.autoTeacherDiscount || data.autoSiblingDiscount || data.autoRteDiscount) {
      const student = await this.prisma.student.findUnique({
        where: { id: existing.studentId },
        include: { staffParent: true },
      });

      if (student) {
        if (data.autoTeacherDiscount && student.staffParentId && student.staffParent?.isActive) {
          if (!allDiscounts.some((d) => d.type === DiscountType.TEACHER_DISCOUNT)) {
            allDiscounts.push({ type: DiscountType.TEACHER_DISCOUNT, value: 10, reason: `Staff child discount (Parent: ${student.staffParent.name})` });
          }
        }
        if (data.autoSiblingDiscount && student.siblingGroupId) {
          const siblingsCount = await this.prisma.student.count({ where: { siblingGroupId: student.siblingGroupId, id: { not: student.id } } });
          if (siblingsCount > 0 && !allDiscounts.some((d) => d.type === DiscountType.SIBLING_DISCOUNT)) {
            allDiscounts.push({ type: DiscountType.SIBLING_DISCOUNT, value: Math.min(siblingsCount * 5, 25), reason: `Sibling discount (${siblingsCount} sibling(s) enrolled)` });
          }
        }
        if (data.autoRteDiscount) {
          if (student.rte && !allDiscounts.some((d) => d.type === DiscountType.RTE_COMMUNITY)) {
            allDiscounts.push({ type: DiscountType.RTE_COMMUNITY, value: 100, reason: 'RTE discount' });
          } else if (['SC', 'ST', 'SCA'].includes(student.community) && !allDiscounts.some((d) => d.type === DiscountType.RTE_COMMUNITY)) {
            allDiscounts.push({ type: DiscountType.RTE_COMMUNITY, value: 50, reason: `Community discount (${student.community})` });
          }
        }
      }
    }

    let discountAmount = 0;
    for (const d of allDiscounts) {
      if (d.type === DiscountType.FLAT) {
        discountAmount += d.value;
      } else {
        discountAmount += Math.round((totalFee * d.value) / 100 * 100) / 100;
      }
    }
    discountAmount = Math.min(discountAmount, totalFee);
    const netFee = Math.max(totalFee - discountAmount, 0);
    const numberOfTerms = existing.numberOfTerms;

    // Rebuild student term records
    let studentTerms: { termNumber: number; termName: string; amount: number }[] = [];
    if (numberOfTerms > 1) {
      const perTerm = Math.round((netFee / numberOfTerms) * 100) / 100;
      for (let i = 1; i <= numberOfTerms; i++) {
        studentTerms.push({
          termNumber: i,
          termName: `Term ${i}`,
          amount: i === numberOfTerms ? netFee - perTerm * (numberOfTerms - 1) : perTerm,
        });
      }
    }

    return await this.prisma.studentFee.update({
      where: { id },
      data: {
        tuitionFee,
        transportFee,
        bookFee,
        hostelFee,
        otherFee,
        totalFee,
        discount: discountAmount,
        netFee,
        customItems: {
          deleteMany: {},
          create: customItems,
        },
        discounts: {
          deleteMany: {},
          create: allDiscounts,
        },
        terms: {
          deleteMany: {},
          create: studentTerms,
        },
      },
      include: {
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
        payments: true,
        student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
      },
    });
  }

  async getStudentFee(studentId: string, academicYear: string) {
    const fee = await this.prisma.studentFee.findFirst({
      where: { studentId: studentId,
        academicYear:  academicYear },
      include: {
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
      },
    });
    if (!fee) throw new NotFoundException('Fee record not found for this student/year');

    const totalPaid = this.getTotalEffectivePaid(fee.payments);
    return { ...fee, totalPaid, pending: fee.netFee - totalPaid };
  }

  async getStudentFeeById(id: string) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id },
      include: {
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
      },
    });
    if (!fee) throw new NotFoundException('Fee record not found');

    const totalPaid = this.getTotalEffectivePaid(fee.payments);
    return { ...fee, totalPaid, pending: fee.netFee - totalPaid };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PAYMENT COLLECTION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async collectPayment(data: CollectPaymentDto) {
    const studentFee = await this.prisma.studentFee.findUnique({
      where: { id: data.studentFeeId },
      include: {
        payments: true,
        terms: { orderBy: { termNumber: 'asc' } },
        student: {
          include: {
            admission: {
              select: {
                isApproved: true,
              },
            },
          },
        },
      },
    });
    if (!studentFee) throw new NotFoundException('Student fee record not found');
    if (!studentFee.student?.admission?.isApproved) {
      throw new BadRequestException('Payments can be collected only for approved students');
    }

    // Multi-term payment support
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      // Validate total amount
      const totalSplit = data.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(totalSplit - data.amount) > 0.01) {
        throw new BadRequestException(`Sum of split term payments (${totalSplit}) does not match total amount (${data.amount})`);
      }
      // Validate each term
      for (const split of data.payments) {
        const term = studentFee.terms.find((t) => t.termNumber === split.termNumber);
        if (!term) throw new BadRequestException(`Term ${split.termNumber} not found`);
        const termPaid = studentFee.payments
          .filter((p) => p.termNumber === split.termNumber)
          .reduce((sum, p) => sum + this.getEffectivePaymentAmount(p), 0);
        const termPending = term.amount - termPaid;
        if (split.amount > termPending) {
          throw new BadRequestException(`Payment amount (${split.amount}) exceeds term ${split.termNumber} pending balance (${termPending})`);
        }
      }
      // Create a payment record for each term
      return this.prisma.$transaction(async (tx) => {
        const receiptNo = data.receiptNo || (await this.getNextReceiptNo()).nextReceiptNo;
    const createdPayments: any[] = [];

        // data.payments.sort((a, b) => a.termNumber - b.termNumber); // Ensure payments are processed in term order 
        for (const split of data?.payments ?? []) {
          let payment = await tx.payment.create({
            data: {
              studentFeeId: data.studentFeeId,
              amount: split.amount,
              paymentMode: data.paymentMode,
              paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
              receiptNo,
              remarks: data.remarks,
              termNumber: split.termNumber,
              status: 'SUCCESS',
              receiptComponents: data.receiptComponents
                ? (data.receiptComponents as unknown as Prisma.JsonArray)
                : undefined,
            },
            include: {
              studentFee: {
                include: {
                  student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
                  terms: { orderBy: { termNumber: 'asc' } },
                },
              },
            },
          });
          createdPayments.push(payment);
        }
        await this.recalculateTermStatuses(data.studentFeeId, tx);
        return createdPayments;
      });
    }

    // Legacy: single term or overall payment
    // When terms exist, payment must be collected term-wise.
    if (studentFee.terms.length > 0 && !data.termNumber) {
      throw new BadRequestException('Term number is required for term-wise fee collection');
    }

    // If termNumber is specified, validate against term balance
    if (data.termNumber) {
      const term = studentFee.terms.find((t) => t.termNumber === data.termNumber);
      if (!term) throw new BadRequestException(`Term ${data.termNumber} not found`);

      const termPaid = studentFee.payments
        .filter((p) => p.termNumber === data.termNumber)
        .reduce((sum, p) => sum + this.getEffectivePaymentAmount(p), 0);
      const termPending = term.amount - termPaid;

      if (data.amount > termPending) {
        throw new BadRequestException(
          `Payment amount (${data.amount}) exceeds term ${data.termNumber} pending balance (${termPending})`,
        );
      }
    } else {
      const totalPaid = this.getTotalEffectivePaid(studentFee.payments);
      const pending = studentFee.netFee - totalPaid;

      if (data.amount > pending) {
        throw new BadRequestException(
          `Payment amount (${data.amount}) exceeds pending balance (${pending})`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          studentFeeId: data.studentFeeId,
          amount: data.amount,
          paymentMode: data.paymentMode,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          receiptNo: data.receiptNo || (await this.getNextReceiptNo()).nextReceiptNo,
          remarks: data.remarks,
          termNumber: data.termNumber || null,
          status: 'SUCCESS',
          receiptComponents: data.receiptComponents
            ? (data.receiptComponents as unknown as Prisma.JsonArray)
            : undefined,
        },
        include: {
          studentFee: {
            include: {
              student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
              terms: { orderBy: { termNumber: 'asc' } },
            },
          },
        },
      });

      await this.recalculateTermStatuses(data.studentFeeId, tx);
      return payment;
    });
  }

  async getPaymentsByStudentFee(studentFeeId: string) {
    return await this.prisma.payment.findMany({
      where: { studentFeeId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async cancelPayment(paymentId: string, data: CancelPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'CANCELLED') throw new BadRequestException('Payment already cancelled');
    if (payment.status === 'REFUNDED') throw new BadRequestException('Payment already refunded');
    if (payment.status && payment.status !== 'SUCCESS') {
      throw new BadRequestException('Only successful payments can be cancelled or refunded');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'CANCELLED',
          statusReason: data.reason,
          refundAmount: payment.amount,
        },
      });

      await this.recalculateTermStatuses(payment.studentFeeId, tx);
      return updated;
    });
  }

  async refundPayment(paymentId: string, data: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'CANCELLED') throw new BadRequestException('Payment already cancelled');
    if (payment.status === 'REFUNDED') throw new BadRequestException('Payment already refunded');
    if (payment.status && payment.status !== 'SUCCESS') {
      throw new BadRequestException('Only successful payments can be cancelled or refunded');
    }

    if (data.refundAmount > payment.amount) {
      throw new BadRequestException('Refund amount cannot exceed paid amount');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundAmount: data.refundAmount,
          statusReason: data.reason,
        },
      });

      await this.recalculateTermStatuses(payment.studentFeeId, tx);
      return updated;
    });
  }

  async getNextReceiptNo() {
    const lastPayment = await this.prisma.payment.findFirst({
      where: { receiptNo: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { receiptNo: true },
    });

    let nextNo = 'RCP-0001';
    if (lastPayment?.receiptNo) {
      const match = lastPayment.receiptNo.match(/RCP-(\d+)/);
      if (match) {
        const next = parseInt(match[1], 10) + 1;
        nextNo = `RCP-${String(next).padStart(4, '0')}`;
      }
    }

    return { nextReceiptNo: nextNo };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DASHBOARD & REPORTS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getPendingFees(academicYear: string) {
    const fees = await this.prisma.studentFee.findMany({
      where: { academicYear },
      include: {
        payments: true,
        customItems: true,
        terms: { orderBy: { termNumber: 'asc' } },
        student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
      },
    });

    return fees.map((fee) => {
      const totalPaid = this.getTotalEffectivePaid(fee.payments);
      return {
        ...fee,
        totalPaid,
        pending: fee.netFee - totalPaid,
      };
    });
  }

  async getDailyCollection(date?: string) {
    const target = date ? new Date(date) : new Date();
    const startOfDay = new Date(target);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(target);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        studentFee: {
          include: {
            student: { select: { id: true, name: true, standard: true, family: { select: { fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } } } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const totalCollection = this.getTotalEffectivePaid(payments);

    return { date: target.toISOString().split('T')[0], totalCollection, payments };
  }

  async getFeesDashboard(academicYear: string) {
    const fees = await this.prisma.studentFee.findMany({
      where: { academicYear },
      include: { payments: true },
    });

    let totalAssigned = 0;
    let totalCollected = 0;
    let totalPending = 0;

    for (const fee of fees) {
      totalAssigned += fee.netFee;
      const paid = this.getTotalEffectivePaid(fee.payments);
      totalCollected += paid;
      totalPending += fee.netFee - paid;
    }

    // Group by standard
    const byStandard: Record<string, { assigned: number; collected: number; pending: number; count: number }> = {};
    for (const fee of fees) {
      const paid = this.getTotalEffectivePaid(fee.payments);
      const student = await this.prisma.student.findUnique({
        where: { id: fee.studentId },
        select: { standard: true },
      });
      const std = student?.standard || 'Unknown';
      if (!byStandard[std]) {
        byStandard[std] = { assigned: 0, collected: 0, pending: 0, count: 0 };
      }
      byStandard[std].assigned += fee.netFee;
      byStandard[std].collected += paid;
      byStandard[std].pending += fee.netFee - paid;
      byStandard[std].count += 1;
    }

    return {
      academicYear,
      totalStudents: fees.length,
      totalAssigned,
      totalCollected,
      totalPending,
      byStandard,
    };
  }

  async getAllStudentFees(academicYear: string) {
    const fees = await this.prisma.studentFee.findMany({
      where: { academicYear },
      include: {
        student: { select: { id: true, name: true, standard: true, section: true, siblingGroupId: true, address: { select: { line1: true, line2: true, line3: true, pin: true } }, family: { select: { fatherName: true, fatherPhone: true, motherPhone: true, fatherWhatsapp: true, motherWhatsapp: true } }, admission: { select: { admissionNo: true, isApproved: true } }, docRequests: { where: { type: 'TRANSFER_CERTIFICATE' }, select: { status: true }, take: 1 } } },
        payments: true,
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return fees.map((fee) => {
      const totalPaid = this.getTotalEffectivePaid(fee.payments);
      return { ...fee, totalPaid, pending: fee.netFee - totalPaid };
    });
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TRANSPORT FEE MID-TERM RECALCULATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async recalcTransportFee(studentId: string, academicYear: string) {
    const studentFee = await this.prisma.studentFee.findUnique({
      where: { studentId_academicYear: { studentId, academicYear } },
      include: { terms: { orderBy: { termNumber: 'asc' } }, payments: true, discounts: true, customItems: true },
    });
    if (!studentFee) throw new NotFoundException('Student fee record not found');

    // Get current transport fee from route assignment
    let newTransportFee = 0;
    try {
      newTransportFee = await this.transportService.getTransportFeeForStudent(studentId);
    } catch {
      newTransportFee = 0;
    }

    const oldTransportFee = studentFee.transportFee;
    if (newTransportFee === oldTransportFee) {
      return { message: 'No transport fee change detected', studentFee };
    }

    // Find which terms are already PAID â€” don't change those
    const paidTerms = studentFee.terms.filter((t) => t.status === 'PAID');
    const unpaidTerms = studentFee.terms.filter((t) => t.status !== 'PAID');

    // Recalculate: the transport fee difference applies only to unpaid terms
    const totalTerms = studentFee.terms.length || 1;
    const oldPerTermTransport = oldTransportFee / totalTerms;
    const newPerTermTransport = newTransportFee / totalTerms;
    const diffPerTerm = newPerTermTransport - oldPerTermTransport;

    // New total fee
    const newTotalFee = studentFee.totalFee + (diffPerTerm * unpaidTerms.length);

    // Recalculate discount
    let newDiscount = 0;
    for (const d of studentFee.discounts) {
      if (d.type === 'FLAT') {
        newDiscount += d.value;
      } else {
        newDiscount += Math.round((newTotalFee * d.value) / 100 * 100) / 100;
      }
    }
    newDiscount = Math.min(newDiscount, newTotalFee);
    const newNetFee = Math.max(newTotalFee - newDiscount, 0);

    // Update unpaid term amounts
    const termUpdates = unpaidTerms.map((t) => {
      const newAmount = Math.round((t.amount + diffPerTerm) * 100) / 100;
      return this.prisma.studentFeeTerm.update({
        where: { id: t.id },
        data: { amount: Math.max(newAmount, 0) },
      });
    });

    await Promise.all([
      ...termUpdates,
      this.prisma.studentFee.update({
        where: { id: studentFee.id },
        data: {
          transportFee: newTransportFee,
          totalFee: newTotalFee,
          discount: newDiscount,
          netFee: newNetFee,
        },
      }),
    ]);

    return {
      message: `Transport fee updated from â‚¹${oldTransportFee} to â‚¹${newTransportFee}. ${unpaidTerms.length} unpaid term(s) adjusted.`,
      oldTransportFee,
      newTransportFee,
      unpaidTermsAdjusted: unpaidTerms.length,
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ACADEMIC YEARS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async getAcademicYears() {
    const structures = await this.prisma.feeStructure.findMany({
      select: { academicYear: true },
      distinct: ['academicYear'],
      orderBy: { academicYear: 'desc' },
    });
    const studentFees = await this.prisma.studentFee.findMany({
      select: { academicYear: true },
      distinct: ['academicYear'],
    });
    const allYears = new Set([
      ...structures.map((s) => s.academicYear),
      ...studentFees.map((f) => f.academicYear),
    ]);
    return Array.from(allYears).sort().reverse();
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DISCOUNT ELIGIBILITY CHECK
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  async checkDiscountEligibility(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { staffParent: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const eligibility: {
      teacherDiscount: { eligible: boolean; percentage: number; reason: string };
      siblingDiscount: { eligible: boolean; percentage: number; reason: string };
      rteDiscount: { eligible: boolean; percentage: number; reason: string };
    } = {
      teacherDiscount: { eligible: false, percentage: 0, reason: '' },
      siblingDiscount: { eligible: false, percentage: 0, reason: '' },
      rteDiscount: { eligible: false, percentage: 0, reason: '' },
    };

    // Teacher discount
    if (student.staffParentId && student.staffParent?.isActive) {
      eligibility.teacherDiscount = {
        eligible: true,
        percentage: 10,
        reason: `Parent is staff: ${student.staffParent.name} (${student.staffParent.designation})`,
      };
    }

    // Sibling discount
    if (student.siblingGroupId) {
      const siblingsCount = await this.prisma.student.count({
        where: {
          siblingGroupId: student.siblingGroupId,
          id: { not: student.id },
        },
      });
      if (siblingsCount > 0) {
        eligibility.siblingDiscount = {
          eligible: true,
          percentage: Math.min(siblingsCount * 5, 25),
          reason: `${siblingsCount} sibling(s) enrolled in the school`,
        };
      }
    }

    // RTE / Community discount
    if (student.rte) {
      eligibility.rteDiscount = {
        eligible: true,
        percentage: 100,
        reason: 'Student under RTE (Right to Education)',
      };
    } else if (['SC', 'ST', 'SCA'].includes(student.community)) {
      eligibility.rteDiscount = {
        eligible: true,
        percentage: 50,
        reason: `Community-based discount (${student.community})`,
      };
    }

    return eligibility;
  }

  // ═══════════════════════════════════════════════
  // BULK / WHOLE CLASS FEE ASSIGNMENT
  // ═══════════════════════════════════════════════

  async assignFeeToClass(data: {
    standard: string;
    section?: string;
    academicYear: string;
    autoTeacherDiscount?: boolean;
    autoSiblingDiscount?: boolean;
    autoRteDiscount?: boolean;
  }) {
    const where: any = {
      standard: toStandardEnum(data.standard),
      admission: { isApproved: true },
    };
    if (data.section) where.section = data.section;
    if (data.academicYear) where.academicYear = data.academicYear;

    const students = await this.prisma.student.findMany({
      where,
      select: { id: true, name: true },
    });

    if (students.length === 0) {
      throw new BadRequestException('No approved students found for this class/section');
    }

    // Check which students already have a fee record for this academic year
    const existingFees = await this.prisma.studentFee.findMany({
      where: {
        academicYear: data.academicYear,
        studentId: { in: students.map((s) => s.id) },
      },
      select: { studentId: true },
    });
    const alreadyAssigned = new Set(existingFees.map((f) => f.studentId));

    const toAssign = students.filter((s) => !alreadyAssigned.has(s.id));
    if (toAssign.length === 0) {
      return {
        message: `All ${students.length} student(s) already have fees assigned`,
        assigned: 0,
        skipped: students.length,
      };
    }

    const results: { studentId: string; name: string; success: boolean; error?: string }[] = [];

    for (const student of toAssign) {
      try {
        await this.assignFeeToStudent({
          studentId: student.id,
          academicYear: data.academicYear,
          autoTeacherDiscount: data.autoTeacherDiscount,
          autoSiblingDiscount: data.autoSiblingDiscount,
          autoRteDiscount: data.autoRteDiscount,
        });
        results.push({ studentId: student.id, name: student.name, success: true });
      } catch (error: any) {
        results.push({ studentId: student.id, name: student.name, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      message: `Assigned fees to ${successCount}/${toAssign.length} student(s). ${alreadyAssigned.size} already had fees.`,
      assigned: successCount,
      skipped: alreadyAssigned.size,
      failed: toAssign.length - successCount,
      details: results,
    };
  }

  // ═══════════════════════════════════════════════
  // PENDING FEE CHECK (for TC blocking)
  // ═══════════════════════════════════════════════

  async getStudentPendingTotal(studentId: string): Promise<number> {
    const fees = await this.prisma.studentFee.findMany({
      where: { studentId },
      include: { payments: true },
    });

    let totalPending = 0;
    for (const fee of fees) {
      const paid = this.getTotalEffectivePaid(fee.payments);
      totalPending += fee.netFee - paid;
    }
    return totalPending;
  }

  // ═══════════════════════════════════════════════
  // MULTI-YEAR STUDENT FEE LEDGER
  // ═══════════════════════════════════════════════

  async getMultiYearLedger() {
    // Get all student fees grouped by student across all years
    const allFees = await this.prisma.studentFee.findMany({
      include: {
        student: {
          select: {
            id: true, name: true, standard: true, section: true,
            admission: { select: { isApproved: true, admissionNo: true } },
          },
        },
        payments: true,
        discounts: true,
        customItems: true,
      },
      orderBy: [{ student: { name: 'asc' } }, { academicYear: 'asc' }],
    });

    // Collect all unique academic years
    const yearsSet = new Set<string>();
    allFees.forEach((f) => yearsSet.add(f.academicYear));
    const academicYears = Array.from(yearsSet).sort();

    // Group by student
    const studentMap = new Map<string, {
      student: any;
      yearData: Record<string, { totalFee: number; paid: number; discount: number; balance: number }>;
      grandTotal: number;
      grandPaid: number;
      grandDiscount: number;
      grandBalance: number;
    }>();

    for (const fee of allFees) {
      const sid = fee.studentId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          student: fee.student,
          yearData: {},
          grandTotal: 0,
          grandPaid: 0,
          grandDiscount: 0,
          grandBalance: 0,
        });
      }
      const entry = studentMap.get(sid)!;
      const paid = this.getTotalEffectivePaid(fee.payments);
      const discount = fee.discount || 0;
      const balance = fee.netFee - paid;

      entry.yearData[fee.academicYear] = {
        totalFee: fee.totalFee,
        paid,
        discount,
        balance: Math.max(balance, 0),
      };
      entry.grandTotal += fee.totalFee;
      entry.grandPaid += paid;
      entry.grandDiscount += discount;
      entry.grandBalance += Math.max(balance, 0);
    }

    return {
      academicYears,
      students: Array.from(studentMap.values()),
    };
  }

  // ═══════════════════════════════════════════════
  // CLASS-WISE FEE SUMMARY
  // ═══════════════════════════════════════════════

  async getClassWiseSummary(academicYear: string) {
    const fees = await this.prisma.studentFee.findMany({
      where: { academicYear },
      include: {
        student: { select: { standard: true, section: true } },
        payments: true,
        customItems: true,
        discounts: true,
        terms: { orderBy: { termNumber: 'asc' } },
      },
    });

    // Group by standard
    const classMap = new Map<string, {
      standard: string;
      studentCount: number;
      tuitionFee: number;
      transportFee: number;
      bookFee: number;
      hostelFee: number;
      otherFee: number;
      customItemsTotal: number;
      totalFee: number;
      totalDiscount: number;
      totalPaid: number;
      netOutstanding: number;
      termTotals: Record<string, number>;
    }>();

    for (const fee of fees) {
      const std = fee.student?.standard || 'UNKNOWN';
      if (!classMap.has(std)) {
        classMap.set(std, {
          standard: std,
          studentCount: 0,
          tuitionFee: 0,
          transportFee: 0,
          bookFee: 0,
          hostelFee: 0,
          otherFee: 0,
          customItemsTotal: 0,
          totalFee: 0,
          totalDiscount: 0,
          totalPaid: 0,
          netOutstanding: 0,
          termTotals: {},
        });
      }
      const entry = classMap.get(std)!;
      entry.studentCount++;
      entry.tuitionFee += fee.tuitionFee || 0;
      entry.transportFee += fee.transportFee || 0;
      entry.bookFee += fee.bookFee || 0;
      entry.hostelFee += fee.hostelFee || 0;
      entry.otherFee += fee.otherFee || 0;
      entry.customItemsTotal += (fee.customItems || []).reduce((s, ci) => s + (ci.amount || 0), 0);
      entry.totalFee += fee.totalFee || 0;
      entry.totalDiscount += fee.discount || 0;

      const paid = this.getTotalEffectivePaid(fee.payments);
      entry.totalPaid += paid;
      entry.netOutstanding += Math.max(fee.netFee - paid, 0);

      // Aggregate term totals
      for (const term of fee.terms || []) {
        const key = term.termName || `Term ${term.termNumber}`;
        entry.termTotals[key] = (entry.termTotals[key] || 0) + (term.amount || 0);
      }
    }

    // Sort by standard order
    const stdOrder = ['LKG', 'UKG', 'STD_1', 'STD_2', 'STD_3', 'STD_4', 'STD_5', 'STD_6', 'STD_7', 'STD_8', 'STD_9', 'STD_10', 'STD_11', 'STD_12'];
    const rows = Array.from(classMap.values()).sort(
      (a, b) => stdOrder.indexOf(a.standard) - stdOrder.indexOf(b.standard),
    );

    // Grand totals
    const grandTotal = rows.reduce((acc, r) => ({
      studentCount: acc.studentCount + r.studentCount,
      tuitionFee: acc.tuitionFee + r.tuitionFee,
      transportFee: acc.transportFee + r.transportFee,
      bookFee: acc.bookFee + r.bookFee,
      hostelFee: acc.hostelFee + r.hostelFee,
      otherFee: acc.otherFee + r.otherFee,
      customItemsTotal: acc.customItemsTotal + r.customItemsTotal,
      totalFee: acc.totalFee + r.totalFee,
      totalDiscount: acc.totalDiscount + r.totalDiscount,
      totalPaid: acc.totalPaid + r.totalPaid,
      netOutstanding: acc.netOutstanding + r.netOutstanding,
    }), {
      studentCount: 0, tuitionFee: 0, transportFee: 0, bookFee: 0,
      hostelFee: 0, otherFee: 0, customItemsTotal: 0, totalFee: 0,
      totalDiscount: 0, totalPaid: 0, netOutstanding: 0,
    });

    return { rows, grandTotal };
  }
}

