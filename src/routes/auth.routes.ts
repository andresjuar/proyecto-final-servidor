import { Router } from 'express';
import { googleCallback, googleAuth, logout, register, login, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un nuevo usuario con email y contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: andres@example.com
 *               displayName:
 *                 type: string
 *                 example: Andres
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente
 *       400:
 *         description: Error de validación o email ya registrado
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión con email y contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: andres@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtiene el usuario autenticado a partir del JWT
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado
 *       401:
 *         description: No autorizado
 */
router.get('/me', authMiddleware, me);

/**
 * @swagger
 * /auth/google:
 *   get:
 *     tags: [Auth]
 *     summary: Inicia el flujo de autenticación OAuth 2.0 con Google
 *     responses:
 *       200:
 *         description: Redirección a Google, que en este momento es dummy
 */
router.get('/google', googleAuth);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Callback de Google después de autenticación
 *     responses:
 *       200:
 *         description: Sesión iniciada
 */
router.get('/google/callback', googleCallback);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra la sesión del usuario
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
router.post('/logout', logout);

export default router;
