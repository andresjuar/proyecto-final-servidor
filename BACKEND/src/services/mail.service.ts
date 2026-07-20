import { env } from '../config/env.config';
import { AppError } from '../utils/AppError';

/**
 * Mail.service.ts — envío de correos transaccionales vía la API HTTP de Brevo
 * (antes Sendinblue).
 *
 * Se usa la API por HTTPS a propósito, en vez de SMTP: Render (y otros hostings)
 * bloquean tráfico saliente a puertos SMTP (25/465/587) en su plan gratuito,
 * pero sí permiten HTTPS normal, que es todo lo que necesita este servicio.
 *
 * BREVO_SENDER_EMAIL debe ser un correo verificado individualmente en el
 * dashboard de Brevo (Settings → Senders), NO requiere tener un dominio propio:
 * Brevo manda un correo de confirmación una sola vez a esa dirección y ya queda
 * habilitada como remitente.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
    console.log("Enviando correo")
    const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'api-key': env.brevoApiKey,
        },
        body: JSON.stringify({
            sender: { email: env.brevoSenderEmail, name: env.brevoSenderName },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error('Error enviando correo con Brevo:', response.status, body);
        throw new AppError('No se pudo enviar el correo, intenta de nuevo', 502);
    }
}

/**
 * Envía el correo de activación de cuenta con el link que activa isActive=true.
 * Si el envío falla (API key mal puesta, remitente sin verificar, etc.), lanza el
 * error tal cual para que quien la llame decida cómo manejarlo — normalmente NO se
 * quiere tumbar el registro completo solo porque el correo no salió.
 */
export async function sendActivationEmail(to: string, displayName: string, activationToken: string): Promise<void> {
    const activationLink = `${env.appBaseUrl}/auth/activate/${activationToken}`;

    await sendEmail({
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