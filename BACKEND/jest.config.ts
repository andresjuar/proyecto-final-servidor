import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest', // permite ejecutar pruebas en TypeScript
    testEnvironment: 'node', // es un backend, no un navegador
    roots: ['<rootDir>/src'], // donde buscar las pruebas
    testMatch: ['**/*.spec.ts', '**/*.test.ts'],
    clearMocks: true, // limpia los mocks entre pruebas
    transform: {
        // se usa tsconfig.test.json porque agrega los tipos de jest y multer
        // y las declaraciones globales de src/types (req.user)
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
        '!src/index.ts', // el arranque del servidor no se prueba aquí
    ],
    coverageDirectory: 'coverage',
};

export default config;
