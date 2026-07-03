import express from 'express';
import router from './routes';
import { engine } from 'express-handlebars';

let app: express.Application;
export function createApp() {
    app = express();


    // extender app

    app.use(router);

    return app;
}

export function getApp(){
    return app;
}
