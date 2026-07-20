import { Match } from '../../models/match.model';
import { Quiz } from '../../models/quiz.model';
import type { GameSocket } from '../auth.socket';
import {
    type GameNamespace,
    type GameEngineHooks,
    type EngineResult,
    startGame,
    nextQuestion,
    submitAnswer,
    forceRevealAnswer,
    playAgain,
} from '../game.engine';
import { type LiveRoom, getRoom } from '../roomState';
import type { ErrorPayload, GameSubmitAnswerPayload, LeaderboardEntry } from '../../types/match.types';

/* 
 Este archivo se encarga de conectar los eventos de socket.io con game.engine.ts, y además altera la base de datos:
 Puntos de sincronización con Mongo que se hacen en este archivo:
    - game:start   -> Match.status='in_progress', startedAt=now
    - fin del juego -> Match.status='finished', finishedAt=now, y se vuelca
      Match.players[] completo desde room.players (memoria), que es donde
     realmente vive el score/correctAnswers acumulado durante la partida.
*/

export function registerGameHandlers(io: GameNamespace, socket: GameSocket): void {
    socket.on('game:start', () => {
        void handleGameStart(io, socket);
    });

    socket.on('game:next_question', () => {
        void handleNextQuestion(io, socket);
    });

    socket.on('game:submit_answer', (payload) => {
        handleSubmitAnswer(io, socket, payload);
    });

    socket.on('game:reveal_answer', () => {
        handleRevealAnswer(io, socket);
    });

    socket.on('game:play_again', () => {
        void handlePlayAgain(io, socket);
    });
}

// game:start: solo el host, y ahí se marca in_progress en Mongo
async function handleGameStart(io: GameNamespace, socket: GameSocket): Promise<void> {
    const room = getRoomOrError(socket);
    if (!room) return;
    if (!requireHost(socket)) return;

    const refreshed = await refreshRoomQuiz(room);
    if (!refreshed.ok) {
        emitError(socket, refreshed.code, refreshed.message);
        return;
    }

    const hooks: GameEngineHooks = {
        onMatchStarted: () => markMatchInProgress(room.matchId),
    };

    const result = await startGame(io, room, hooks);
    if (!result.ok) {
        emitError(socket, result.code, result.message);
    }
}

/*
  Vuelve a leer el Match (y su quiz) desde Mongo antes de iniciar,
  ya que la sala pudo haberse creado antes de que el host definiera o cambiara el quiz,
  y game.engine.ts no vuelve a consultarlo por sí mismo.
 */
async function refreshRoomQuiz(room: LiveRoom): Promise<EngineResult> {
    const match = await Match.findById(room.matchId).lean();
    if (!match) {
        return { ok: false, code: 'ROOM_NOT_FOUND', message: 'La partida ya no existe en la base de datos.' };
    }
    if (!match.quiz) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Selecciona un quiz o genera uno con IA antes de iniciar la partida.',
        };
    }

    const quiz = await Quiz.findById(match.quiz).lean();
    if (!quiz || quiz.questions.length === 0) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'El quiz asignado a esta partida no tiene preguntas.',
        };
    }

    room.questions = quiz.questions;
    room.quizId = quiz._id.toString();
    return { ok: true };
}

// game:next_question: solo el host; si ya no hay más preguntas, el engine llama
// a onMatchFinished internamente y termina la partida

async function handleNextQuestion(io: GameNamespace, socket: GameSocket): Promise<void> {
    const room = getRoomOrError(socket);
    if (!room) return;
    if (!requireHost(socket)) return;

    const hooks: GameEngineHooks = {
        onMatchFinished: (leaderboard) => finishMatchInDb(room, leaderboard),
    };

    const result = await nextQuestion(io, room, hooks);
    if (!result.ok) {
        emitError(socket, result.code, result.message);
    }
}

// game:submit_answer: solo jugadores (el host no juega, no manda respuestas)

function handleSubmitAnswer(io: GameNamespace, socket: GameSocket, payload: GameSubmitAnswerPayload): void {
    const room = getRoomOrError(socket);
    if (!room) return;

    if (socket.data.role !== 'player') {
        emitError(socket, 'INVALID_STATE', 'El host no puede responder preguntas.');
        return;
    }

    const result = submitAnswer(io, room, socket.id, payload);
    if (!result.ok) {
        emitError(socket, result.code, result.message);
    }
}

