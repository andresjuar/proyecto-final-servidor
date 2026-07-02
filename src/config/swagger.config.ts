import { Options } from 'swagger-jsdoc';

const port = process.env.PORT || 3000;

const swaggerConfig: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API de prueba',
            version: '0.0.1',
            description: 'esta api no sirve',
        },
        servers: [
            {
                url: `http://localhost:${port}`,
            },
        ],
        components: {
            schemas: {
                Usuario: {},
            },
        },
    },
    apis: ['./src/routes/**/*.ts'],
};

export default swaggerConfig;
