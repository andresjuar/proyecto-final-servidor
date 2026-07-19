import { Router } from 'express';
import {
    checkRoomExists,
    createMatch,
    deleteMatch,
    generateQuizForMatch,
    getMatchById,
    getMatchesByUser,
    selectQuizForMatch,
    updateMatch,
} from './../controllers/match.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /matches:
 *   post:
 *     tags: [Matches]
 *     summary: Crea una nueva partida (el quiz se asigna después, no aquí)
 *     description: >
 *       Crea la sala con su roomCode. El quiz es opcional en este paso: se asigna
 *       después con PATCH /matches/{id}/quiz (uno ya existente) o
 *       POST /matches/{id}/generate-quiz (generado con IA a partir de un tema),
 *       en cualquier momento mientras la partida siga en 'waiting'.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quiz:
 *                 type: string
 *                 description: (Opcional) ObjectId de un quiz, si ya se quiere asignar de una vez
 *                 example: 6a5459a21c95d7b04766c4a8
 *     responses:
 *       201:
 *         description: Partida creada (incluye el roomCode generado)
 *       401:
 *         description: No autorizado (token faltante o inválido)
 */
router.post('/', authMiddleware, createMatch);

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
 * /matches/{id}/quiz:
 *   patch:
 *     tags: [Matches]
 *     summary: Asigna un quiz ya existente a una partida en espera
 *     description: Solo el host, y solo mientras la partida esté en 'waiting'. Se puede llamar varias veces para cambiar de quiz antes de iniciar.
 *     security:
 *       - bearerAuth: []
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
 *             required: [quizId]
 *             properties:
 *               quizId:
 *                 type: string
 *                 example: 6a5459a21c95d7b04766c4a8
 *     responses:
 *       200:
 *         description: Partida actualizada con el quiz asignado
 *       400:
 *         description: La partida ya no está en 'waiting', o falta quizId
 *       403:
 *         description: No eres el host de esta partida
 *       404:
 *         description: Partida o quiz no encontrados
 */
router.patch('/:id/quiz', authMiddleware, selectQuizForMatch);

/**
 * @swagger
 * /matches/{id}/generate-quiz:
 *   post:
 *     tags: [Matches]
 *     summary: Genera un quiz con IA a partir de un tema y lo asigna a la partida
 *     description: Solo el host, y solo mientras la partida esté en 'waiting'. Se puede llamar varias veces para regenerar/cambiar de tema antes de iniciar.
 *     security:
 *       - bearerAuth: []
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
 *             required: [topic]
 *             properties:
 *               topic:
 *                 type: string
 *                 example: Historia de México
 *               numQuestions:
 *                 type: integer
 *                 default: 10
 *                 example: 10
 *     responses:
 *       201:
 *         description: Partida actualizada con el quiz generado
 *       400:
 *         description: La partida ya no está en 'waiting', o falta el topic
 *       403:
 *         description: No eres el host de esta partida
 *       404:
 *         description: Partida no encontrada
 *       502:
 *         description: Falló la generación con IA
 */
router.post('/:id/generate-quiz', authMiddleware, generateQuizForMatch);

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
 *     security:
 *       - bearerAuth: []
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
 *     security:
 *       - bearerAuth: []
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
router.put('/:id', authMiddleware, updateMatch);
router.delete('/:id', authMiddleware, deleteMatch);

export default router;
