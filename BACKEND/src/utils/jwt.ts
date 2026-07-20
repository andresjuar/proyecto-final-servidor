import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.config';
import { AuthUser } from '../types/express';

export function generarTokenJWT(payload: AuthUser): string {
    const options: SignOptions = {
        expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.jwtSecret, options);
}

export function verificarTokenJWT(token: string): AuthUser {
    return jwt.verify(token, env.jwtSecret) as AuthUser;
}
