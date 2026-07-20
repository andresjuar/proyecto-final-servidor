import { AuthUser } from '../types/express';

/**
 *
 * Tipos específicos para archivos que usen websockest, específicamente los que tengan que ver
 * con comunicación sobre el sistema de juegos
 *
 * */

export type RoomState = 'lobby' | 'loading' | 'question' | 'reveal' | 'leaderboard' | 'finished';

/**
 * Info que se guarda en socket.data.
 *
 * Se llena en dos momentos distintos:
 *   1. auth.socket.ts al conectarse en auth.socket.ts: se crea a partir de user y DisplayName si el handshake
 *      tiene un JWT válido. Si no tiene un token, ambos quedan undefined.
 *   2. Con room.handlers.ts al ejecutarse 'room:join': a pebas en ese momento se sabe a qué sala se
 *      quiere entrar, así que matchID, roomCode, role y gestName si es un guest se llenan, no antes.
 *
 * El host SIEMPRE debe tener user (no se permite crear/controlar partidas como guest).
 */
export interface SocketData {
    user?: AuthUser;
    displayName?: string;
    guestName?: string;
    matchId?: string;
    roomCode?: string;
    role?: 'host' | 'player';
}

export interface PublicPlayer {
    socketId: string;
    userId?: string;
    displayName: string;
    score: number;
    isConnected: boolean;
}

export interface LeaderboardEntry extends PublicPlayer {
    rank: number;
    lastPoints: number;
    lastAnswerCorrect: boolean;
}

// Tipos de preguntas que se envían desde el servidor al cliente

// Pregunta al jugador sin índice correcto de respuesta
export interface PublicQuestionPayload {
    questionIndex: number;
    totalQuestions: number;
    question: string;
    imageUrl?: string;
    options: string[];
    timeLimitSeconds: number;
}

// Lo que ve el host con el índice correcto
export interface HostQuestionPayload extends PublicQuestionPayload {
    correctIndex: number;
}

// Sincronización de estado (late join / reconexión)

/* 
    Estado de la sala actual que se utiliza cuando un jugador se reconecta o se une de manera tardía
    Esto permite que el cliente del jugador pueda mostrar en la UI lo que corresponda y no tenga que esperar
    a que ocurra el siguiente evento normal.
*/

export type RoomSyncData =
    | { state: 'lobby' }
    | { state: 'loading' }
    | {
          state: 'question';
          question: PublicQuestionPayload;
          secondsLeft: number;
          alreadyAnswered: boolean; // evita que se le vuelva a mostrar el input de respuesta
      }
    | {
          state: 'reveal';
          revealed: GameAnswerRevealedPayload;
      }
    | {
          state: 'leaderboard';
          leaderboard: LeaderboardEntry[];
      }
    | {
          state: 'finished';
          result: GameOverPayload;
      };

// Payloads: Cliente -> Servidor

/**
 * Se usa tanto para unirse por primera vez como para reconectarse o entrar tarde.
 * El servidor decide cuál es cuál comparando identidad (userId si hay JWT, o
 * guestName + roomCode si es invitado) contra los jugadores ya registrados en la sala:
 *   - Identidad nueva + sala en 'lobby'        -> join normal
 *   - Identidad nueva + sala ya iniciada        -> late join (entra como espectador
 *                                                  hasta la siguiente pregunta)
 *   - Identidad ya existente en la sala         -> reconexión (recupera su score y,
 *                                                  si aplica, su progreso en la pregunta activa)
 */
export interface RoomJoinPayload {
    roomCode: string;
    //Si no se obtiene nombre del jwt, pq no hay uno, este campo es obligatorio
    guestName?: string;
}

export interface GameSubmitAnswerPayload {
    questionIndex: number; // para que solo se acepten respuestas de la pregunta actual si es que se llegan a desincronizar los clientes
    answerIndex: number;
}

// Payloads: Servidor -> Cliente

