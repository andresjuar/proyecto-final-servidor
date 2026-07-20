import type { IQuestion } from '../../models/quiz.model';
import {
    startGame,
    nextQuestion,
    submitAnswer,
    forceRevealAnswer,
    playAgain,
    buildSyncData,
    calculatePoints,
    type GameNamespace,
    type GameEngineHooks,
} from '../game.engine';
import { createRoom, markHostReconnected, upsertPlayer, type LiveRoom } from '../roomState';

/**
 * Estos tests corren la máquina de estados completa (lobby -> question -> reveal ->
 * leaderboard -> question -> ... -> finished) SIN necesitar Mongo real ni un
 * servidor de Socket.io levantado: `io` se reemplaza por un mock que solo registra
 * qué se hubiera emitido, y los timers se controlan con jest.useFakeTimers().
 *
 * Sirve como evidencia de que game.engine.ts funciona de punta a punta antes de
 * probarlo con el frontend real.
 */

const sampleQuestions: IQuestion[] = [
    { question: '¿Cuánto es 2 + 2?', options: ['3', '4', '5', '6'], correctIndex: 1, timeLimitSeconds: 10 },
    {
        question: '¿Capital de Francia?',
        options: ['Madrid', 'París', 'Roma', 'Berlín'],
        correctIndex: 1,
        timeLimitSeconds: 10,
    },
];

interface EmittedEvent {
    room: string;
    event: string;
    payload: unknown;
}

function createMockIo(): { io: GameNamespace; emitted: EmittedEvent[] } {
    const emitted: EmittedEvent[] = [];
    const io = {
        to: (room: string) => ({
            emit: (event: string, payload?: unknown) => {
                emitted.push({ room, event, payload });
            },
        }),
    } as unknown as GameNamespace;
    return { io, emitted };
}

function buildTestRoom(): LiveRoom {
    const room = createRoom({
        matchId: 'match-1',
        quizId: 'quiz-1',
        roomCode: 'ABCD',
        hostUserId: 'host-1',
        questions: sampleQuestions,
    });
    markHostReconnected(room, 'host-socket-1');
    return room;
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('calculatePoints', () => {
    it('da el máximo si contesta con todo el tiempo restante', () => {
        expect(calculatePoints(10, 10)).toBe(1000);
    });

    it('da el mínimo si contesta en el último segundo', () => {
        expect(calculatePoints(0, 10)).toBe(100);
    });

    it('escala linealmente entre el mínimo y el máximo', () => {
        expect(calculatePoints(5, 10)).toBe(550);
    });
});

describe('startGame', () => {
    it('rechaza iniciar sin jugadores conectados', async () => {
        const room = buildTestRoom();
        const { io } = createMockIo();

        const result = await startGame(io, room);

        expect(result.ok).toBe(false);
        expect(room.state).toBe('lobby');
    });

    it('rechaza iniciar si la sala no tiene preguntas cargadas (sin quiz asignado todavía)', async () => {
        const room = createRoom({
            matchId: 'match-2',
            quizId: '',
            roomCode: 'NOQZ',
            hostUserId: 'host-2',
            questions: [], // como cuando se crea la sala antes de elegir/generar un quiz
        });
        markHostReconnected(room, 'host-socket-2');
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        const { io } = createMockIo();

        const result = await startGame(io, room);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.code).toBe('INVALID_STATE');
        expect(room.state).toBe('lobby');
    });

    it('pasa a loading, llama onMatchStarted, y emite game:ready', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'player-1', displayName: 'Ana' });
        const { io, emitted } = createMockIo();
        const onMatchStarted = jest.fn();
        const hooks: GameEngineHooks = { onMatchStarted };

        const result = await startGame(io, room, hooks);

        expect(result.ok).toBe(true);
        expect(onMatchStarted).toHaveBeenCalledTimes(1);
        expect(emitted.some((e) => e.event === 'game:ready')).toBe(true);
        expect(emitted.some((e) => e.event === 'game:loading')).toBe(true);
    });
});

