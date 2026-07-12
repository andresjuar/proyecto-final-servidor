import mongoose from 'mongoose';
import { env } from './env.config';

export function connect() {
    mongoose.connection.on('connected', () => {
        console.log('MongoDB conectado');
    });

    mongoose.connection.on('error', (err) => {
        console.error('Error de conexión a MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.log('MongoDB desconectado');
    });

    return mongoose.connect(env.mongoUri);
}

export function disconnect() {
    return mongoose.disconnect();
}
