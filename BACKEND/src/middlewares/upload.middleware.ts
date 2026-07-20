import multer from 'multer';
import { AppError } from '../utils/AppError';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Middleware de subida de UNA imagen bajo el campo "image" (multipart/form-data).
 * Usa memoryStorage (no escribe a disco) porque el buffer se sube directo a
 * Cloudinary en el controller — el archivo nunca toca el filesystem del server.
 */
export const uploadImageMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
            callback(new AppError('El archivo debe ser una imagen', 400));
            return;
        }
        callback(null, true);
    },
}).single('image');