describe('flujo completo de una partida', () => {
    it('recorre las 2 preguntas, calcula puntaje, y termina llamando onMatchFinished', async () => {
        const room = buildTestRoom();
        const ana = upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' }).player;
        const beto = upsertPlayer(room, { socketId: 'p2', userId: 'beto', displayName: 'Beto' }).player;

        const { io, emitted } = createMockIo();
        const onMatchFinished = jest.fn();

        // 1) Arrancar partida
        await startGame(io, room);
        expect(room.state).toBe('loading');

        // 2) Primera pregunta
        await nextQuestion(io, room, { onMatchFinished });
        expect(room.state).toBe('question');
        expect(room.currentQuestionIndex).toBe(0);

        const hostQuestionEvent = emitted.find((e) => e.event === 'game:question' && e.room === 'host-socket-1');
        expect(hostQuestionEvent).toBeDefined();
        expect((hostQuestionEvent!.payload as { correctIndex: number }).correctIndex).toBe(1);

        const playersQuestionEvent = emitted.find((e) => e.event === 'game:question' && e.room === 'ABCD::players');
        expect(playersQuestionEvent).toBeDefined();
        expect((playersQuestionEvent!.payload as { correctIndex?: number }).correctIndex).toBeUndefined();

        // 3) Ana contesta bien de inmediato, Beto contesta mal
        const anaResult = submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });
        expect(anaResult.ok).toBe(true);
        expect(ana.lastAnswerCorrect).toBe(true);
        expect(ana.lastPoints).toBe(1000); // contestó con los 10s completos disponibles (fake timers)

        const betoResult = submitAnswer(io, room, 'p2', { questionIndex: 0, answerIndex: 0 });
        expect(betoResult.ok).toBe(true);
        expect(beto.lastAnswerCorrect).toBe(false);
        expect(beto.lastPoints).toBe(0);

        // Al contestar todos, se revela automáticamente sin esperar el timer
        expect(room.state).toBe('reveal');
        expect(ana.score).toBe(1000);
        expect(beto.score).toBe(0);

        // 4) Tras el delay post-reveal, pasa a leaderboard
        jest.advanceTimersByTime(2100);
        expect(room.state).toBe('leaderboard');
        const leaderboardEvent = emitted.find((e) => e.event === 'game:leaderboard');
        expect(leaderboardEvent).toBeDefined();
        expect((leaderboardEvent!.payload as { isFinalRound: boolean }).isFinalRound).toBe(false);

        // 5) Segunda (última) pregunta
        await nextQuestion(io, room, { onMatchFinished });
        expect(room.currentQuestionIndex).toBe(1);
        expect(room.state).toBe('question');

        // Nadie contesta -> se acaba el timer solo (10s)
        jest.advanceTimersByTime(10_000);
        expect(room.state).toBe('reveal');

        jest.advanceTimersByTime(2100);
        expect(room.state).toBe('leaderboard');

        const finalLeaderboardEvent = [...emitted].reverse().find((e) => e.event === 'game:leaderboard');
        expect((finalLeaderboardEvent!.payload as { isFinalRound: boolean }).isFinalRound).toBe(true);

        // 6) Ya no quedan preguntas -> termina el juego
        await nextQuestion(io, room, { onMatchFinished });

        expect(room.state).toBe('finished');
        expect(onMatchFinished).toHaveBeenCalledTimes(1);

        const [finishedLeaderboard] = onMatchFinished.mock.calls[0] as [{ displayName: string; score: number }[]];
        expect(finishedLeaderboard[0].displayName).toBe('Ana'); // Ana ganó (1000 vs 0)

        const gameOverEvent = emitted.find((e) => e.event === 'game:over');
        expect(gameOverEvent).toBeDefined();
        expect((gameOverEvent!.payload as { winner: { displayName: string } }).winner.displayName).toBe('Ana');
    });
});

describe('forceRevealAnswer', () => {
    it('permite al host revelar antes de que se acabe el timer', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        const { io } = createMockIo();

        await startGame(io, room);
        await nextQuestion(io, room);
        expect(room.state).toBe('question');

        const result = forceRevealAnswer(io, room);

        expect(result.ok).toBe(true);
        expect(room.state).toBe('reveal');
    });

    it('rechaza revelar si no hay una pregunta activa', () => {
        const room = buildTestRoom();
        const { io } = createMockIo();

        const result = forceRevealAnswer(io, room);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.code).toBe('INVALID_STATE');
    });
});

