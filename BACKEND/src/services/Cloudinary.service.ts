import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.config';
import { AppError } from '../utils/AppError';

/**
 * Cloudinary.service.ts - subida de imágenes (portada de quiz, imagen de una
 * pregunta específica) a Cloudinary.
 * Esto esta obtenido casi tal cual de la documentación tal cual de cloudinary
 */

cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
});

export interface UploadedImage {
    url: string;
    publicId: string;
}

export async function uploadImageBuffer(buffer: Buffer, mimetype: string, folder: string): Promise<UploadedImage> {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;

    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            folder,
            resource_type: 'image',
        });
        return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
        console.error('Error subiendo imagen a Cloudinary:', error);
        throw new AppError('No se pudo subir la imagen, intenta de nuevo', 502);
    }
}
