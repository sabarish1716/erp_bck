import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class PhonePeService {
  private readonly logger = new Logger(PhonePeService.name);

  private readonly merchantId: string;
  private readonly saltKey: string;
  private readonly saltIndex: string;
  private readonly baseUrl: string;
  private readonly callbackUrl: string;
  private readonly redirectUrl: string;

  constructor() {
    // Defaults are PhonePe's public UAT test credentials
    this.merchantId  = process.env.PHONEPE_MERCHANT_ID  || 'PGTESTPAYUAT86';
    this.saltKey     = process.env.PHONEPE_SALT_KEY     || '96434309-7796-489d-8924-ab56988a6076';
    this.saltIndex   = process.env.PHONEPE_SALT_INDEX   || '1';
    this.baseUrl     = process.env.PHONEPE_BASE_URL     || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    this.callbackUrl = process.env.PHONEPE_CALLBACK_URL || 'http://localhost:3000';
    this.redirectUrl = process.env.PHONEPE_REDIRECT_URL || 'http://localhost:5173';
  }

  /** Create a PhonePe Pay Page payment link. Returns the URL to send to the parent. */
  async createPaymentLink(params: {
    merchantTransactionId: string;
    amount: number;          // rupees — will be converted to paise internally
    mobileNumber: string;
    studentFeeId: string;
    studentName: string;
  }): Promise<{ paymentUrl: string }> {
    // Normalise phone — 10 digit Indian mobile
    const phone = params.mobileNumber
      .replace(/^\+91/, '')
      .replace(/^91/, '')
      .replace(/\D/g, '')
      .slice(-10);

    const payload = {
      merchantId: this.merchantId,
      merchantTransactionId: params.merchantTransactionId,
      merchantUserId: `USER_${params.studentFeeId.slice(0, 8).toUpperCase()}`,
      amount: Math.round(params.amount * 100), // rupees → paise
      redirectUrl: `${this.redirectUrl}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${this.callbackUrl}/fees/payment-link/webhook`,
      mobileNumber: phone,
      paymentInstrument: { type: 'PAY_PAGE' },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const apiPath = '/pg/v1/pay';
    const signature = crypto
      .createHash('sha256')
      .update(base64Payload + apiPath + this.saltKey)
      .digest('hex');
    const checksum = `${signature}###${this.saltIndex}`;

    try {
      const response = await axios.post(
        `${this.baseUrl}${apiPath}`,
        { request: base64Payload },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
          },
          timeout: 15000,
        },
      );

      const data = response.data;
      if (!data.success) {
        throw new BadRequestException(
          `PhonePe error: ${data.message || 'Payment link creation failed'}`,
        );
      }

      const paymentUrl: string | undefined =
        data.data?.instrumentResponse?.redirectInfo?.url;

      if (!paymentUrl) {
        throw new BadRequestException('PhonePe did not return a payment URL');
      }

      return { paymentUrl };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('PhonePe API call failed', err?.response?.data || err.message);
      throw new BadRequestException(
        `PhonePe error: ${err?.response?.data?.message || err.message}`,
      );
    }
  }

  /**
   * Verify the X-VERIFY header from PhonePe's webhook callback.
   * PhonePe sends: X-VERIFY = sha256(base64Response + saltKey) ### saltIndex
   */
  verifyWebhookSignature(base64Response: string, xVerify: string): boolean {
    try {
      const [receivedHash] = xVerify.split('###');
      const expectedHash = crypto
        .createHash('sha256')
        .update(base64Response + this.saltKey)
        .digest('hex');
      return expectedHash === receivedHash;
    } catch {
      return false;
    }
  }

  /** Poll PhonePe for payment status. */
  async checkPaymentStatus(merchantTransactionId: string): Promise<any> {
    const apiPath = `/pg/v1/status/${this.merchantId}/${merchantTransactionId}`;
    const signature = crypto
      .createHash('sha256')
      .update(apiPath + this.saltKey)
      .digest('hex');
    const checksum = `${signature}###${this.saltIndex}`;

    try {
      const response = await axios.get(`${this.baseUrl}${apiPath}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': this.merchantId,
        },
        timeout: 10000,
      });
      return response.data;
    } catch (err) {
      this.logger.error('PhonePe status check failed', err?.response?.data || err.message);
      throw new BadRequestException(
        `Status check failed: ${err?.response?.data?.message || err.message}`,
      );
    }
  }
}
