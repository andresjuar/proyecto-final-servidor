import { Router, json } from 'express';
import authRoutes from './auth.routes';
import matchRoutes from './match.routes';
import quizRoutes from './quiz.routes';
import userRoutes from './user.routes';

const router = Router();

router.use(json());

/**
 * @swagger
 * /:
 *   get:
 *      summary: pagina de inicio
 *      responses:
 *          200:
 *              description: homepage
 *          401:
 *              description: falta el token de autorización
 */
router.get('/', (req, res) => {
    res.send('Proyecto final Servidor Adan y Andres');
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/quizzes', quizRoutes);
router.use('/matches', matchRoutes);

export default router;
