import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { verificarTokenJWT } from '../utils/jwt';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('No autorizado: token requerido', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = verificarTokenJWT(token);
    } catch {
        throw new AppError('Token inválido o expirado', 401);
    }

    next();
}
