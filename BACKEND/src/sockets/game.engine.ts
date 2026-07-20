import type { Namespace } from 'socket.io';
import type { IQuestion } from '../models/quiz.model';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketData,
    ErrorPayload,
    LeaderboardEntry,
    GameOverPayload,
    PublicQuestionPayload,
    HostQuestionPayload,
    RoomSyncData,
    GameSubmitAnswerPayload,
} from '../types/match.types';
import {
    type LiveRoom,
    type LivePlayer,
    resetAnswersForNewQuestion,
    countAnswered,
    countConnectedPlayers,
    buildLeaderboard,
    listPublicPlayers,
    getPlayerBySocket,
} from './roomState';

/*
game.engine.ts — maneja los estados de una partida en vivo.

Flujo:
  lobby -> [game:start] -> loading -> [game:next_question] -> question
  -> (todos responden / se acaba el tiempo / host fuerza) -> reveal
  -> (2s después) -> leaderboard -> [game:next_question] -> question (repite)
                                                      -> finished (si ya no hay más preguntas)

Este archivo no habla directo con Mongo. Cuando algo se debe guardar
(inicio o fin de partida), se usan hooks opcionales que define
game.handlers.ts. Así la lógica del juego queda separada y es más fácil de probar.
*/

export type GameNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, SocketData>;

/** Nombre de la sala de Socket.io donde solo entran los jugadores (no el host).
  Se usa para mandar la versión pública de la pregunta (sin correctIndex) sin
   tener que iterar socket por socket. El host se maneja siempre por su socketId individual. */
export function playersRoomName(roomCode: string): string {
    return `${roomCode}::players`;
}

export interface GameEngineHooks {
    onMatchStarted?: () => void | Promise<void>;
    onMatchFinished?: (leaderboard: LeaderboardEntry[]) => void | Promise<void>;
}

export type EngineResult = { ok: true } | { ok: false; code: ErrorPayload['code']; message: string };

// Puntaje: se calcula en función de que tan rápido se contesta la pregunta, si es en el instante inicial se dan los MAX_POINTS
// si es en el último instante se darán los mínimos y si es en isntantes intermedios se calculan usando una razón de tiempo
// timeLimitSeconds propio de cada pregunta (antes era un QUESTION_TIME fijo).

/* Nota de Andrés para el futuro
    TODO: Se me acaba de ocurrir que a las pregunta se les añade un isDoublePoints: boolean para que desde la UI se 
    pueda recibir el doble de puntos por una pregunta en específico, haciendo que preguntas valgan mas que otras
*/
export const MAX_POINTS = 1000;
export const MIN_POINTS = 100;
const LEADERBOARD_DELAY_MS = 2000; // tiempo entre que se revela la respuesta y se muestra el leaderboard

export function calculatePoints(secondsRemaining: number, timeLimitSeconds: number): number {
    if (timeLimitSeconds <= 0) return MIN_POINTS;
    const clampedSeconds = Math.max(0, Math.min(secondsRemaining, timeLimitSeconds));
    const ratio = clampedSeconds / timeLimitSeconds;
    return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * ratio);
}

// Iniciar partida

export async function startGame(io: GameNamespace, room: LiveRoom, hooks?: GameEngineHooks): Promise<EngineResult> {
    if (room.state !== 'lobby') {
        return { ok: false, code: 'INVALID_STATE', message: 'La partida ya fue iniciada.' };
    }
    if (room.questions.length === 0) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message:
                'Esta sala todavía no tiene un quiz asignado. Selecciona uno o genera uno con IA antes de iniciar.',
        };
    }
    if (countConnectedPlayers(room) < 1) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Se necesita al menos un jugador conectado para iniciar la partida.',
        };
    }

    room.state = 'loading';
    io.to(room.roomCode).emit('game:loading', { message: 'Preparando la partida...' });

    // Punto de sincronización con Mongo: Match.status = 'in_progress', startedAt = now
    if (hooks?.onMatchStarted) {
        await hooks.onMatchStarted();
    }

    io.to(room.roomCode).emit('game:ready', { totalQuestions: room.questions.length });

    return { ok: true };
}

// Avanzar de pregunta (o terminar el juego si ya no quedan)

