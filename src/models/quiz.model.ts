import { Schema, model, Document, Types } from 'mongoose';

export interface IQuestion {
    question: string;
    imageUrl?: string;
    options: string[];
    correctIndex: number;
    timeLimitSeconds: number;
}

export interface IQuiz extends Document {
    title: string;
    description?: string;
    coverImageUrl?: string;
    owner: Types.ObjectId;
    topic?: string;
    generatedByAI: boolean;
    isPublic: boolean;
    tags: string[];
    timesPlayed: number;
    questions: IQuestion[];
    createdAt: Date;
    updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
    {
        question: {
            type: String,
            required: [true, 'La pregunta es requerida'],
            trim: true,
        },
        imageUrl: {
            type: String,
            trim: true,
        },
        options: {
            type: [String],
            required: [true, 'Las opciones son requeridas'],
            validate: {
                validator: (opts: string[]) => Array.isArray(opts) && opts.length >= 2,
                message: 'Cada pregunta debe tener al menos 2 opciones',
            },
        },
        correctIndex: {
            type: Number,
            required: [true, 'El índice de la respuesta correcta es requerido'],
            validate: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                validator: function (this: any, value: number) {
                    const opciones: string[] = this.options ?? [];
                    return Number.isInteger(value) && value >= 0 && value < opciones.length;
                },
                message: 'correctIndex debe apuntar a una opción válida de la pregunta',
            },
        },
        timeLimitSeconds: {
            type: Number,
            default: 20,
            min: [5, 'El tiempo límite mínimo es de 5 segundos'],
            max: [120, 'El tiempo límite máximo es de 120 segundos'],
        },
    },
    { _id: false },
);

const quizSchema = new Schema<IQuiz>(
    {
        title: {
            type: String,
            required: [true, 'El título es requerido'],
            trim: true,
            minlength: [3, 'El título debe tener al menos 3 caracteres'],
            maxlength: [100, 'El título no puede exceder 100 caracteres'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
            default: '',
        },
        coverImageUrl: {
            type: String,
            trim: true,
            default: '',
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'El owner es requerido'],
        },
        topic: {
            type: String,
            trim: true,
            default: '',
        },
        generatedByAI: {
            type: Boolean,
            default: false,
        },
        isPublic: {
            type: Boolean,
            default: false,
        },
        tags: {
            type: [String],
            default: [],
        },
        timesPlayed: {
            type: Number,
            default: 0,
            min: [0, 'timesPlayed no puede ser negativo'],
        },
        questions: {
            type: [questionSchema],
            required: [true, 'El quiz debe tener al menos una pregunta'],
            validate: {
                validator: (qs: IQuestion[]) => Array.isArray(qs) && qs.length >= 1,
                message: 'El quiz debe tener al menos una pregunta',
            },
        },
    },
    {
        timestamps: true,
    },
);

export const Quiz = model<IQuiz>('Quiz', quizSchema);
