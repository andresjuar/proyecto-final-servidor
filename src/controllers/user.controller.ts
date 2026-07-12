import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { User } from '../models/user.model';

/**
 * GET /users/:id
 * Obtiene el perfil de un usuario.
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
 * Edita el perfil de un usuario. Solo se permite modificar displayName y avatarUrl;
 * googleId y email quedan fijos una vez creado el usuario (vienen de Google, no se editan a mano).
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
 * Elimina la cuenta de un usuario.
 *
 * NOTA / DECISIÓN PENDIENTE DE CONFIRMAR: por ahora esto NO elimina en cascada
 * los Quizzes ni Matches asociados a este usuario (serían huérfanos apuntando
 * a un owner/host que ya no existe). Se deja así para no perder datos por
 * accidente hasta que decidan la política real (soft delete, transferir
 * ownership, borrar en cascada, etc).
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json({ message: 'Usuario eliminado' });
});

/**
 * GET /users/:id/quizzes
 * Lista los quizzes creados por un usuario.
 *
 * TODO: todavía dummy porque el modelo real de Quiz no existe (tarjeta #14/#17
 * pendientes). Cuando esté el modelo, reemplazar por:
 *   Quiz.find({ owner: id }).skip((page-1)*limit).limit(limit)
 */
export const getUserQuizzes = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json({
        data: [],
        total: 0,
    });
});

/**
 * GET /users/:id/matches
 * Historial de partidas relacionadas a un usuario.
 *
 * TODO: todavía dummy porque el modelo real de Match no existe (tarjeta #18
 * pendiente, la lleva Andrés). Cuando esté el modelo, reemplazar por:
 *   Match.find({ $or: [{ host: id }, { 'players.user': id }] }).skip(...).limit(...)
 */
export const getUserMatches = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
        throw new AppError('Usuario no encontrado', 404);
    }

    return res.status(200).json({
        data: [],
        total: 0,
    });
});
