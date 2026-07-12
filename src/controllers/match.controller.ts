import { Response } from 'express';
import { Match } from '../models/match.model';
import { Quiz } from '../models/quiz.model';
import { User } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_ROOM_CODE_ATTEMPTS = 10;

function generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return code;
}

async function generateUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
        const code = generateRoomCode();
        const existe = await Match.findOne({
            roomCode: code,
            status: { $in: ['waiting', 'in_progress'] },
        });
        if (!existe) {
            return code;
        }
    }
    throw new AppError('No se pudo generar un código de sala único, intenta de nuevo', 500);
}

/**
 * GET /matches/rooms/:code/exists
 */
export const checkRoomExists = asyncHandler(async (req, res: Response) => {
    const code = req.params.code.toString().toUpperCase();

    const match = await Match.findOne({
        roomCode: code,
        status: { $in: ['waiting', 'in_progress'] },
    });

    return res.status(200).json({
        exists: !!match,
        inProgress: match?.status === 'in_progress',
    });
});

/**
 * POST /matches
 */
export const createMatch = asyncHandler(async (req, res: Response) => {
    const { quiz, host } = req.body;

    const quizDoc = await Quiz.findById(quiz);
    if (!quizDoc) {
        throw new AppError('El quiz especificado no existe', 404);
    }

    const hostDoc = await User.findById(host);
    if (!hostDoc) {
        throw new AppError('El host especificado no existe', 404);
    }

    const roomCode = await generateUniqueRoomCode();

    const match = await Match.create({
        quiz,
        host,
        roomCode,
        status: 'waiting',
        players: [],
    });

    return res.status(201).json(match);
});

/**
 * GET /matches/:id
 */
export const getMatchById = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;

    const match = await Match.findById(id)
        .populate('quiz', 'title')
        .populate('host', 'displayName')
        .populate('players.user', 'displayName');

    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }

    return res.status(200).json(match);
});

/**
 * GET /matches/user/:userId
 */
export const getMatchesByUser = asyncHandler(async (req, res: Response) => {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const filtro = {
        $or: [{ host: userId }, { 'players.user': userId }],
    };

    const [data, total] = await Promise.all([
        Match.find(filtro)
            .populate('quiz', 'title')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Match.countDocuments(filtro),
    ]);

    return res.status(200).json({ data, total, page, limit });
});

/**
 * PUT /matches/:id
 *
 * Solo permite actualizar status y timestamps.
 * El manejo de jugadores se hace con sockets, no por esta ruta.
 */
export const updateMatch = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;
    const { status, startedAt, finishedAt } = req.body;

    const cambios: Record<string, unknown> = {};

    if (status !== undefined) {
        cambios.status = status;

        if (status === 'in_progress' && !startedAt) {
            cambios.startedAt = new Date();
        }
        if (status === 'finished' && !finishedAt) {
            cambios.finishedAt = new Date();
        }
    }

    if (startedAt !== undefined) cambios.startedAt = startedAt;
    if (finishedAt !== undefined) cambios.finishedAt = finishedAt;

    const match = await Match.findByIdAndUpdate(id, { $set: cambios }, { new: true, runValidators: true });

    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }

    return res.status(200).json(match);
});

/**
 * DELETE /matches/:id
 */
export const deleteMatch = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;

    const match = await Match.findByIdAndDelete(id);

    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }

    return res.status(200).json({ message: 'Partida eliminada' });
});
