import { Response } from 'express';
import { Match } from '../models/match.model';
import { Quiz } from '../models/quiz.model';
import { User } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { generateTriviaQuestions } from '../services/Ai.service';

const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_ROOM_CODE_ATTEMPTS = 10;
const DEFAULT_AI_NUM_QUESTIONS = 10;

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
 *
 * El quiz YA NO es obligatorio para crear la partida: primero se crea la sala
 * (con su roomCode), y el quiz se asigna después con PATCH /matches/:id/quiz
 * (uno ya existente) o POST /matches/:id/generate-quiz (generado con IA),
 * en cualquier momento mientras la partida siga en 'waiting'.
 *
 * Se mantiene compatibilidad: si de cualquier forma mandan `quiz` en el body,
 * se valida y se asigna de una vez (por si el frontend viejo todavía lo manda así).
 */
export const createMatch = asyncHandler(async (req, res: Response) => {
    const { quiz } = req.body;
    const host = req.user!.id;

    const hostDoc = await User.findById(host);
    if (!hostDoc) {
        throw new AppError('El host especificado no existe', 404);
    }

    let quizId: string | undefined;
    if (quiz) {
        const quizDoc = await Quiz.findById(quiz);
        if (!quizDoc) {
            throw new AppError('El quiz especificado no existe', 404);
        }
        quizId = quizDoc._id.toString();
    }

    const roomCode = await generateUniqueRoomCode();

    const match = await Match.create({
        quiz: quizId,
        host,
        roomCode,
        status: 'waiting',
        players: [],
    });

    return res.status(201).json(match);
});

/**
 * PATCH /matches/:id/quiz
 *
 * Asigna un quiz YA EXISTENTE a una partida en 'waiting'. Solo el host puede
 * hacerlo, y puede llamarlo varias veces para cambiar de quiz mientras la
 * partida no haya arrancado.
 */
export const selectQuizForMatch = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;
    const { quizId } = req.body;

    if (!quizId) {
        throw new AppError('quizId es requerido', 400);
    }

    const match = await Match.findById(id);
    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }
    if (match.host.toString() !== req.user!.id) {
        throw new AppError('No tienes permiso para editar esta partida', 403);
    }
    if (match.status !== 'waiting') {
        throw new AppError('Solo se puede cambiar el quiz mientras la partida está en espera', 400);
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        throw new AppError('El quiz especificado no existe', 404);
    }

    match.quiz = quiz._id;
    await match.save();

    return res.status(200).json(match);
});

/**
 * POST /matches/:id/generate-quiz
 *
 * Genera un quiz nuevo con IA a partir de un tema y lo asigna a la partida.
 * Solo el host, y solo mientras la partida esté en 'waiting'. Se puede llamar
 * varias veces para regenerar/cambiar de tema antes de iniciar: cada llamada
 * crea un Quiz nuevo (el anterior, si había uno, queda huérfano sin borrarse).
 */
export const generateQuizForMatch = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;
    const { topic, numQuestions } = req.body;

    if (!topic) {
        throw new AppError('El topic es requerido', 400);
    }

    const match = await Match.findById(id);
    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }
    if (match.host.toString() !== req.user!.id) {
        throw new AppError('No tienes permiso para editar esta partida', 403);
    }
    if (match.status !== 'waiting') {
        throw new AppError('Solo se puede generar un quiz mientras la partida está en espera', 400);
    }

    const cantidad = Number(numQuestions) || DEFAULT_AI_NUM_QUESTIONS;

    let preguntasGeneradas;
    try {
        preguntasGeneradas = await generateTriviaQuestions(topic, cantidad);
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError('No se pudieron generar las preguntas con IA, intenta de nuevo', 502);
    }

    const quiz = await Quiz.create({
        title: `Quiz de ${topic}`,
        topic,
        owner: match.host,
        isPublic: false,
        generatedByAI: true,
        questions: preguntasGeneradas,
    });

    await User.findByIdAndUpdate(match.host, { $push: { createdQuizzes: quiz._id } });

    match.quiz = quiz._id;
    await match.save();

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

    const match = await Match.findById(id);

    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }

    if (match.host.toString() !== req.user!.id) {
        throw new AppError('No tienes permiso para editar esta partida', 403);
    }

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

    const matchActualizado = await Match.findByIdAndUpdate(id, { $set: cambios }, { new: true, runValidators: true });

    return res.status(200).json(matchActualizado);
});

/**
 * DELETE /matches/:id
 */
export const deleteMatch = asyncHandler(async (req, res: Response) => {
    const { id } = req.params;

    // primero se valida al host y SOLO entonces se borra: si se borrara antes
    // de validar, cualquier usuario autenticado podría eliminar partidas ajenas
    const match = await Match.findById(id);

    if (!match) {
        throw new AppError('Partida no encontrada', 404);
    }

    if (match.host.toString() !== req.user!.id) {
        throw new AppError('No tienes permiso para eliminar esta partida', 403);
    }

    await match.deleteOne();

    return res.status(200).json({ message: 'Partida eliminada' });
});
