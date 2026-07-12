import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
    googleId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    createdQuizzes: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema<IUser>(
    {
        googleId: {
            type: String,
            required: [true, 'El googleId es requerido'],
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'El email es requerido'],
            unique: true,
            trim: true,
            lowercase: true,
            validate: {
                validator: (value: string) => EMAIL_REGEX.test(value),
                message: 'El email no tiene un formato válido',
            },
        },
        displayName: {
            type: String,
            required: [true, 'El displayName es requerido'],
            trim: true,
            minlength: [2, 'El displayName debe tener al menos 2 caracteres'],
            maxlength: [50, 'El displayName no puede exceder 50 caracteres'],
        },
        avatarUrl: {
            type: String,
            trim: true,
            default: '',
        },
        createdQuizzes: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Quiz' }],
            default: [],
        },
    },
    {
        timestamps: true,
    },
);

export const User = model<IUser>('User', userSchema);
