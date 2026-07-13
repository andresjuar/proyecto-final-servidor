import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/user.model';
import { generarTokenJWT } from '../utils/jwt';
import bcrypt from 'bcrypt';

/**
 * POST /auth/register
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

    const user = await User.create({ email, displayName, password: hashedPassword });

    const token = generarTokenJWT({ id: user._id.toString(), email: user.email });

    return res.status(201).json({
        token,
        user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        },
    });
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
