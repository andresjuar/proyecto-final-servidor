import express from 'express';
import router from './routes';
import { engine } from 'express-handlebars';

let app: express.Application;
export function createApp() {
    app = express();

    app.engine('handlebars', engine());
    app.set('view engine', 'handlebars');
    app.set('views', './views');
    // extender app

    app.use(router);

    return app;
}

export function getApp(){
    return app;
}
