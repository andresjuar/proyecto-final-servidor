import type { Request, Response, NextFunction } from 'express';
import { getUserProfile, updateUser, deleteUser } from '../user.controller';
import { User } from '../../models/user.model';
import { AppError } from '../../utils/AppError';

/**
 * Pruebas básicas del controlador de usuarios. El modelo User se mockea por
 * completo, así que NO se necesita conexión a MongoDB: solo se verifica que el
 * controlador responda con el status/json correcto según lo que "regrese" la BD.
 */

jest.mock('../../models/user.model', () => ({
    User: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
    },
}));

// res.status().json() encadenado, igual que lo usa Express
function crearMockRes(): Response {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// asyncHandler no regresa la promesa, así que esperamos a que se vacíe la cola
// de tareas pendientes antes de hacer los asserts
function esperarHandler(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

describe('user.controller', () => {
    let res: Response;
    let next: NextFunction;

    // los mocks se limpian solos entre pruebas gracias a clearMocks:true en jest.config.ts
    beforeEach(() => {
        res = crearMockRes();
        next = jest.fn();
    });

    describe('getUserProfile', () => {
        it('responde 200 con el usuario cuando existe', async () => {
            const usuarioFalso = { _id: '123', displayName: 'Test' };
            (User.findById as jest.Mock).mockResolvedValue(usuarioFalso);

            const req = { params: { id: '123' } } as unknown as Request;
            getUserProfile(req, res, next);
            await esperarHandler();

            expect(User.findById).toHaveBeenCalledWith('123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(usuarioFalso);
        });

        it('pasa un AppError 404 a next cuando el usuario no existe', async () => {
            (User.findById as jest.Mock).mockResolvedValue(null);

            const req = { params: { id: 'no-existe' } } as unknown as Request;
            getUserProfile(req, res, next);
            await esperarHandler();

            expect(res.status).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });
    });

    describe('updateUser', () => {
        it('actualiza solo los campos permitidos y responde 200', async () => {
            const usuarioActualizado = { _id: '123', displayName: 'Nuevo' };
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(usuarioActualizado);

            const req = {
                params: { id: '123' },
                body: { displayName: 'Nuevo', email: 'hack@example.com' },
            } as unknown as Request;
            updateUser(req, res, next);
            await esperarHandler();

            // el email NO debe llegar al update aunque venga en el body
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
                '123',
                { displayName: 'Nuevo' },
                { new: true, runValidators: true },
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(usuarioActualizado);
        });

        it('pasa un AppError 404 a next cuando el usuario no existe', async () => {
            (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

            const req = { params: { id: 'no-existe' }, body: {} } as unknown as Request;
            updateUser(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
        });
    });

    describe('deleteUser', () => {
        it('elimina al usuario y responde 200 con mensaje', async () => {
            (User.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: '123' });

            const req = { params: { id: '123' } } as unknown as Request;
            deleteUser(req, res, next);
            await esperarHandler();

            expect(User.findByIdAndDelete).toHaveBeenCalledWith('123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Usuario eliminado' });
        });

        it('pasa un AppError 404 a next cuando el usuario no existe', async () => {
            (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

            const req = { params: { id: 'no-existe' } } as unknown as Request;
            deleteUser(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
        });
    });
});
