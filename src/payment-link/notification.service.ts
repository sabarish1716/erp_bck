import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Sends SMS and WhatsApp notifications.
 *
 * SMS  — Fast2SMS (default) or MSG91, configured via SMS_PROVIDER env var.
 * WhatsApp — Twilio WhatsApp API.
 *
 * Required ENV vars:
 *   SMS_PROVIDER       fast2sms | msg91   (default: fast2sms)
 *   FAST2SMS_API_KEY   — for Fast2SMS
 *   MSG91_AUTH_KEY     — for MSG91 SMS
 *   MSG91_TEMPLATE_ID  — for MSG91 (flow template id)
 *   TWILIO_ACCOUNT_SID — for WhatsApp
 *   TWILIO_AUTH_TOKEN  — for WhatsApp
 *   TWILIO_WHATSAPP_FROM — default: whatsapp:+14155238886 (sandbox)
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** Normalise to 10-digit Indian mobile number */
  private normalizePhone(phone: string): string {
    return phone
      .replace(/^\+91/, '')
      .replace(/^91/, '')
      .replace(/\D/g, '')
      .slice(-10);
  }

  async sendSms(phone: string, message: string): Promise<void> {
    const provider = process.env.SMS_PROVIDER || 'fast2sms';
    const normalized = this.normalizePhone(phone);

    if (provider === 'msg91') {
      await this.sendViaMSG91(normalized, message);
    } else {
      await this.sendViaFast2SMS(normalized, message);
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<void> {
    const normalized = this.normalizePhone(phone);
    await this.sendViaTwilioWhatsApp(normalized, message);
  }

  // ── Fast2SMS ──────────────────────────────────────────────────────────────

  private async sendViaFast2SMS(phone: string, message: string): Promise<void> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) throw new Error('FAST2SMS_API_KEY is not configured');

    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: phone,
      },
      {
        headers: { authorization: apiKey },
        timeout: 10000,
      },
    );

    if (!response.data?.return) {
      throw new Error(`Fast2SMS error: ${JSON.stringify(response.data)}`);
    }
    this.logger.log(`SMS sent via Fast2SMS to ${phone}`);
  }

  // ── MSG91 ─────────────────────────────────────────────────────────────────

  private async sendViaMSG91(phone: string, message: string): Promise<void> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) throw new Error('MSG91_AUTH_KEY is not configured');

    // MSG91 quick SMS via DLT route
    const response = await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        template_id: process.env.MSG91_TEMPLATE_ID || '',
        short_url: '1',
        recipients: [
          {
            mobiles: `91${phone}`,
            var1: message,
          },
        ],
      },
      {
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    if (response.data?.type === 'error') {
      throw new Error(`MSG91 error: ${response.data.message}`);
    }
    this.logger.log(`SMS sent via MSG91 to ${phone}`);
  }

  // ── Twilio WhatsApp ───────────────────────────────────────────────────────

  private async sendViaTwilioWhatsApp(phone: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const from       = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) are not configured');
    }

    const toNumber = `whatsapp:+91${phone}`;

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        From: from,
        To:   toNumber,
        Body: message,
      }).toString(),
      {
        auth:    { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    );

    if (response.data?.error_code) {
      throw new Error(`Twilio error ${response.data.error_code}: ${response.data.error_message}`);
    }
    this.logger.log(`WhatsApp sent via Twilio to +91${phone}`);
  }
}
