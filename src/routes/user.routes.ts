import { Router } from "express";
import { getUserProfile, getUserQuizzes, getUserMatches } from "../controllers/user.controller";

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
 */
router.get("/:id", getUserProfile);

/**
 * @swagger
 * /users/{id}/quizzes:
 *   get:
 *     tags: [Users]
 *     summary: Obtriene los quizzes de un usuario en específico
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
router.get("/:id/quizzes", getUserQuizzes);

/**
 * @swagger
 * /users/{id}/matches:
 *   get:
 *     tags: [Users]
 *     summary: Obtriene el historial de partidas de un usuario
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
router.get("/:id/matches", getUserMatches);




export default router;