export async function nextQuestion(io: GameNamespace, room: LiveRoom, hooks?: GameEngineHooks): Promise<EngineResult> {
    if (room.state !== 'loading' && room.state !== 'leaderboard') {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'No se puede avanzar de pregunta en este momento.',
        };
    }

    clearRoomTimers(room);
    room.currentQuestionIndex += 1;

    if (room.currentQuestionIndex >= room.questions.length) {
        await endGame(io, room, hooks);
        return { ok: true };
    }

    const question = room.questions[room.currentQuestionIndex];
    room.state = 'question';
    room.questionStartedAt = Date.now();
    resetAnswersForNewQuestion(room);

    const publicPayload = toPublicQuestion(question, room.currentQuestionIndex, room.questions.length);
    const hostPayload: HostQuestionPayload = { ...publicPayload, correctIndex: question.correctIndex };

    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('game:question', hostPayload);
    }
    io.to(playersRoomName(room.roomCode)).emit('game:question', publicPayload);

    let secondsLeft = question.timeLimitSeconds;
    room.tickInterval = setInterval(() => {
        secondsLeft -= 1;
        io.to(room.roomCode).emit('game:timer_tick', {
            questionIndex: room.currentQuestionIndex,
            secondsLeft: Math.max(0, secondsLeft),
        });

        if (secondsLeft <= 0) {
            clearRoomTimers(room);
            revealAnswer(io, room);
        }
    }, 1000);

    return { ok: true };
}

// Responder una pregunta

export function submitAnswer(
    io: GameNamespace,
    room: LiveRoom,
    socketId: string,
    payload: GameSubmitAnswerPayload,
): EngineResult {
    if (room.state !== 'question') {
        return { ok: false, code: 'INVALID_STATE', message: 'No hay una pregunta activa en este momento.' };
    }
    if (payload.questionIndex !== room.currentQuestionIndex) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Esa respuesta ya no corresponde a la pregunta activa.',
        };
    }

    const player = getPlayerBySocket(room, socketId);
    if (!player) {
        return { ok: false, code: 'UNKNOWN', message: 'No se encontró tu jugador en esta sala.' };
    }
    if (player.hasAnsweredCurrent) {
        return { ok: false, code: 'ALREADY_ANSWERED', message: 'Ya respondiste esta pregunta.' };
    }

    const question = room.questions[room.currentQuestionIndex];
    const secondsLeft = getSecondsLeft(room);
    const isCorrect = payload.answerIndex === question.correctIndex;

    player.hasAnsweredCurrent = true;
    player.answeredAt = Date.now();
    player.lastAnswerIndex = payload.answerIndex;
    player.lastAnswerCorrect = isCorrect;
    player.lastPoints = isCorrect ? calculatePoints(secondsLeft, question.timeLimitSeconds) : 0;

    io.to(player.socketId).emit('game:answer_received', { received: true });

    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('game:answer_count', {
            answeredCount: countAnswered(room),
            totalPlayers: countConnectedPlayers(room),
        });
    }

    // Auto-reveal en cuanto contestan todos los jugadores conectados (no hace falta esperar el timer)
    if (countAnswered(room) >= countConnectedPlayers(room)) {
        clearRoomTimers(room);
        revealAnswer(io, room);
    }

    return { ok: true };
}

// El host puede forzar el reveal manualmente antes de que se acabe el tiempo

export function forceRevealAnswer(io: GameNamespace, room: LiveRoom): EngineResult {
    if (room.state !== 'question') {
        return { ok: false, code: 'INVALID_STATE', message: 'No hay una pregunta activa para revelar.' };
    }
    clearRoomTimers(room);
    revealAnswer(io, room);
    return { ok: true };
}

// Internos: reveal -> leaderboard -> (siguiente pregunta o fin, disparado por el host)

function revealAnswer(io: GameNamespace, room: LiveRoom): void {
    if (room.state !== 'question') return;

    const question = room.questions[room.currentQuestionIndex];

    for (const player of room.players.values()) {
        player.score += player.lastPoints ?? 0;
        if (player.lastAnswerCorrect) player.correctAnswers += 1;
    }

    room.state = 'reveal';

    io.to(room.roomCode).emit('game:answer_revealed', {
        questionIndex: room.currentQuestionIndex,
        correctIndex: question.correctIndex,
        correctText: question.options[question.correctIndex],
    });

    room.questionTimer = setTimeout(() => {
        showLeaderboard(io, room);
    }, LEADERBOARD_DELAY_MS);
}

function showLeaderboard(io: GameNamespace, room: LiveRoom): void {
    if (room.state !== 'reveal') return;
    room.state = 'leaderboard';

    const leaderboard = buildLeaderboard(room);
    const isFinalRound = room.currentQuestionIndex >= room.questions.length - 1;

    io.to(room.roomCode).emit('game:leaderboard', { leaderboard, isFinalRound });
}

