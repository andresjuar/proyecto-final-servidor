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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quiz
 *               - host
 *             properties:
 *               quiz:
 *                 type: string
 *                 description: ObjectId del quiz que se jugará
 *                 example: 6650f2a3b5e4c10012345678
 *               host:
 *                 type: string
 *                 description: ObjectId del usuario anfitrión
 *                 example: 6650f2a3b5e4c10087654321
 *     responses:
 *       201:
 *         description: Partida creada (incluye el roomCode generado)
 *       404:
 *         description: Quiz o host no encontrados
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
 *           example: ABCD
 *     responses:
 *       200:
 *         description: Estado de la sala
 */
router.get('/rooms/:code/exists', checkRoomExists);

/**
 * @swagger
 * /matches/user/{userId}:
 *   get:
 *     tags: [Matches]
 *     summary: Lista el historial de partidas de un usuario (como host o jugador)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: 6650f2a3b5e4c10087654321
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Historial de partidas con paginado
 */
router.get('/user/:userId', getMatchesByUser);

/**
 * @swagger
 * /matches/{id}:
 *   get:
 *     tags: [Matches]
 *     summary: Obtiene el resultado y detalles de una partida
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultado y detalles de la partida
 *       404:
 *         description: Partida no encontrada
 *   put:
 *     tags: [Matches]
 *     summary: Actualiza el status y/o timestamps de una partida
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [waiting, in_progress, finished, cancelled]
 *                 example: in_progress
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Si se omite y status pasa a in_progress, se asigna la fecha actual
 *                 example: 2025-01-15T20:30:00.000Z
 *               finishedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Si se omite y status pasa a finished, se asigna la fecha actual
 *                 example: 2025-01-15T21:00:00.000Z
 *     responses:
 *       200:
 *         description: Partida actualizada
 *       404:
 *         description: Partida no encontrada
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
 *       404:
 *         description: Partida no encontrada
 */
router.get('/:id', getMatchById);
router.put('/:id', updateMatch);
router.delete('/:id', deleteMatch);

export default router;
