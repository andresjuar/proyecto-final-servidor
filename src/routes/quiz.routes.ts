import { Router } from 'express';
import {
    getQuizzes,
    createQuiz,
    generateQuiz,
    getQuizById,
    updateQuiz,
    deleteQuiz,
    uploadQuizImage,
} from '../controllers/quiz.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /quizzes:
 *   get:
 *     tags: [Quizzes]
 *     summary: Lista los quizzes disponibles (con paginado, para el dashboard de quizzes)
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           example: superhéroes
 *         required: false
 *         description: Texto de búsqueda para filtrar quizzes
 *
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         required: false
 *         description: "Tags separados por coma (ej: ciencia,literatura,superhéroes)"
 *
 *       - in: query
 *         name: owner
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra quizzes por id del creador (devuelve sus quizzes públicos)
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         required: false
 *         description: Número de página
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         required: false
 *         description: Cantidad de resultados por página
 *
 *     responses:
 *       200:
 *         description: Listado de quizzes
 */
router.get('/', getQuizzes);

/**
 * @swagger
 * /quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Crea un quiz manualmente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - questions
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Quiz de superhéroes
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Preguntas sobre el universo Marvel y DC
 *               coverImageUrl:
 *                 type: string
 *                 example: https://picsum.photos/seed/quiz/400/200
 *               topic:
 *                 type: string
 *                 example: cómics
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [superhéroes, marvel, dc]
 *               generatedByAI:
 *                 type: boolean
 *                 default: false
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - question
 *                     - options
 *                     - correctIndex
 *                   properties:
 *                     question:
 *                       type: string
 *                       example: ¿Cuál es el alter ego de Batman?
 *                     options:
 *                       type: array
 *                       minItems: 2
 *                       items:
 *                         type: string
 *                       example: [Bruce Wayne, Clark Kent, Tony Stark, Peter Parker]
 *                     correctIndex:
 *                       type: integer
 *                       description: Índice (base 0) de la opción correcta dentro del arreglo options
 *                       example: 0
 *                     timeLimitSeconds:
 *                       type: integer
 *                       minimum: 5
 *                       maximum: 120
 *                       default: 20
 *                       example: 20
 *                     imageUrl:
 *                       type: string
 *                       example: https://picsum.photos/seed/batman/400/200
 *     responses:
 *       201:
 *         description: Quiz creado
 *       400:
 *         description: Faltan campos requeridos o validación fallida
 *       401:
 *         description: No autorizado (token faltante o inválido)
 */
router.post('/', authMiddleware, createQuiz);

/**
 * @swagger
 * /quizzes/generate:
 *   post:
 *     tags: [Quizzes]
 *     summary: Genera un quiz automáticamente mediante IA a partir de un tema
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 description: Tema sobre el que se generarán las preguntas
 *                 example: historia de México
 *               numQuestions:
 *                 type: integer
 *                 description: Cantidad de preguntas a generar (por defecto 5)
 *                 default: 5
 *                 example: 10
 *     responses:
 *       202:
 *         description: Preguntas generadas (integración con Gemini AI pendiente)
 *       400:
 *         description: El topic es requerido
 */
router.post('/generate', generateQuiz);

/**
 * @swagger
 * /quizzes/{id}/image:
 *   post:
 *     tags: [Quizzes]
 *     summary: Subir la imagen de portada de un quiz
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Url de la imágen
 *       404:
 *         description: Quiz no encontrado
 */
router.post('/:id/image', uploadQuizImage);

/**
 * @swagger
 * /quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Obtiene los datos de un quiz
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle del quiz
 *       404:
 *         description: Quiz no encontrado
 *   put:
 *     tags: [Quizzes]
 *     summary: Edita parcialmente un quiz existente (solo los campos enviados serán actualizados)
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
 *             description: Puedes enviar solo los campos que deseas actualizar
 *             properties:
 *               title:
 *                 type: string
 *                 example: Superhéroes Actualizado
 *               isPublic:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Quiz actualizado
 *       404:
 *         description: Quiz no encontrado
 *   delete:
 *     tags: [Quizzes]
 *     summary: Elimina un quiz
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
 *         description: Quiz eliminado
 *       404:
 *         description: Quiz no encontrado
 */
router.get('/:id', getQuizById);
router.put('/:id', authMiddleware, updateQuiz);
router.delete('/:id', authMiddleware, deleteQuiz);

export default router;
