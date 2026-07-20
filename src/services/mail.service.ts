import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { env } from '../config/env.config';

/**
 * Mail.service.ts — envío de correos transaccionales (por ahora, solo activación
 * de cuenta) vía SMTP con nodemailer.
 *
 * Se puede usar la misma cuenta de Gmail + App Password que ya se configuró para
 * las notificaciones de GitHub Actions (dawidd6/action-send-mail, Práctica 2):
 * mismo SMTP_USER/SMTP_PASS, solo que aquí los lee la app en vez de un workflow.
 */

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: env.smtpUser,
                pass: env.smtpPass,
            },
            family: 4,
        } as SMTPTransport.Options);
    }
    return transporter;
}

/**
 * Envía el correo de activación de cuenta con el link que activa isActive=true.
 * Si el envío falla (SMTP mal configurado, sin internet, etc.), lanza el error
 * tal cual para que quien la llame decida cómo manejarlo — normalmente NO se
 * quiere tumbar el registro completo solo porque el correo no salió.
 */
export async function sendActivationEmail(to: string, displayName: string, activationToken: string): Promise<void> {
    const activationLink = `${env.appBaseUrl}/auth/activate/${activationToken}`;

    await getTransporter().sendMail({
        from: env.mailFrom,
        to,
        subject: 'Activa tu cuenta de RicoQuiz+',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>¡Hola, ${displayName}!</h2>
                <p>Gracias por registrarte en <b>RicoQuiz+</b>. Antes de poder iniciar sesión,
                necesitamos que confirmes tu correo.</p>
                <p style="margin: 24px 0;">
                    <a href="${activationLink}"
                       style="background:#6c5ce7;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
                        Activar mi cuenta
                    </a>
                </p>
                <p style="color:#666;font-size:13px;">
                    Si el botón no funciona, copia y pega este link en tu navegador:<br />
                    <a href="${activationLink}">${activationLink}</a>
                </p>
                <p style="color:#999;font-size:12px;">Este link expira en ${env.activationTokenExpiresIn}.</p>
            </div>
        `,
    });
}
