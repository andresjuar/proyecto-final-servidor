import { Router } from 'express';
import {
    googleCallback,
    googleAuth,
    logout,
    register,
    login,
    me,
    activateAccount,
    resendActivation,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un nuevo usuario con email y contraseña
 *     description: >
 *       La cuenta se crea inactiva (isActive:false) y se manda un correo con un
 *       link de activación. NO se regresa un token de sesión en la respuesta —
 *       hay que activar la cuenta primero (GET /auth/activate/{token}) antes de
 *       poder hacer login.
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
 *         description: Cuenta creada (inactiva), correo de activación enviado
 *       400:
 *         description: Error de validación o email ya registrado
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/activate/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Activa una cuenta a partir del link mandado por correo
 *     description: Pensado para abrirse directo desde el correo (responde HTML, no JSON).
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cuenta activada (página HTML de confirmación)
 *       400:
 *         description: Token inválido o expirado
 *       404:
 *         description: El usuario de este link ya no existe
 */
router.get('/activate/:token', activateAccount);

/**
 * @swagger
 * /auth/resend-activation:
 *   post:
 *     tags: [Auth]
 *     summary: Reenvía el correo de activación de cuenta
 *     description: >
 *       Respuesta siempre genérica (mismo mensaje exista o no el correo, esté
 *       activa o no la cuenta) para no filtrar esa información por este endpoint.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: andres@example.com
 *     responses:
 *       200:
 *         description: Mensaje genérico (siempre, sin importar si el correo existe)
 *       400:
 *         description: Falta el email
 */
router.post('/resend-activation', resendActivation);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión con email y contraseña
 *     description: Falla con 403 si la cuenta todavía no ha sido activada por correo.
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
 *       403:
 *         description: La cuenta existe pero no ha sido activada
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
