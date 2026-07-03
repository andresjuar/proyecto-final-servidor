import { Router } from "express";
import { getQuizzes, createQuiz, generateQuiz, getQuizById, updateQuiz, deleteQuiz, uploadQuizImage } from "../controllers/quiz.controller";

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
router.get("/", getQuizzes);

/**
 * @swagger
 * /quizzes:
 *   post:
 *     tags: [Quizzes]
 *     summary: Crea un quiz manualmente
 *     responses:
 *       201:
 *         description: Quiz creado
 */
router.post("/", createQuiz);

/**
 * @swagger
 * /quizzes/generate:
 *   post:
 *     tags: [Quizzes]
 *     summary: Genera un quiz automáticamente mediante IA a partir de un tema
 *     responses:
 *       202:
 *         description: Preguntas generadas
 */
router.post("/generate", generateQuiz);

/**
 * @swagger
 * /quizzes/{id}/image:
 *   post:
 *     tags: [Quizzes]
 *     summary: Subir la imagen de portada de un quiz
 *      parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Url de la imágen
 */
router.post("/generate", uploadQuizImage);


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
 *   put:
 *     tags: [Quizzes]
 *     summary: Edita un quiz existente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz actualizado
 *   delete:
 *     tags: [Quizzes]
 *     summary: Elimina un quiz
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz eliminado
 */
router.get("/:id", getQuizById);
router.put("/:id", updateQuiz);
router.delete("/:id", deleteQuiz);



export default router;