import { Router } from "express";
import { googleCallback, googleAuth, logout } from "../controllers/auth.controller";


const router = Router();



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
router.get("/google", googleAuth);

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
router.get("/google/callback", googleCallback);

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
router.post("/logout", logout);

export default router;

