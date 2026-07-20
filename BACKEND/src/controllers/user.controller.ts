import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/user.model';

/**
 * GET /users/:id
 */
export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json(user);
});

/**
 * PUT /users/:id
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { displayName, avatarUrl } = req.body;

    const camposPermitidos: Record<string, unknown> = {};
    if (displayName !== undefined) camposPermitidos.displayName = displayName;
    if (avatarUrl !== undefined) camposPermitidos.avatarUrl = avatarUrl;

    const user = await User.findByIdAndUpdate(id, camposPermitidos, {
        new: true,
        runValidators: true,
    });

    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json(user);
});

/**
 * DELETE /users/:id
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json({ message: 'Usuario eliminado' });
});
