import { Router } from 'express';
import {
    checkRoomExists,
    createMatch,
    deleteMatch,
    getMatchById,
    getMatchesByUser,
    updateMatch,
} from './../controllers/match.controller';

const router = Router();

/**
 * @swagger
 * /matches:
 *   post:
 *     tags: [Matches]
 *     summary: Crea una nueva partida para un quiz
 *     responses:
 *       201:
 *         description: Partida creada
 */
router.post('/', createMatch);

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
 *   put:
 *     tags: [Matches]
 *     summary: Actualiza el status/timestamps de una partida
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partida actualizada
 *   delete:
 *     tags: [Matches]
 *     summary: Elimina una partida
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partida eliminada
 */
router.get('/:id', getMatchById);
router.put('/:id', updateMatch);
router.delete('/:id', deleteMatch);

export default router;
