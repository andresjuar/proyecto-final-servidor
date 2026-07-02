import swaggerJsDoc from 'swagger-jsdoc';
import { serve, setup } from 'swagger-ui-express';
import { config } from 'dotenv';
config();

import { createApp } from './app';
import swaggerConfig from './config/swagger.config';

const port = process.env.PORT || 3000;

const app = createApp();

//crear docs de swagger
const swaggerSpec = swaggerJsDoc(swaggerConfig);

//montar la interfaz de swagger
app.use('/api-docs', serve, setup(swaggerSpec));

app.listen(port, () => {
    console.log('api running in http://localhost:' + port);
});
