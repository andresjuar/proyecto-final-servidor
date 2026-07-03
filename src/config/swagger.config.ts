import { Options } from 'swagger-jsdoc';

const port = process.env.PORT || 3000;

const swaggerConfig: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API proyecto final Andres y Adan',
            version: '0.0.1',
            description: 'Rico quiz plus',
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
