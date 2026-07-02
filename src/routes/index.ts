import { Router, json } from 'express';

const router = Router();

router.use(json());
/* 
const datosaValidar = ['name','email','password'];
router.get('usuario/new', validator(datosaValidar));
 */

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
    res.send("api works");
});

export default router;
