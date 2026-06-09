import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PhonePeService } from './phonepe.service';
import { NotificationService } from './notification.service';
import { SendPaymentLinkDto } from './dto/send-payment-link.dto';

@Injectable()
export class PaymentLinkService {
  private readonly logger = new Logger(PaymentLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly phonePe: PhonePeService,
    private readonly notification: NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getEffectivePaymentAmount(payment: {
    amount: number;
    manualDiscount?: number | null;
    status?: string | null;
    refundAmount?: number | null;
  }): number {
    const baseAmount = Number(payment.amount || 0);
    const manualDiscount = Math.max(Number(payment.manualDiscount || 0), 0);
    const status = payment.status || 'SUCCESS';
    if (status === 'CANCELLED') return 0;
    if (status === 'REFUNDED') {
      const netAmount = Math.max(
        baseAmount - Number(payment.refundAmount ?? payment.amount),
        0,
      );
      if (baseAmount <= 0) return 0;
      const discountShare = manualDiscount * (netAmount / baseAmount);
      return netAmount + discountShare;
    }
    return baseAmount + manualDiscount;
  }

  /** Recalculate PENDING / PARTIAL / PAID status for each term after a webhook payment. */
  private async recalculateTermStatuses(
    studentFeeId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
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

  private isPhonePeSuccess(phonePeStatus: any): boolean {
    const code = String(phonePeStatus?.code || '').toUpperCase();
    const state = String(phonePeStatus?.data?.state || '').toUpperCase();
    const responseCode = String(
      phonePeStatus?.data?.responseCode || '',
    ).toUpperCase();

    return (
      code === 'PAYMENT_SUCCESS' ||
      state === 'COMPLETED' ||
      responseCode === 'SUCCESS'
    );
  }

  private isPhonePePending(phonePeStatus: any): boolean {
    const code = String(phonePeStatus?.code || '').toUpperCase();
    const state = String(phonePeStatus?.data?.state || '').toUpperCase();

    return code === 'PAYMENT_PENDING' || state === 'PENDING';
  }

  private async recordSuccessfulPaymentForLink(
    paymentLinkId: string,
    phonePeTxnId?: string,
  ): Promise<void> {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      include: {
        studentFee: {
          include: {
            payments: true,
            terms: { orderBy: { termNumber: 'asc' } },
          },
        },
      },
    });

    if (!paymentLink) {
      this.logger.warn(
        `PhonePe reconcile: PaymentLink not found (${paymentLinkId})`,
      );
      return;
    }

    if (paymentLink.status === 'SUCCESS' && paymentLink.paymentId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const refreshedFee = await tx.studentFee.findUnique({
        where: { id: paymentLink.studentFeeId },
        include: { payments: true },
      });
      if (!refreshedFee) return;

      const totalPaid = refreshedFee.payments.reduce(
        (sum, p) => sum + this.getEffectivePaymentAmount(p),
        0,
      );
      const pending = Number(refreshedFee.netFee) - totalPaid;

      if (Number(paymentLink.amount) > pending + 0.01) {
        await tx.paymentLink.update({
          where: { id: paymentLink.id },
          data: {
            status: 'FAILED',
            notificationError: `Payment received but amount exceeds current pending balance (pending: ₹${pending.toFixed(2)}). Please reconcile manually.`,
          },
        });
        this.logger.warn(
          `PhonePe reconcile: amount ${paymentLink.amount} > pending ${pending} for ${paymentLink.merchantTransactionId}`,
        );
        return;
      }

      const lastPayment = await tx.payment.findFirst({
        where: { receiptNo: { startsWith: 'RCP-' } },
        orderBy: { createdAt: 'desc' },
      });
      const lastNum = lastPayment
        ? parseInt((lastPayment.receiptNo || 'RCP-0000').split('-')[1], 10)
        : 0;
      const receiptNo = `RCP-${String(lastNum + 1).padStart(4, '0')}`;

      const payment = await tx.payment.create({
        data: {
          studentFeeId: paymentLink.studentFeeId,
          amount: Number(paymentLink.amount),
          paymentDate: new Date(),
          paymentMode: 'PHONEPE',
          receiptNo,
          remarks: `PhonePe online payment. TxnId: ${phonePeTxnId || paymentLink.merchantTransactionId}`,
          status: 'SUCCESS',
        },
      });

      await this.recalculateTermStatuses(paymentLink.studentFeeId, tx);

      await tx.paymentLink.update({
        where: { id: paymentLink.id },
        data: {
          status: 'SUCCESS',
          paymentId: payment.id,
          notificationError: null,
        },
      });

      this.logger.log(
        `PhonePe payment auto-recorded: ${receiptNo} | ₹${paymentLink.amount} | ${paymentLink.merchantTransactionId}`,
      );
    });
  }

  private async reconcilePaymentLinkByStatus(
    paymentLinkId: string,
    phonePeStatus: any,
  ): Promise<void> {
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
    });
    if (!paymentLink) return;
    if (paymentLink.status !== 'PENDING') return;

    if (this.isPhonePeSuccess(phonePeStatus)) {
      const phonePeTxnId = String(
        phonePeStatus?.data?.transactionId || '',
      ).trim();
      await this.recordSuccessfulPaymentForLink(
        paymentLink.id,
        phonePeTxnId || undefined,
      );
      return;
    }

    if (this.isPhonePePending(phonePeStatus)) {
      return;
    }

    const statusCode = String(
      phonePeStatus?.code || phonePeStatus?.data?.state || 'FAILED',
    );
    await this.prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: {
        status: 'FAILED',
        notificationError: `PhonePe status: ${statusCode}`,
      },
    });
  }

  // ── Create & send payment link ─────────────────────────────────────────────

  async sendPaymentLink(dto: SendPaymentLinkDto) {
    // 1. Load the student fee with current payments and student/family data
    const studentFee = await this.prisma.studentFee.findUnique({
      where: { id: dto.studentFeeId },
      include: {
        payments: true,
        terms: { orderBy: { termNumber: 'asc' } },
        student: {
          select: {
            id: true,
            name: true,
            standard: true,
            family: {
              select: {
                fatherPhone: true,
                motherPhone: true,
                fatherWhatsapp: true,
                motherWhatsapp: true,
              },
            },
          },
        },
      },
    });

    if (!studentFee)
      throw new NotFoundException('Student fee record not found');

    // 2. Validate amount against pending balance
    const totalPaid = studentFee.payments.reduce(
      (sum, p) => sum + this.getEffectivePaymentAmount(p),
      0,
    );
    const pending = Number(studentFee.netFee) - totalPaid;

    if (pending <= 0) {
      throw new BadRequestException('No pending fees for this student');
    }
    if (dto.amount > pending) {
      throw new BadRequestException(
        `Amount (₹${dto.amount}) exceeds pending balance (₹${pending.toFixed(2)})`,
      );
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // 3. Unique merchant transaction ID
    const merchantTransactionId = `TXN${Date.now()}${dto.studentFeeId.slice(0, 6).toUpperCase()}`;

    // 4. Create PhonePe payment link
    const { paymentUrl } = await this.phonePe.createPaymentLink({
      merchantTransactionId,
      amount: dto.amount,
      mobileNumber: dto.phoneNumber,
      studentFeeId: dto.studentFeeId,
      studentName: studentFee.student.name,
    });

    // 5. Persist the link record
    const record = await this.prisma.paymentLink.create({
      data: {
        studentFeeId: dto.studentFeeId,
        amount: dto.amount,
        phoneNumber: dto.phoneNumber,
        channel: dto.channel,
        merchantTransactionId,
        phonePeUrl: paymentUrl,
        status: 'PENDING',
      },
    });

    // 6. Send notification (non-blocking — failure only warns, link still usable)
    const studentName = studentFee.student.name;
    const schoolName = process.env.SCHOOL_NAME || 'School';
    const message =
      `Dear Parent, please pay ₹${dto.amount} towards ${studentName}'s school fees.\n` +
      `Click here to pay: ${paymentUrl}\n` +
      `This link expires in 20 minutes. - ${schoolName}`;

    let notificationSent = false;
    let notificationError: string | null = null;

    try {
      if (dto.channel === 'SMS') {
        await this.notification.sendSms(dto.phoneNumber, message);
      } else {
        await this.notification.sendWhatsApp(dto.phoneNumber, message);
      }
      notificationSent = true;
    } catch (err) {
      notificationError = (err as Error).message;
      this.logger.warn(
        `${dto.channel} notification failed for link ${record.id}: ${notificationError}`,
      );
    }

    const updated = await this.prisma.paymentLink.update({
      where: { id: record.id },
      data: { notificationSent, notificationError },
    });

    return {
      ...updated,
      paymentUrl,
      notificationSent,
      notificationWarning: notificationError
        ? `Payment link created, but ${dto.channel} notification failed: ${notificationError}. Share the link manually.`
        : null,
    };
  }

  // ── List links for a student fee ──────────────────────────────────────────

  async getPaymentLinksForStudentFee(studentFeeId: string) {
    const links = await this.prisma.paymentLink.findMany({
      where: { studentFeeId },
      orderBy: { createdAt: 'desc' },
    });

    // Opportunistically reconcile pending links even if webhook was missed.
    for (const link of links) {
      if (link.status !== 'PENDING') continue;
      try {
        const status = await this.phonePe.checkPaymentStatus(
          link.merchantTransactionId,
        );
        await this.reconcilePaymentLinkByStatus(link.id, status);
      } catch (err) {
        this.logger.warn(
          `PhonePe reconcile skipped for ${link.merchantTransactionId}: ${(err as Error).message}`,
        );
      }
    }

    return this.prisma.paymentLink.findMany({
      where: { studentFeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PhonePe webhook handler ───────────────────────────────────────────────

  /**
   * Called by PhonePe when payment is completed.
   * Body is:  { "response": "<base64_encoded_json>" }
   * X-VERIFY: sha256(base64Response + saltKey)###saltIndex
   */
  async handlePhonePeWebhook(
    base64Response: string,
    xVerify: string,
  ): Promise<void> {
    // Verify signature
    if (!this.phonePe.verifyWebhookSignature(base64Response, xVerify)) {
      this.logger.warn(
        'PhonePe webhook: signature verification failed — ignoring',
      );
      return;
    }

    // Decode payload
    let event: any;
    try {
      const decoded = Buffer.from(base64Response, 'base64').toString('utf-8');
      event = JSON.parse(decoded);
    } catch {
      this.logger.error('PhonePe webhook: failed to decode/parse payload');
      return;
    }

    const merchantTransactionId: string = event?.data?.merchantTransactionId;
    const phonePeTransactionId: string = event?.data?.transactionId || '';

    if (!merchantTransactionId) {
      this.logger.warn('PhonePe webhook: missing merchantTransactionId');
      return;
    }

    // Find our record
    const paymentLink = await this.prisma.paymentLink.findUnique({
      where: { merchantTransactionId },
      include: {
        studentFee: {
          include: {
            payments: true,
            terms: { orderBy: { termNumber: 'asc' } },
          },
        },
      },
    });

    if (!paymentLink) {
      this.logger.warn(
        `PhonePe webhook: no PaymentLink found for ${merchantTransactionId}`,
      );
      return;
    }

    if (paymentLink.status !== 'PENDING') {
      this.logger.log(
        `PhonePe webhook: ${merchantTransactionId} already processed (${paymentLink.status})`,
      );
      return;
    }

    try {
      await this.reconcilePaymentLinkByStatus(paymentLink.id, event);
      if (this.isPhonePeSuccess(event)) {
        this.logger.log(
          `PhonePe webhook: success reconciled for ${merchantTransactionId} (${phonePeTransactionId})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `PhonePe webhook: error reconciling payment — ${(err as Error).message}`,
      );
    }
  }

  // ── Check status ──────────────────────────────────────────────────────────

  async checkPaymentStatus(merchantTransactionId: string) {
    const paymentLinkBefore = await this.prisma.paymentLink.findUnique({
      where: { merchantTransactionId },
    });

    if (!paymentLinkBefore)
      throw new NotFoundException('Payment link not found');

    if (paymentLinkBefore.status !== 'PENDING') {
      return { paymentLink: paymentLinkBefore, phonePeStatus: null };
    }

    const phonePeStatus = await this.phonePe.checkPaymentStatus(
      merchantTransactionId,
    );
    await this.reconcilePaymentLinkByStatus(
      paymentLinkBefore.id,
      phonePeStatus,
    );

    const paymentLinkAfter = await this.prisma.paymentLink.findUnique({
      where: { merchantTransactionId },
    });

    return { paymentLink: paymentLinkAfter, phonePeStatus };
  }
}
