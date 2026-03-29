import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  HttpCode,
  Request,
} from '@nestjs/common';
import { PaymentLinkService } from './payment-link.service';
import { SendPaymentLinkDto } from './dto/send-payment-link.dto';
import { Public } from '../auth/public.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('fees/payment-link')
export class PaymentLinkController {
  constructor(private readonly paymentLinkService: PaymentLinkService) {}

  /**
   * Create a PhonePe payment link and send it via SMS or WhatsApp.
   * POST /fees/payment-link/send
   */
  @Post('send')
  @Permissions(Permission.FEES_COLLECT)
  async sendPaymentLink(@Body() dto: SendPaymentLinkDto, @Request() req: any) {
    return this.paymentLinkService.sendPaymentLink(dto);
  }

  /**
   * List all payment links for a student fee.
   * GET /fees/payment-link/by-fee/:studentFeeId
   */
  @Get('by-fee/:studentFeeId')
  async getPaymentLinks(@Param('studentFeeId') studentFeeId: string) {
    return this.paymentLinkService.getPaymentLinksForStudentFee(studentFeeId);
  }

  /**
   * Poll PhonePe for status of a specific link.
   * GET /fees/payment-link/status/:merchantTransactionId
   */
  @Get('status/:merchantTransactionId')
  async checkStatus(@Param('merchantTransactionId') mTxnId: string) {
    return this.paymentLinkService.checkPaymentStatus(mTxnId);
  }

  /**
   * PhonePe callback webhook — must be public (no JWT required).
   * POST /fees/payment-link/webhook
   *
   * PhonePe sends: { "response": "<base64_encoded_payload>" }
   * with header:   X-VERIFY: sha256(response + saltKey)###saltIndex
   */
  @Post('webhook')
  @HttpCode(200)
  @Public()
  async handleWebhook(
    @Body() body: { response?: string },
    @Headers('x-verify') xVerify: string,
  ) {
    const base64Response = body?.response || '';
    await this.paymentLinkService.handlePhonePeWebhook(base64Response, xVerify || '');
    return { success: true };
  }
}
