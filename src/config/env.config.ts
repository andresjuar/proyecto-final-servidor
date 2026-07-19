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
    corsOrigin: process.env.CORS_ORIGIN || '*', //Ahorita solo para sockets

    activationTokenSecret: required('ACTIVATION_TOKEN_SECRET'),
    activationTokenExpiresIn: process.env.ACTIVATION_TOKEN_EXPIRES_IN || '1d',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || '',
    appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
};
