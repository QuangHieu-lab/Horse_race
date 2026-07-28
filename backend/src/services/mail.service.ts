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

function assertBrevoConfigured(): void {
  if (!env.brevo.apiKey || !env.smtp.from) {
    throw new HttpError(500, 'Chưa cấu hình Brevo để gửi email đặt lại mật khẩu');
  }
}

function parseMailFrom(raw: string): { name?: string; email: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return { email: raw.trim() };
  const [, rawName = '', rawEmail = ''] = match;
  const name = rawName.trim().replace(/^"|"$/g, '');
  return { name: name || undefined, email: rawEmail.trim() };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  const subject = 'CẢNH BÁO: Đặt lại mật khẩu WDP Horse Race';
  const text = [
    `Xin chào ${input.fullName},`,
    '',
    'Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản WDP Horse Race.',
    `Liên kết có hiệu lực trong ${input.expiresMinutes} phút:`,
    input.resetUrl,
    '',
    'Nếu bạn không yêu cầu, vui lòng bỏ qua email này.',
  ].join('\n');

  const html = `
    <div style="margin:0;padding:28px;background:#fff4ed;font-family:Arial,sans-serif;color:#24130b">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:3px solid #c0380a;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px rgba(83,30,8,.18)">
        <div style="background:#c0380a;color:#fff;padding:22px 26px">
          <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">WDP Horse Race</div>
          <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25">YÊU CẦU ĐẶT LẠI MẬT KHẨU</h1>
        </div>
        <div style="padding:28px 26px">
          <p style="font-size:16px;line-height:1.7;margin:0 0 12px">Xin chào <strong>${input.fullName}</strong>,</p>
          <p style="font-size:16px;line-height:1.7;margin:0 0 18px">Hệ thống đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để tạo mật khẩu mới.</p>
          <div style="margin:24px 0;text-align:center">
            <a href="${input.resetUrl}" style="display:inline-block;background:#c0380a;color:#fff;text-decoration:none;font-weight:900;font-size:16px;letter-spacing:.04em;padding:16px 26px;border-radius:999px">ĐẶT LẠI MẬT KHẨU</a>
          </div>
          <div style="background:#fff0d6;border-left:6px solid #ad6400;padding:14px 16px;border-radius:10px;margin:20px 0">
            <strong style="display:block;margin-bottom:4px">LƯU Ý QUAN TRỌNG</strong>
            Liên kết này chỉ có hiệu lực trong <strong>${input.expiresMinutes} phút</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.
          </div>
          <p style="font-size:13px;line-height:1.6;color:#74574b;margin:18px 0 0">Nếu nút không mở được, hãy sao chép liên kết này vào trình duyệt:<br><a href="${input.resetUrl}" style="color:#c0380a;word-break:break-all">${input.resetUrl}</a></p>
        </div>
      </div>
    </div>
  `;

  if (env.brevo.apiKey) {
    await sendWithBrevo({
      to: input.to,
      subject,
      text,
      html,
    });
    return;
  }

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

async function sendWithBrevo(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  assertBrevoConfigured();

  const sender = parseMailFrom(env.smtp.from);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Api-Key': env.brevo.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo API ${response.status}: ${body}`);
    }
  } catch (error) {
    console.error('Password reset email failed', {
      provider: 'brevo',
      to: input.to,
      mailFrom: env.smtp.from,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new HttpError(500, 'Không gửi được email đặt lại mật khẩu. Vui lòng kiểm tra cấu hình Brevo.');
  }
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