async function endGame(io: GameNamespace, room: LiveRoom, hooks?: GameEngineHooks): Promise<void> {
    room.state = 'finished';
    clearRoomTimers(room);

    const leaderboard = buildLeaderboard(room);

    // Punto de sincronización con Mongo: Match.status = 'finished', finishedAt = now,
    // volcar score/correctAnswers final de cada jugador.
    if (hooks?.onMatchFinished) {
        await hooks.onMatchFinished(leaderboard);
    }

    io.to(room.roomCode).emit('game:over', buildGameOverPayload(leaderboard));
}

// Jugar de nuevo: mismo roomCode / mismos sockets conectados, pero apuntando a un
// Match nuevo en Mongo (así el historial de partidas queda separado por juego).
// game.handlers.ts es quien crea ese Match nuevo; aquí solo se resetea la memoria.

export function playAgain(io: GameNamespace, room: LiveRoom, newMatchId: string): EngineResult {
    if (room.state !== 'finished') {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Solo se puede jugar de nuevo cuando la partida anterior ya terminó.',
        };
    }

    clearRoomTimers(room);

    room.matchId = newMatchId;
    room.quizId = '';
    room.questions = [];
    room.currentQuestionIndex = -1;
    room.questionStartedAt = null;
    room.state = 'lobby';

    for (const player of room.players.values()) {
        player.score = 0;
        player.correctAnswers = 0;
        player.hasAnsweredCurrent = false;
        player.lastAnswerIndex = undefined;
        player.lastAnswerCorrect = undefined;
        player.lastPoints = undefined;
        player.answeredAt = undefined;
    }

    io.to(room.roomCode).emit('game:play_again_ok', {
        matchId: newMatchId,
        players: listPublicPlayers(room),
    });

    return { ok: true };
}

// Reconstrucción de estado para quien se une tarde o se reconecta
export function buildSyncData(room: LiveRoom, player?: LivePlayer): RoomSyncData {
    switch (room.state) {
        case 'lobby':
            return { state: 'lobby' };
        case 'loading':
            return { state: 'loading' };
        case 'question': {
            const question = room.questions[room.currentQuestionIndex];
            return {
                state: 'question',
                question: toPublicQuestion(question, room.currentQuestionIndex, room.questions.length),
                secondsLeft: getSecondsLeft(room),
                alreadyAnswered: player?.hasAnsweredCurrent ?? false,
            };
        }
        case 'reveal': {
            const question = room.questions[room.currentQuestionIndex];
            return {
                state: 'reveal',
                revealed: {
                    questionIndex: room.currentQuestionIndex,
                    correctIndex: question.correctIndex,
                    correctText: question.options[question.correctIndex],
                },
            };
        }
        case 'leaderboard':
            return { state: 'leaderboard', leaderboard: buildLeaderboard(room) };
        case 'finished':
            return { state: 'finished', result: buildGameOverPayload(buildLeaderboard(room)) };
        default:
            return { state: 'lobby' };
    }
}

// Helpers privados
function clearRoomTimers(room: LiveRoom): void {
    if (room.tickInterval) {
        clearInterval(room.tickInterval);
        room.tickInterval = undefined;
    }
    if (room.questionTimer) {
        clearTimeout(room.questionTimer);
        room.questionTimer = undefined;
    }
}

function getSecondsLeft(room: LiveRoom): number {
    const question = room.questions[room.currentQuestionIndex];
    if (!room.questionStartedAt) return question.timeLimitSeconds;
    const elapsedSeconds = Math.floor((Date.now() - room.questionStartedAt) / 1000);
    return Math.max(0, question.timeLimitSeconds - elapsedSeconds);
}

export function toPublicQuestion(question: IQuestion, index: number, total: number): PublicQuestionPayload {
    return {
        questionIndex: index,
        totalQuestions: total,
        question: question.question,
        imageUrl: question.imageUrl,
        options: question.options,
        timeLimitSeconds: question.timeLimitSeconds,
    };
}

function buildGameOverPayload(leaderboard: LeaderboardEntry[]): GameOverPayload {
    const winner = leaderboard[0];
    return {
        winner: winner
            ? { socketId: winner.socketId, displayName: winner.displayName, score: winner.score }
            : { socketId: '', displayName: 'Sin jugadores', score: 0 },
        leaderboard,
    };
}
