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
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Origen permitido para Socket.io (y para CORS de la API en general si lo agregan después).
    // '*' es cómodo en desarrollo, pero conviene poner el dominio real del frontend en producción.
    corsOrigin: process.env.CORS_ORIGIN || '*',

    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};