// game:reveal_answer: el host fuerza el reveal antes de que se acabe el timer

function handleRevealAnswer(io: GameNamespace, socket: GameSocket): void {
    const room = getRoomOrError(socket);
    if (!room) return;
    if (!requireHost(socket)) return;

    const result = forceRevealAnswer(io, room);
    if (!result.ok) {
        emitError(socket, result.code, result.message);
    }
}

// game:play_again: solo el host, y solo si la partida anterior ya terminó.
// Crea un Match NUEVO en Mongo (mismo roomCode, para que el historial quede separado
// por partida) y resetea la sala en memoria a 'lobby' sin desconectar a nadie.

async function handlePlayAgain(io: GameNamespace, socket: GameSocket): Promise<void> {
    const room = getRoomOrError(socket);
    if (!room) return;
    if (!requireHost(socket)) return;

    if (room.state !== 'finished') {
        emitError(socket, 'INVALID_STATE', 'Solo se puede jugar de nuevo cuando la partida anterior ya terminó.');
        return;
    }

    let newMatchId: string;
    try {
        const newMatch = await Match.create({
            host: room.hostUserId,
            roomCode: room.roomCode,
            status: 'waiting',
            players: [],
        });
        newMatchId = newMatch._id.toString();
    } catch (err) {
        console.error('No se pudo crear la nueva partida para "jugar de nuevo":', err);
        emitError(socket, 'UNKNOWN', 'No se pudo iniciar una nueva partida, intenta de nuevo.');
        return;
    }

    const result = playAgain(io, room, newMatchId);
    if (!result.ok) {
        emitError(socket, result.code, result.message);
    }
}

// Guards compartidos

function getRoomOrError(socket: GameSocket): LiveRoom | undefined {
    const roomCode = socket.data.roomCode;
    if (!roomCode) {
        emitError(socket, 'ROOM_NOT_FOUND', 'No estás dentro de ninguna sala.');
        return undefined;
    }

    const room = getRoom(roomCode);
    if (!room) {
        emitError(socket, 'ROOM_NOT_FOUND', 'La sala ya no existe.');
        return undefined;
    }

    return room;
}

function requireHost(socket: GameSocket): boolean {
    if (socket.data.role !== 'host') {
        emitError(socket, 'NOT_HOST', 'Solo el host puede hacer esto.');
        return false;
    }
    return true;
}

function emitError(socket: GameSocket, code: ErrorPayload['code'], message: string): void {
    socket.emit('error', { code, message });
}

// Funciones que alteran la base de datos de mongo

async function markMatchInProgress(matchId: string): Promise<void> {
    try {
        await Match.updateOne(
            { _id: matchId, status: 'waiting' },
            { $set: { status: 'in_progress', startedAt: new Date() } },
        );
    } catch (err) {
        console.error('No se pudo marcar la partida como iniciada:', err);
    }
}

async function finishMatchInDb(room: LiveRoom, leaderboard: LeaderboardEntry[]): Promise<void> {
    const winner = leaderboard[0];
    if (winner) {
        console.log(
            `[RicoQuiz+] Partida ${room.roomCode} terminó. Ganador: ${winner.displayName} (${winner.score} pts)`,
        );
    }

    try {
        await Match.updateOne(
            { _id: room.matchId, status: { $ne: 'finished' } },
            {
                $set: {
                    status: 'finished',
                    finishedAt: new Date(),
                    players: buildMatchPlayersFromRoom(room),
                },
            },
        );
    } catch (err) {
        console.error('No se pudo marcar la partida como terminada:', err);
    }
}

// Room.players es la fuente de las puntuaciones de los jugadores durante el juego
// Aquí los datos se traducen al playerSchema para ingresar los datos a mongho
function buildMatchPlayersFromRoom(room: LiveRoom) {
    return Array.from(room.players.values()).map((player) => ({
        user: player.userId,
        guestName: player.guestName,
        score: player.score,
        correctAnswers: player.correctAnswers,
    }));
}
