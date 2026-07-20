import { Types } from 'mongoose';
import { Quiz } from '../quiz.model';

/**
 * Pruebas básicas del modelo Quiz usando validateSync(), que corre las
 * validaciones del schema SIN necesitar conexión a MongoDB.
 */

const preguntaValida = {
    question: '¿Cuánto es 2 + 2?',
    options: ['3', '4'],
    correctIndex: 1,
    timeLimitSeconds: 10,
};

const datosValidos = {
    title: 'Quiz de prueba',
    owner: new Types.ObjectId(),
    questions: [preguntaValida],
};

describe('Quiz model', () => {
    it('acepta un quiz con datos válidos', () => {
        const quiz = new Quiz(datosValidos);
        const error = quiz.validateSync();
        expect(error).toBeUndefined();
    });

    it('requiere el título', () => {
        const quiz = new Quiz({ ...datosValidos, title: undefined });
        const error = quiz.validateSync();
        expect(error?.errors.title).toBeDefined();
    });

    it('requiere el owner', () => {
        const quiz = new Quiz({ ...datosValidos, owner: undefined });
        const error = quiz.validateSync();
        expect(error?.errors.owner).toBeDefined();
    });

    it('rechaza un quiz sin preguntas', () => {
        const quiz = new Quiz({ ...datosValidos, questions: [] });
        const error = quiz.validateSync();
        expect(error?.errors.questions).toBeDefined();
    });

    it('rechaza una pregunta con menos de 2 opciones', () => {
        const quiz = new Quiz({
            ...datosValidos,
            questions: [{ ...preguntaValida, options: ['única'] }],
        });
        const error = quiz.validateSync();
        expect(error).toBeDefined();
    });

    it('rechaza un correctIndex fuera del rango de opciones', () => {
        const quiz = new Quiz({
            ...datosValidos,
            questions: [{ ...preguntaValida, correctIndex: 5 }],
        });
        const error = quiz.validateSync();
        expect(error).toBeDefined();
    });

    it('usa isPublic:false y timesPlayed:0 por defecto', () => {
        const quiz = new Quiz(datosValidos);
        expect(quiz.isPublic).toBe(false);
        expect(quiz.timesPlayed).toBe(0);
    });
});
