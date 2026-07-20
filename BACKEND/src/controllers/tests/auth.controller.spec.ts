import type { Request, Response, NextFunction } from 'express';
import { register, login } from '../auth.controller';
import { User } from '../../models/user.model';
import { AppError } from '../../utils/AppError';
import { generarTokenJWT } from '../../utils/jwt';
import { sendActivationEmail } from '../../services/mail.service';
import bcrypt from 'bcrypt';

/**
 * Pruebas básicas del controlador de auth. Se mockean el modelo User, bcrypt,
 * los utils de tokens y el servicio de correo, así que NO se necesita MongoDB,
 * ni variables de entorno, ni conexión a Brevo.
 */

jest.mock('../../models/user.model', () => ({
    User: {
        findOne: jest.fn(),
        create: jest.fn(),
    },
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

jest.mock('../../utils/jwt', () => ({
    generarTokenJWT: jest.fn(() => 'token-jwt-falso'),
}));

jest.mock('../../utils/activation', () => ({
    generarTokenActivacion: jest.fn(() => 'token-activacion-falso'),
    verificarTokenActivacion: jest.fn(),
}));

jest.mock('../../services/mail.service', () => ({
    sendActivationEmail: jest.fn().mockResolvedValue(undefined),
}));

function crearMockRes(): Response {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function esperarHandler(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

describe('auth.controller', () => {
    let res: Response;
    let next: NextFunction;

    // los mocks se limpian solos entre pruebas gracias a clearMocks:true en jest.config.ts
    beforeEach(() => {
        res = crearMockRes();
        next = jest.fn();
    });

    describe('register', () => {
        it('pasa un AppError 400 a next si faltan campos', async () => {
            const req = { body: { email: 'test@example.com' } } as unknown as Request;
            register(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(400);
        });

        it('pasa un AppError 400 a next si el correo ya está registrado', async () => {
            (User.findOne as jest.Mock).mockResolvedValue({ _id: 'ya-existe' });

            const req = {
                body: { email: 'test@example.com', displayName: 'Test', password: 'password123' },
            } as unknown as Request;
            register(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(400);
        });

        it('crea la cuenta inactiva, manda correo de activación y responde 201', async () => {
            const usuarioCreado = {
                _id: { toString: () => 'user-1' },
                email: 'test@example.com',
                displayName: 'Test',
                avatarUrl: '',
                isActive: false,
            };
            (User.findOne as jest.Mock).mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('password-hasheado');
            (User.create as jest.Mock).mockResolvedValue(usuarioCreado);

            const req = {
                body: { email: 'test@example.com', displayName: 'Test', password: 'password123' },
            } as unknown as Request;
            register(req, res, next);
            await esperarHandler();

            expect(User.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                displayName: 'Test',
                password: 'password-hasheado',
                isActive: false,
            });
            expect(sendActivationEmail).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('login', () => {
        it('pasa un AppError 400 a next si faltan campos', async () => {
            const req = { body: { email: 'test@example.com' } } as unknown as Request;
            login(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(400);
        });

        it('pasa un AppError 401 a next si el usuario no existe', async () => {
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockResolvedValue(null),
            });

            const req = {
                body: { email: 'no@example.com', password: 'password123' },
            } as unknown as Request;
            login(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(401);
        });

        it('pasa un AppError 401 a next si la contraseña no coincide', async () => {
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockResolvedValue({ password: 'hash', isActive: true }),
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const req = {
                body: { email: 'test@example.com', password: 'incorrecta' },
            } as unknown as Request;
            login(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(401);
        });

        it('pasa un AppError 403 a next si la cuenta no está activada', async () => {
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: { toString: () => 'user-1' },
                    email: 'test@example.com',
                    password: 'hash',
                    isActive: false,
                }),
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const req = {
                body: { email: 'test@example.com', password: 'password123' },
            } as unknown as Request;
            login(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(403);
        });

        it('responde 200 con el token cuando las credenciales son correctas', async () => {
            (User.findOne as jest.Mock).mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: { toString: () => 'user-1' },
                    email: 'test@example.com',
                    password: 'hash',
                    isActive: true,
                }),
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const req = {
                body: { email: 'test@example.com', password: 'password123' },
            } as unknown as Request;
            login(req, res, next);
            await esperarHandler();

            expect(generarTokenJWT).toHaveBeenCalledWith({ id: 'user-1', email: 'test@example.com' });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ token: 'token-jwt-falso' });
        });
    });
});
