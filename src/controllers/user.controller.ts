import { Request, Response } from 'express';

/**
 * GET /users/:id
 */
export const getUserProfile = (req: Request, res: Response) => {

  const { id } = req.params;
  return res.status(200).json({
    id,
    displayName: 'Usuario dummy',
    email: 'dummy@example.com',
    avatarUrl: '',
    createdAt: new Date().toISOString(),
  });
};

/**
 * GET /users/:id/quizzes
 */
export const getUserQuizzes = (req: Request, res: Response) => {

  return res.status(200).json({
    data: [],
    total: 0,
  });
};

/**
 * GET /users/:id/matches
 */
export const getUserMatches = (req: Request, res: Response) => {

  return res.status(200).json({
    data: [],
    total: 0,
  });
};