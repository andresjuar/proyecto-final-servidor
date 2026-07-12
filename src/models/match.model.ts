import { Schema, model, Types } from 'mongoose';

/* 
    Cada match tiene un arreglo de jugadores, los cuales al entrar a la partida 
    tienen la opción de entrar habiendo iniciado sesión, y les aparece en pantalla su username
    o entrar como guest, entonces en el cliente del jugador le preguntará por un nombre de partidoa
    es por eso que en gestName, es la parte de required hay una función, en la que pregunta si hay un
    usuario asociado con el jugador, retorna falso, por lo que no es necesario, y si no lo hay,
    si es necesario que haya un guest name
*/
const playerSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        guestName: {
            type: String,
            trim: true,
            required: function (this: { user?: Types.ObjectId }) {
                return !this.user;
            },
        },
        score: {
            type: Number,
            default: 0,
            min: 0,
        },
        correctAnswers: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false },
);

const matchSchema = new Schema(
    {
        quiz: {
            type: Schema.Types.ObjectId,
            ref: 'Quiz',
            required: true,
        },
        host: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        roomCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        status: {
            type: String,
            enum: {
                values: ['waiting', 'in_progress', 'finished', 'cancelled'],
            },
            default: 'waiting',
        },
        startedAt: {
            type: Date,
        },
        finishedAt: {
            type: Date,
        },
        players: {
            type: [playerSchema],
            default: [],
        },
    },
    { timestamps: true },
);

export const Match = model('Match', matchSchema);
