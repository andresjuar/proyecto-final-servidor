import type { Request, Response, NextFunction } from 'express';
import { checkRoomExists, createMatch, getMatchById, updateMatch, deleteMatch } from '../match.controller';
import { Match } from '../../models/match.model';
import { Quiz } from '../../models/quiz.model';
import { User } from '../../models/user.model';
import { AppError } from '../../utils/AppError';

/**
 * Pruebas básicas del controlador de matches. Se mockean los modelos y el
 * servicio de IA, así que NO se necesita MongoDB ni variables de entorno.
 */

jest.mock('../../models/match.model', () => ({
    Match: {
        findOne: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
        create: jest.fn(),
    },
}));

jest.mock('../../models/quiz.model', () => ({
    Quiz: {
        findById: jest.fn(),
        create: jest.fn(),
    },
}));

jest.mock('../../models/user.model', () => ({
    User: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

jest.mock('../../services/Ai.service', () => ({
    generateTriviaQuestions: jest.fn(),
}));

function crearMockRes(): Response {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

// getMatchById encadena varios .populate() antes del await, así que el mock
// del query debe regresarse a sí mismo y ser "awaitable" (thenable)
function crearQueryMock(resultado: unknown) {
    const query = {
        populate: jest.fn(),
        then: (resolve: (valor: unknown) => void) => Promise.resolve(resultado).then(resolve),
    };
    query.populate.mockReturnValue(query);
    return query;
}

function esperarHandler(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}

describe('match.controller', () => {
    let res: Response;
    let next: NextFunction;

    // los mocks se limpian solos entre pruebas gracias a clearMocks:true en jest.config.ts
    beforeEach(() => {
        res = crearMockRes();
        next = jest.fn();
    });

    describe('checkRoomExists', () => {
        it('responde exists:true cuando hay una sala activa con ese código', async () => {
            (Match.findOne as jest.Mock).mockResolvedValue({ roomCode: 'ABCD', status: 'waiting' });

            const req = { params: { code: 'abcd' } } as unknown as Request;
            checkRoomExists(req, res, next);
            await esperarHandler();

            // el código se busca en mayúsculas aunque llegue en minúsculas
            expect(Match.findOne).toHaveBeenCalledWith({
                roomCode: 'ABCD',
                status: { $in: ['waiting', 'in_progress'] },
            });
            expect(res.json).toHaveBeenCalledWith({ exists: true, inProgress: false });
        });

        it('responde exists:false cuando no hay sala con ese código', async () => {
            (Match.findOne as jest.Mock).mockResolvedValue(null);

            const req = { params: { code: 'ZZZZ' } } as unknown as Request;
            checkRoomExists(req, res, next);
            await esperarHandler();

            expect(res.json).toHaveBeenCalledWith({ exists: false, inProgress: false });
        });
    });

    describe('createMatch', () => {
        it('pasa un AppError 404 a next cuando el host no existe', async () => {
            (User.findById as jest.Mock).mockResolvedValue(null);

            const req = { user: { id: 'no-existe' }, body: {} } as unknown as Request;
            createMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });

        it('crea la partida en waiting, con roomCode de 4 letras y responde 201', async () => {
            (User.findById as jest.Mock).mockResolvedValue({ _id: 'user-1' });
            // no hay sala activa con el código generado, así que es único a la primera
            (Match.findOne as jest.Mock).mockResolvedValue(null);
            const matchCreado = { _id: 'match-1', roomCode: 'ABCD' };
            (Match.create as jest.Mock).mockResolvedValue(matchCreado);

            const req = { user: { id: 'user-1' }, body: {} } as unknown as Request;
            createMatch(req, res, next);
            await esperarHandler();

            expect(Match.create).toHaveBeenCalledWith({
                quiz: undefined,
                host: 'user-1',
                roomCode: expect.stringMatching(/^[A-Z]{4}$/),
                status: 'waiting',
                players: [],
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(matchCreado);
        });

        it('pasa un AppError 404 a next si mandan un quiz que no existe', async () => {
            (User.findById as jest.Mock).mockResolvedValue({ _id: 'user-1' });
            (Quiz.findById as jest.Mock).mockResolvedValue(null);

            const req = { user: { id: 'user-1' }, body: { quiz: 'quiz-falso' } } as unknown as Request;
            createMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });
    });

    describe('getMatchById', () => {
        it('responde 200 con la partida cuando existe', async () => {
            const matchFalso = { _id: 'match-1', roomCode: 'ABCD' };
            (Match.findById as jest.Mock).mockReturnValue(crearQueryMock(matchFalso));

            const req = { params: { id: 'match-1' } } as unknown as Request;
            getMatchById(req, res, next);
            await esperarHandler();

            expect(Match.findById).toHaveBeenCalledWith('match-1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(matchFalso);
        });

        it('pasa un AppError 404 a next cuando la partida no existe', async () => {
            (Match.findById as jest.Mock).mockReturnValue(crearQueryMock(null));

            const req = { params: { id: 'no-existe' } } as unknown as Request;
            getMatchById(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });
    });

    describe('updateMatch', () => {
        it('pasa un AppError 404 a next cuando la partida no existe', async () => {
            (Match.findById as jest.Mock).mockResolvedValue(null);

            const req = {
                params: { id: 'no-existe' },
                user: { id: 'user-1' },
                body: { status: 'finished' },
            } as unknown as Request;
            updateMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });

        it('pasa un AppError 403 a next cuando el usuario no es el host', async () => {
            (Match.findById as jest.Mock).mockResolvedValue({ _id: 'match-1', host: 'otro-usuario' });

            const req = {
                params: { id: 'match-1' },
                user: { id: 'user-1' },
                body: { status: 'finished' },
            } as unknown as Request;
            updateMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(403);
        });

        it('actualiza el status y agrega finishedAt automático al terminar', async () => {
            (Match.findById as jest.Mock).mockResolvedValue({ _id: 'match-1', host: 'user-1' });
            const matchActualizado = { _id: 'match-1', status: 'finished' };
            (Match.findByIdAndUpdate as jest.Mock).mockResolvedValue(matchActualizado);

            const req = {
                params: { id: 'match-1' },
                user: { id: 'user-1' },
                body: { status: 'finished' },
            } as unknown as Request;
            updateMatch(req, res, next);
            await esperarHandler();

            expect(Match.findByIdAndUpdate).toHaveBeenCalledWith(
                'match-1',
                { $set: { status: 'finished', finishedAt: expect.any(Date) } },
                { new: true, runValidators: true },
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(matchActualizado);
        });
    });

    describe('deleteMatch', () => {
        it('pasa un AppError 404 a next cuando la partida no existe', async () => {
            (Match.findById as jest.Mock).mockResolvedValue(null);

            const req = {
                params: { id: 'no-existe' },
                user: { id: 'user-1' },
            } as unknown as Request;
            deleteMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(404);
        });

        it('responde 403 y NO borra la partida cuando el usuario no es el host', async () => {
            const matchAjeno = {
                _id: 'match-1',
                host: 'otro-usuario',
                deleteOne: jest.fn().mockResolvedValue(undefined),
            };
            (Match.findById as jest.Mock).mockResolvedValue(matchAjeno);

            const req = {
                params: { id: 'match-1' },
                user: { id: 'user-1' },
            } as unknown as Request;
            deleteMatch(req, res, next);
            await esperarHandler();

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = (next as jest.Mock).mock.calls[0][0] as AppError;
            expect(error.statusCode).toBe(403);
            // lo importante del fix: la partida sigue existiendo
            expect(matchAjeno.deleteOne).not.toHaveBeenCalled();
        });

        it('elimina la partida cuando el usuario es el host y responde 200', async () => {
            const matchPropio = {
                _id: 'match-1',
                host: 'user-1',
                deleteOne: jest.fn().mockResolvedValue(undefined),
            };
            (Match.findById as jest.Mock).mockResolvedValue(matchPropio);

            const req = {
                params: { id: 'match-1' },
                user: { id: 'user-1' },
            } as unknown as Request;
            deleteMatch(req, res, next);
            await esperarHandler();

            expect(matchPropio.deleteOne).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Partida eliminada' });
        });
    });
});
