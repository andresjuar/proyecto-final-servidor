
import { config } from 'dotenv';
config();

import { createApp } from './app';
import { env } from './config/env.config';
import { connect } from './config/db.config';

//dividimos la función de index en una async llamada main para poder cachar cualquier
//error que se pueda generar al momento de conectarse a la base de datos y que no se inicie
//la app si no se logra esa conexión
async function main() {
    await connect();

    const app = createApp();

    app.listen(env.port, () => {
        console.log('api running in http://localhost:' + env.port);
    });
}

main().catch((err) => {
    console.error('No se pudo iniciar el servidor:', err);
    process.exit(1);
});
