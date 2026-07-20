import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.config';

const ACTIVATION_PURPOSE = 'activate-account';

interface ActivationTokenPayload {
    id: string;
    purpose: typeof ACTIVATION_PURPOSE;
}

export function generarTokenActivacion(userId: string): string {
    const payload: ActivationTokenPayload = { id: userId, purpose: ACTIVATION_PURPOSE };
    const options: SignOptions = {
        expiresIn: env.activationTokenExpiresIn as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, env.activationTokenSecret, options);
}

export function verificarTokenActivacion(token: string): { id: string } {
    const payload = jwt.verify(token, env.activationTokenSecret) as Partial<ActivationTokenPayload>;

    if (payload.purpose !== ACTIVATION_PURPOSE || !payload.id) {
        throw new Error('El token no es un token de activación válido');
    }

    return { id: payload.id };
}
