import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Em dev, usa Ethereal (fake SMTP)
    if (process.env.NODE_ENV !== 'production') {
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: 'ethereal_user', pass: 'ethereal_pass' },
      });
    }
    throw new AppError('SMTP não configurado', 500);
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export class EmailService {
  private from = `AuraBot <${process.env.SMTP_FROM || 'noreply@aurabot.app'}>`;

  async send(options: EmailOptions): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      logger.debug(`[TEST] Email para ${options.to}: ${options.subject}`);
      return;
    }

    try {
      const transporter = createTransporter();
      const info = await transporter.sendMail({
        from: this.from,
        ...options,
      });
      logger.info(`Email enviado para ${options.to} — ID: ${info.messageId}`);
    } catch (err) {
      logger.error('Erro ao enviar email:', err);
      throw new AppError('Falha ao enviar email. Tente novamente.', 503, 'EMAIL_ERROR');
    }
  }

  async sendPasswordReset(to: string, token: string, username: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const expiresIn = '1 hora';

    await this.send({
      to,
      subject: '🔐 Redefinição de senha — AuraBot',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:system-ui,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:24px">
          <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;border:1px solid #2a2a2a">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-size:32px">🎵</span>
              <h1 style="color:#a78bfa;margin:8px 0 0;font-size:22px">AuraBot</h1>
            </div>
            <h2 style="color:#f5f5f5;font-size:18px;margin:0 0 12px">Olá, ${username}!</h2>
            <p style="color:#a3a3a3;line-height:1.6;margin:0 0 24px">
              Recebemos uma solicitação para redefinir a senha da sua conta.
              Clique no botão abaixo para criar uma nova senha:
            </p>
            <a href="${resetUrl}" style="display:block;background:#7c3aed;color:#fff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">
              Redefinir minha senha
            </a>
            <p style="color:#737373;font-size:13px;line-height:1.5;margin:0">
              Este link expira em <strong style="color:#a3a3a3">${expiresIn}</strong>.
              Se você não solicitou esta redefinição, ignore este email — sua senha permanece a mesma.
            </p>
            <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0">
            <p style="color:#525252;font-size:12px;text-align:center;margin:0">
              AuraBot · Não responda este email
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Olá ${username}!\n\nRedefinição de senha:\n${resetUrl}\n\nExpira em ${expiresIn}.`,
    });
  }

  async sendEmailVerification(to: string, token: string, username: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await this.send({
      to,
      subject: '✅ Verifique seu email — AuraBot',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"></head>
        <body style="font-family:system-ui,sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:24px">
          <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;border:1px solid #2a2a2a">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-size:32px">🎵</span>
              <h1 style="color:#a78bfa;margin:8px 0 0;font-size:22px">AuraBot</h1>
            </div>
            <h2 style="color:#f5f5f5;font-size:18px;margin:0 0 12px">Bem-vindo, ${username}!</h2>
            <p style="color:#a3a3a3;line-height:1.6;margin:0 0 24px">
              Confirme seu endereço de email para começar a usar o AuraBot:
            </p>
            <a href="${verifyUrl}" style="display:block;background:#7c3aed;color:#fff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:24px">
              Verificar email
            </a>
            <p style="color:#737373;font-size:13px;margin:0">
              Se você não criou uma conta no AuraBot, ignore este email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Bem-vindo, ${username}!\n\nVerifique seu email:\n${verifyUrl}`,
    });
  }
}

export const emailService = new EmailService();
