import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import dns from 'node:dns/promises';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

function assertSmtpConfigured(): void {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass || !env.smtp.from) {
    throw new HttpError(500, 'Chưa cấu hình SMTP để gửi email đặt lại mật khẩu');
  }
}

function assertResendConfigured(): void {
  if (!env.resend.apiKey || !env.smtp.from) {
    throw new HttpError(500, 'Chưa cấu hình Resend để gửi email đặt lại mật khẩu');
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  const subject = 'CANH BAO: Dat lai mat khau WDP Horse Race';
  const text = [
    `Xin chao ${input.fullName},`,
    '',
    'Ban vua yeu cau dat lai mat khau cho tai khoan WDP Horse Race.',
    `Link co hieu luc trong ${input.expiresMinutes} phut:`,
    input.resetUrl,
    '',
    'Neu ban khong yeu cau, vui long bo qua email nay.',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:28px;background:#fff4ed;font-family:Arial,sans-serif;color:#24130b">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:3px solid #c0380a;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(83,30,8,.18)">
        <div style="background:#c0380a;color:#fff;padding:22px 26px">
          <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">WDP Horse Race</div>
          <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25">YEU CAU DAT LAI MAT KHAU</h1>
        </div>
        <div style="padding:28px 26px">
          <p style="font-size:16px;line-height:1.7;margin:0 0 12px">Xin chao <strong>${input.fullName}</strong>,</p>
          <p style="font-size:16px;line-height:1.7;margin:0 0 18px">He thong nhan duoc yeu cau dat lai mat khau cho tai khoan cua ban. Bam nut ben duoi de tao mat khau moi.</p>
          <div style="margin:24px 0;text-align:center">
            <a href="${input.resetUrl}" style="display:inline-block;background:#c0380a;color:#fff;text-decoration:none;font-weight:900;font-size:16px;letter-spacing:.04em;padding:16px 26px;border-radius:999px">DAT LAI MAT KHAU</a>
          </div>
          <div style="background:#fff0d6;border-left:6px solid #ad6400;padding:14px 16px;border-radius:10px;margin:20px 0">
            <strong style="display:block;margin-bottom:4px">LUU Y QUAN TRONG</strong>
            Link nay chi co hieu luc trong <strong>${input.expiresMinutes} phut</strong>. Neu ban khong yeu cau, hay bo qua email nay.
          </div>
          <p style="font-size:13px;line-height:1.6;color:#74574b;margin:18px 0 0">Neu nut khong mo duoc, copy link nay vao trinh duyet:<br><a href="${input.resetUrl}" style="color:#c0380a;word-break:break-all">${input.resetUrl}</a></p>
        </div>
      </div>
    </div>
  `;

  if (env.resend.apiKey) {
    await sendWithResend({
      to: input.to,
      subject,
      text,
      html,
    });
    return;
  }

  await sendWithSmtp({
    to: input.to,
    subject,
    text,
    html,
  });
}

async function sendWithResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  assertResendConfigured();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.smtp.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API ${response.status}: ${body}`);
    }
  } catch (error) {
    console.error('Password reset email failed', {
      provider: 'resend',
      to: input.to,
      mailFrom: env.smtp.from,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError(500, 'Không gửi được email đặt lại mật khẩu. Vui lòng kiểm tra cấu hình Resend.');
  }
}

async function sendWithSmtp(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  assertSmtpConfigured();

  const smtpHost = env.smtp.host;
  const [smtpIPv4] = await dns.resolve4(smtpHost);
  const connectionHost = smtpIPv4 || smtpHost;

  const transporter = nodemailer.createTransport({
    host: connectionHost,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    dnsTimeout: 10_000,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    tls: {
      servername: smtpHost,
    },
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  } as SMTPTransport.Options);

  try {
    await transporter.sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (error) {
    console.error('Password reset email failed', {
      provider: 'smtp',
      to: input.to,
      smtpHost,
      connectionHost,
      smtpPort: env.smtp.port,
      smtpUser: env.smtp.user,
      mailFrom: env.smtp.from,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError(500, 'Không gửi được email đặt lại mật khẩu. Vui lòng kiểm tra cấu hình SMTP.');
  }
}
