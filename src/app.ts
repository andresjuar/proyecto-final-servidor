import express from 'express';
import router from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

let app: express.Application;
export function createApp() {
    app = express();

    // extender app

    app.use(router);
    app.use(errorMiddleware);

    return app;
}

export function getApp() {
    return app;
}
