import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Quiz } from '../models/quiz.model';
import { User } from '../models/user.model';

/**
 * GET /quizzes?q=&tags=&page=&limit=
 */
export const getQuizzes = asyncHandler(async (req: Request, res: Response) => {
    const { q, tags } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);

    const filtro: Record<string, unknown> = { isPublic: true };

    if (q) {
        filtro.title = { $regex: String(q), $options: 'i' };
    }

    if (tags) {
        const listaTags = String(tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        if (listaTags.length > 0) {
            filtro.tags = { $in: listaTags };
        }
    }

    const [quizzes, total] = await Promise.all([
        Quiz.find(filtro)
            .populate('owner', 'displayName')
            .select('title coverImageUrl tags timesPlayed owner')
            .skip((page - 1) * limit)
            .limit(limit),
        Quiz.countDocuments(filtro),
    ]);

    return res.status(200).json({
        data: quizzes,
        total,
        page,
        limit,
    });
});

/**
 * POST /quizzes
 */
export const createQuiz = asyncHandler(async (req: Request, res: Response) => {
    const { owner } = req.body;

    if (!owner) {
        throw new AppError('El owner es requerido (temporal, hasta tener auth real)', 400);
    }

    const quiz = await Quiz.create(req.body);

    await User.findByIdAndUpdate(owner, { $push: { createdQuizzes: quiz._id } });

    return res.status(201).json(quiz);
});

/**
 * POST /quizzes/generate
 */
export const generateQuiz = asyncHandler(async (req: Request, res: Response) => {
    const { topic, numQuestions } = req.body;

    if (!topic) {
        throw new AppError('El topic es requerido', 400);
    }

    return res.status(202).json({
        topic,
        questions: [],
        _pendiente: `Integración con Gemini AI pendiente (numQuestions solicitado: ${numQuestions ?? 5})`,
    });
});

/**
 * GET /quizzes/:id
 */
export const getQuizById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const quiz = await Quiz.findById(id).populate('owner', 'displayName avatarUrl');

    if (!quiz) {
        throw new AppError('Quiz no encontrado', 404);
    }

    return res.status(200).json(quiz);
});

/**
 * PUT /quizzes/:id
 */
export const updateQuiz = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, coverImageUrl, topic, isPublic, tags, questions } = req.body;

    const camposPermitidos: Record<string, unknown> = {};
    if (title !== undefined) camposPermitidos.title = title;
    if (description !== undefined) camposPermitidos.description = description;
    if (coverImageUrl !== undefined) camposPermitidos.coverImageUrl = coverImageUrl;
    if (topic !== undefined) camposPermitidos.topic = topic;
    if (isPublic !== undefined) camposPermitidos.isPublic = isPublic;
    if (tags !== undefined) camposPermitidos.tags = tags;
    if (questions !== undefined) camposPermitidos.questions = questions;

    const quiz = await Quiz.findByIdAndUpdate(id, camposPermitidos, {
        new: true,
        runValidators: true,
    });

    if (!quiz) {
        throw new AppError('Quiz no encontrado', 404);
    }

    return res.status(200).json(quiz);
});

/**
 * DELETE /quizzes/:id
 */
export const deleteQuiz = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const quiz = await Quiz.findByIdAndDelete(id);

    if (!quiz) {
        throw new AppError('Quiz no encontrado', 404);
    }

    await User.findByIdAndUpdate(quiz.owner, { $pull: { createdQuizzes: quiz._id } });

    return res.status(200).json({ message: 'Quiz eliminado' });
});

/**
 * POST /quizzes/:id/image
 */
export const uploadQuizImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const quiz = await Quiz.findById(id);

    if (!quiz) {
        throw new AppError('Quiz no encontrado', 404);
    }

    return res.status(200).json({
        imageUrl: 'https://picsum.photos/seed/uploaded/400/200',
    });
});