describe('submitAnswer — casos inválidos', () => {
    it('rechaza responder dos veces la misma pregunta', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        upsertPlayer(room, { socketId: 'p2', userId: 'beto', displayName: 'Beto' }); // para que no auto-revele

        const { io } = createMockIo();
        await startGame(io, room);
        await nextQuestion(io, room);

        submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });
        const second = submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });

        expect(second.ok).toBe(false);
        expect(second.ok === false && second.code).toBe('ALREADY_ANSWERED');
    });

    it('rechaza respuestas de una pregunta que ya no está activa', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        const { io } = createMockIo();
        await startGame(io, room);
        await nextQuestion(io, room);

        const result = submitAnswer(io, room, 'p1', { questionIndex: 5, answerIndex: 1 });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.code).toBe('INVALID_STATE');
    });
});

describe('playAgain', () => {
    it('rechaza jugar de nuevo si la partida no ha terminado', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        const { io } = createMockIo();
        await startGame(io, room);

        const result = playAgain(io, room, 'match-nuevo');

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.code).toBe('INVALID_STATE');
    });

    it('resetea la sala a lobby manteniendo a los jugadores conectados, con score en 0', async () => {
        const room = buildTestRoom();
        const ana = upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' }).player;
        const { io, emitted } = createMockIo();

        // Jugar una partida completa hasta el final
        await startGame(io, room);
        await nextQuestion(io, room);
        submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });
        jest.advanceTimersByTime(2100);
        await nextQuestion(io, room); // termina el juego (solo había 1 pregunta relevante aquí, pero hay 2 en sampleQuestions)
        jest.advanceTimersByTime(10_000); // deja que se acabe el timer de la 2da pregunta
        jest.advanceTimersByTime(2100);
        await nextQuestion(io, room); // ya no quedan más -> finished

        expect(room.state).toBe('finished');
        expect(ana.score).toBeGreaterThan(0);

        const result = playAgain(io, room, 'match-nuevo');

        expect(result.ok).toBe(true);
        expect(room.state).toBe('lobby');
        expect(room.matchId).toBe('match-nuevo');
        expect(room.questions).toHaveLength(0);
        expect(room.currentQuestionIndex).toBe(-1);
        expect(ana.score).toBe(0);
        expect(ana.correctAnswers).toBe(0);
        // Sigue siendo la misma identidad/socket, no se desconectó a nadie
        expect(room.players.has(ana.identityKey)).toBe(true);

        const playAgainEvent = emitted.find((e) => e.event === 'game:play_again_ok');
        expect(playAgainEvent).toBeDefined();
        expect((playAgainEvent!.payload as { matchId: string }).matchId).toBe('match-nuevo');
    });
});

describe('buildSyncData — late-join y reconexión', () => {
    it('arma el sync correcto para alguien que se une a media pregunta y NO ha contestado', async () => {
        const room = buildTestRoom();
        const ana = upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' }).player;
        const { io } = createMockIo();
        await startGame(io, room);
        await nextQuestion(io, room);

        jest.advanceTimersByTime(3000); // avanza 3 de los 10 segundos

        const sync = buildSyncData(room, ana);

        expect(sync.state).toBe('question');
        if (sync.state === 'question') {
            expect(sync.alreadyAnswered).toBe(false);
            expect(sync.secondsLeft).toBeLessThanOrEqual(7);
            expect(sync.question.options).toContain('4');
            // La versión de sync para jugadores NUNCA debe traer el índice correcto
            expect((sync.question as { correctIndex?: number }).correctIndex).toBeUndefined();
        }
    });

    it('arma el sync marcando alreadyAnswered:true para quien se reconecta tras haber contestado', async () => {
        const room = buildTestRoom();
        const ana = upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' }).player;
        upsertPlayer(room, { socketId: 'p2', userId: 'beto', displayName: 'Beto' }); // evita auto-reveal
        const { io } = createMockIo();
        await startGame(io, room);
        await nextQuestion(io, room);

        submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });

        const sync = buildSyncData(room, ana);

        expect(sync.state).toBe('question');
        if (sync.state === 'question') {
            expect(sync.alreadyAnswered).toBe(true);
        }
    });

    it('arma el sync de leaderboard/finished sin necesitar el player', async () => {
        const room = buildTestRoom();
        upsertPlayer(room, { socketId: 'p1', userId: 'ana', displayName: 'Ana' });
        const { io } = createMockIo();
        await startGame(io, room);
        await nextQuestion(io, room);
        submitAnswer(io, room, 'p1', { questionIndex: 0, answerIndex: 1 });

        jest.advanceTimersByTime(2100);
        expect(room.state).toBe('leaderboard');

        const sync = buildSyncData(room);
        expect(sync.state).toBe('leaderboard');
    });
});
