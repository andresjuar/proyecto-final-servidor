import { Request, Response } from 'express';

/**
 * GET /matches/rooms/:code/exists
 */
export const checkRoomExists = (req: Request, res: Response) => {
    return res.status(200).json({
        exists: true,
        inProgress: false,
    });
};

/**
 * GET /matches/:id
 */
export const getMatchById = (req: Request, res: Response) => {
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
    return res.status(200).json({
        data: [],
        total: 0,
    });
};