export interface RoomJoinedOkPayload {
    roomCode: string;
    role: 'host' | 'player';
    displayName: string;
    score: number;
    isReconnect: boolean;
    isLateJoin: boolean;
    players: PublicPlayer[];
    sync: RoomSyncData;
}

export interface RoomPlayerJoinedPayload {
    players: PublicPlayer[];
    joined: PublicPlayer;
    reconnected: boolean;
}

// Este payload es emitido cuando un jugador se desconecta pero, por arquitectura, tiene 30 segundos de gracia para conectarse, en este
// momento tiene isConnected:false, una vez que pasa ese tiempo, se emite el payload de RoomPlayerLeft
export interface RoomPlayerDisconnectedPayload {
    players: PublicPlayer[];
    disconnected: { socketId: string; displayName: string };
    graceSeconds: number; // cuánto tiempo tiene para reconectarse antes de ser expulsado
}

export interface RoomPlayerLeftPayload {
    players: PublicPlayer[];
    left: { socketId: string; displayName: string };
}

export interface GameLoadingPayload {
    message: string;
}

export interface GameReadyPayload {
    totalQuestions: number;
}

export interface GameTimerTickPayload {
    questionIndex: number;
    secondsLeft: number;
}

export interface GameAnswerReceivedPayload {
    received: true;
}

export interface GameAnswerCountPayload {
    answeredCount: number;
    totalPlayers: number;
}

export interface GameAnswerRevealedPayload {
    questionIndex: number;
    correctIndex: number;
    correctText: string;
}

export interface GameLeaderboardPayload {
    leaderboard: LeaderboardEntry[];
    isFinalRound: boolean;
}

export interface GameOverPayload {
    winner: {
        socketId: string;
        displayName: string;
        score: number;
    };
    leaderboard: LeaderboardEntry[];
}

// Para reiniciar el juego una vez que termina una partida, se resetean los puntajes de los jugadores y se crea una nueva match en mongo
export interface GamePlayAgainOkPayload {
    matchId: string;
    players: PublicPlayer[];
}

export interface ErrorPayload {
    message: string;
    code:
        | 'ROOM_NOT_FOUND'
        | 'ROOM_IN_PROGRESS'
        | 'ROOM_FULL'
        | 'ROOM_FINISHED'
        | 'ROOM_CANCELLED'
        | 'NOT_HOST'
        | 'INVALID_STATE'
        | 'ALREADY_ANSWERED'
        | 'UNKNOWN';
}

// Interfaces tipadas para socket.io (Server<C2S, S2C, ...>)

// eventos que el cliente puede emitir hacia el servidor

export interface ClientToServerEvents {
    'room:join': (payload: RoomJoinPayload) => void;
    'room:leave': () => void;

    'game:start': () => void;
    'game:next_question': () => void;
    'game:submit_answer': (payload: GameSubmitAnswerPayload) => void;
    'game:reveal_answer': () => void;
    'game:play_again': () => void;
}

// eventos del servidor al cliente
export interface ServerToClientEvents {
    'room:joined_ok': (payload: RoomJoinedOkPayload) => void;
    'room:player_joined': (payload: RoomPlayerJoinedPayload) => void;
    'room:player_disconnected': (payload: RoomPlayerDisconnectedPayload) => void;
    'room:player_left': (payload: RoomPlayerLeftPayload) => void;

    'game:loading': (payload: GameLoadingPayload) => void;
    'game:ready': (payload: GameReadyPayload) => void;
    'game:question': (payload: PublicQuestionPayload | HostQuestionPayload) => void;
    'game:timer_tick': (payload: GameTimerTickPayload) => void;
    'game:answer_received': (payload: GameAnswerReceivedPayload) => void;
    'game:answer_count': (payload: GameAnswerCountPayload) => void;
    'game:answer_revealed': (payload: GameAnswerRevealedPayload) => void;
    'game:leaderboard': (payload: GameLeaderboardPayload) => void;
    'game:over': (payload: GameOverPayload) => void;
    'game:play_again_ok': (payload: GamePlayAgainOkPayload) => void;

    error: (payload: ErrorPayload) => void;
}
