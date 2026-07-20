import { Options } from 'swagger-jsdoc';
import { env } from './env.config';

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
                url: env.appBaseUrl,
            },
        ],
        components: {
            schemas: {
                Usuario: {},
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/**/*.ts'],
};

export default swaggerConfig;
