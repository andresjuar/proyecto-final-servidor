import { Request, Response } from 'express';

/**
 * GET /quizzes?q=&tags=&page=&limit=
 */
export const getQuizzes = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  return res.status(200).json({
    data: [],
    total: 0,
    page,
    limit,
  });
};

/**
 * POST /quizzes
 */
export const createQuiz = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(201).json(req.body);
};

/**
 * POST /quizzes/generate
 * 
 * Genera el quiz con IA
 */
export const generateQuiz = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(202).json({
    topic: req.body?.topic ?? '',
    questions: [],
  });
};

/**
 * GET /quizzes/:id
 */
export const getQuizById = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  const { id } = req.params;
  return res.status(200).json({
    id,
    title: '',
    description: '',
    coverImageUrl: '',
    owner: { id: '1', displayName: '' },
    topic: '',
    generatedByAI: false,
    isPublic: true,
    tags: [],
    timesPlayed: 0,
    questions: [],
    createdAt: new Date().toISOString(),
  });
};

/**
 * PUT /quizzes/:id
 */
export const updateQuiz = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  const { id } = req.params;
  return res.status(200).json({ id, ...req.body });
};

/**
 * DELETE /quizzes/:id
 */
export const deleteQuiz = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(200).json({ message: 'Quiz eliminado' });
};

/**
 * POST /quizzes/:id/image
 */
export const uploadQuizImage = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(200).json({ imageUrl: '' });
};