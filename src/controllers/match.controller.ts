import { Request, Response } from 'express';

/**
 * GET /matches/rooms/:code/exists
 */
export const checkRoomExists = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(200).json({
    exists: true,
    inProgress: false,
  });
};

/**
 * GET /matches/:id
 */
export const getMatchById = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  const { id } = req.params;
  return res.status(200).json({
    id,
    quiz: { id: '1', title: '' },
    host: { id: '1', displayName: '' },
    roomCode: '',
    status: 'finished',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    players: [],
  });
};

/**
 * GET /matches/user/:userId
 */
export const getMatchesByUser = (req: Request, res: Response) => {
  const isConnected = true;
  if (!isConnected) {
    return res.status(400).json({ message: 'Sin conexión con el servidor' });
  }

  return res.status(200).json({
    data: [],
    total: 0,
  });
};