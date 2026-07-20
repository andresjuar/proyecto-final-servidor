import express from 'express';
import router from './routes';
import { errorMiddleware } from './middlewares/error.middleware';
import swaggerConfig from './config/swagger.config';
import swaggerJSDoc from 'swagger-jsdoc';
import { serve, setup } from 'swagger-ui-express';
import path from 'path';

let app: express.Application;
export function createApp() {
    app = express();

    // extender app

    const swaggerSpec = swaggerJSDoc(swaggerConfig);
    app.use('/api-docs', serve, setup(swaggerSpec));

    app.use(express.static(path.join(__dirname, '../../FRONTEND')));

    app.use(router);
    app.use(errorMiddleware);

    return app;
}

export function getApp() {
    return app;
}
