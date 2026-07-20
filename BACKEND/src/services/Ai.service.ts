import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.config';
import { AppError } from '../utils/AppError';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        responseMimeType: 'application/json',
    },
});

export interface AIQuestion {
    question: string;
    options: string[];
    correctIndex: number;
}


export async function generateTriviaQuestions(topic: string, numQuestions: number): Promise<AIQuestion[]> {
    if (!env.geminiApiKey) {
        throw new AppError('GEMINI_API_KEY no está configurada en el servidor', 500);
    }

    const prompt = `Generate a JSON array of ${numQuestions} trivia questions about ${topic}.
Format: [{"question": "...", "options": ["...", "...", "...", "..."], "correct": 0}]
Each question must have at least 2 options, and "correct" must be a valid index into "options".`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Limpieza de seguridad por si Gemini ignora el responseMimeType
    text = text.replace(/```json|```/gi, '').trim();

    const crudo: { question: string; options: string[]; correct: number }[] = JSON.parse(text);

    return crudo.map((p) => ({
        question: p.question,
        options: p.options,
        correctIndex: p.correct,
    }));
}
