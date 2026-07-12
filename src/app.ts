import express from 'express';
import router from './routes';

let app: express.Application;
export function createApp() {
    app = express();

    // extender app

    app.use(router);

    return app;
}

export function getApp() {
    return app;
}
