import { Router } from 'express';
import { checkRoomExists, getMatchById, getMatchesByUser } from './../controllers/match.controller';

const router = Router();

/**
 * @swagger
 * /matches/rooms/{code}/exists:
 *   get:
 *     tags: [Matches]
 *     summary: Verifica si una sala existe y si ya está en progreso
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado de la sala
 */
router.get('/rooms/:code/exists', checkRoomExists);

/**
 * @swagger
 * /matches/user/{userId}:
 *  get:
 *   tags: [Matches]
 *   summary: Lista del historial de partidas del usuario
 *   parameters:
 *     - in: path
 *       name: userId
 *       required: true
 *       schema:
 *         type: string
 *   responses:
 *     200:
 *       description: El historial de partidas
 */
router.get('/user/:userId', getMatchesByUser);

/**
 * @swagger
 * /matches/{id}:
 *   get:
 *     tags: [Matches]
 *     summary: Obtiene el resultado de una partida
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado y detalles de la partida
 */
router.get('/:id', getMatchById);

export default router;
