function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Falta la variable de entorno requerida: ${name}`);
    }
    return value;
}

export const env = {
    port: Number(process.env.PORT) || 3000,
    mongoUri: required('MONGODB_URI'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
