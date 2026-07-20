import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/user.model';
import { generarTokenJWT } from '../utils/jwt';
import { generarTokenActivacion, verificarTokenActivacion } from '../utils/activation';
import { sendActivationEmail } from '../services/mail.service';
import bcrypt from 'bcrypt';

/**
 * POST /auth/register
 *
 * La cuenta se crea con isActive:false. NO se regresa un token de sesión aquí
 * a propósito: si se regresara, alguien podría saltarse por completo la
 * activación por correo con solo registrarse. Hay que activar la cuenta
 * (ver GET /auth/activate/:token) antes de poder hacer login.
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const { email, displayName, password } = req.body;

    if (!email || !displayName || !password) {
        throw new AppError('email, displayName y contraseña son requeridos', 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('El correo ya está registrado', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        email,
        displayName,
        password: hashedPassword,
        isActive: false,
    });

    const activationToken = generarTokenActivacion(user._id.toString());

    try {
        await sendActivationEmail(user.email, user.displayName, activationToken);
        console.log("Correo Enviado")
    } catch (error) {
        // No tumbamos el registro solo porque el correo no salió (SMTP caído, etc.):
        // la cuenta queda creada pero inactiva, y se puede reintentar el envío después.
        console.error('No se pudo enviar el correo de activación:', error);
    }

    return res.status(201).json({
        message: 'Cuenta creada. Revisa tu correo para activarla antes de iniciar sesión.',
        user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isActive: user.isActive,
        },
    });
});

/**
 * GET /auth/activate/:token
 *
 * Se abre directo desde el link del correo. Activa la cuenta (isActive: true) y
 * responde con una página HTML simple de confirmación (pensado para abrirse en
 * el navegador, no para ser consumido por un cliente HTTP programático).
 */
export const activateAccount = asyncHandler(async (req: Request, res: Response) => {
    const token = String(req.params.token ?? '');

    let userId: string;
    try {
        ({ id: userId } = verificarTokenActivacion(token));
    } catch {
        throw new AppError('El link de activación es inválido o ya expiró', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('El usuario de este link ya no existe', 404);
    }

    if (!user.isActive) {
        user.isActive = true;
        await user.save();
    }

    return res
        .status(200)
        .type('html')
        .send(
            `<!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8" /><title>Cuenta activada</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 60px;">
                <h1>✅ ¡Tu cuenta ya está activa!</h1>
                <p>Ya puedes iniciar sesión en RicoQuiz+.</p>
            </body>
            </html>`,
        );
});

/**
 * POST /auth/resend-activation
 *
 * Respuesta SIEMPRE genérica (mismo mensaje exista o no la cuenta, esté activa
 * o no) para no filtrar por este endpoint si un correo está registrado — el
 * mismo criterio que se usa típicamente en "recuperar contraseña".
 */
export const resendActivation = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        throw new AppError('email es requerido', 400);
    }

    const genericMessage =
        'Si el correo está registrado y la cuenta no ha sido activada, se envió un nuevo correo de activación.';

    const user = await User.findOne({ email });

    if (user && !user.isActive) {
        const activationToken = generarTokenActivacion(user._id.toString());
        try {
            await sendActivationEmail(user.email, user.displayName, activationToken);
            console.log("Correo Enviado")

        } catch (error) {
            // Igual que en register: no se filtra el fallo de envío en la respuesta,
            // solo se loguea para que el equipo lo detecte por su cuenta.
            console.error('No se pudo reenviar el correo de activación:', error);
        }
    }

    return res.status(200).json({ message: genericMessage });
});

/**
 * POST /auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError('email y password son requeridos', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        throw new AppError('Credenciales inválidas', 401);
    }

    const coincide = await bcrypt.compare(password, user.password);
    if (!coincide) {
        throw new AppError('Credenciales inválidas', 401);
    }

    if (!user.isActive) {
        throw new AppError('Debes activar tu cuenta antes de iniciar sesión. Revisa tu correo.', 403);
    }

    const token = generarTokenJWT({ id: user._id.toString(), email: user.email });

    return res.status(200).json({ token });
});
/**
 * GET /auth/me
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AppError('No autorizado', 401);
    }

    return res.status(200).json({ user: req.user });
});

/**
 * GET /auth/google
 */
export const googleAuth = (req: Request, res: Response) => {
    return res.redirect('https://accounts.google.com/o/oauth2/v2/auth?mock=true');
};

/**
 * GET /auth/google/callback?code=...
 */
export const googleCallback = (req: Request, res: Response) => {
    return res.status(200).json({
        token: 'jwt.mock.token',
        user: {
            id: '1',
            displayName: 'Usuario Mock',
            email: 'mock@example.com',
            avatarUrl: '',
        },
    });
};

/**
 * POST /auth/logout
 */
export const logout = (req: Request, res: Response) => {
    return res.status(200).json({ message: 'Sesión cerrada' });
};
