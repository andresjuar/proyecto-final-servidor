import { Router } from 'express';
import { getUserProfile, getUserQuizzes, getUserMatches, updateUser, deleteUser } from '../controllers/user.controller';

const router = Router();

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obtiene un usuario por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos del usuario
 *       404:
 *         description: Usuario no encontrado
 *   put:
 *     tags: [Users]
 *     summary: Edita displayName y/o avatarUrl de un usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       404:
 *         description: Usuario no encontrado
 *   delete:
 *     tags: [Users]
 *     summary: Elimina la cuenta de un usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', getUserProfile);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

/**
 * @swagger
 * /users/{id}/quizzes:
 *   get:
 *     tags: [Users]
 *     summary: Obtiene los quizzes de un usuario en específico
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de quizzes del usuario
 */
router.get('/:id/quizzes', getUserQuizzes);

/**
 * @swagger
 * /users/{id}/matches:
 *   get:
 *     tags: [Users]
 *     summary: Obtiene el historial de partidas de un usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista partidas del usuario
 */
router.get('/:id/matches', getUserMatches);

export default router;
