import type { IQuestion } from '../models/quiz.model';
import type { RoomState, PublicPlayer, LeaderboardEntry } from '../types/match.types';

/*
Estado en vivo de las partidas en memoria (no en Mongo).
`Match` en Mongo sigue siendo la fuente de verdad (host, roomCode,
status, score final). Aquí solo va lo temporal: pregunta actual,
timers, quién ya respondió, etc., cosas que no pasa nada si se pierden
al reiniciar el servidor.

Nota sobre reconexión/late-join: los jugadores no se identifican por
socketId (cambia al reconectar), sino por un identityKey basado en
userId o guestName. Así, si alguien vuelve, lo tratamos como la misma
persona y conserva su score en lugar de duplicarse.
*/

export const PLAYER_GRACE_MS = 30_000; // tiempo de gracia para que un jugador se reconecte
export const HOST_GRACE_MS = 5_000; // tiempo de gracia para que el host se reconecte

export interface LivePlayer {
    identityKey: string; // `user:<userId>` o `guest:<guestName-normalizado>`
    socketId: string; // socket ACTUAL; cambia si la persona se reconecta
    userId?: string;
    guestName?: string;
    displayName: string;
    score: number;
    correctAnswers: number;
    isConnected: boolean;
    hasAnsweredCurrent: boolean;
    lastAnswerIndex?: number;
    lastAnswerCorrect?: boolean;
    lastPoints?: number;
    answeredAt?: number; // Date.now() en ms, para calcular puntaje por velocidad de respuesta
    disconnectTimer?: NodeJS.Timeout;
}

export interface LiveRoom {
    matchId: string;
    quizId: string;
    roomCode: string;
    hostUserId: string; // identidad estable del host (no cambia aunque cambie de socket)
    hostSocketId: string | null; // null mientras el host está dentro de su periodo de gracia
    hostDisconnectTimer?: NodeJS.Timeout;
    state: RoomState;
    questions: IQuestion[]; // copia cargada una sola vez de Mongo al crear la sala
    currentQuestionIndex: number; // -1 antes de que arranque la primera pregunta
    questionStartedAt: number | null; // Date.now() en ms de cuándo arrancó la pregunta actual
    questionTimer?: NodeJS.Timeout; // dispara el auto-reveal cuando se acaba el tiempo
    tickInterval?: NodeJS.Timeout; // emite game:timer_tick cada segundo
    players: Map<string, LivePlayer>; // key = identityKey
}

// Almacenamiento principal: roomCode -> LiveRoom

const rooms = new Map<string, LiveRoom>();

// Índice auxiliar socketId -> roomCode, para ubicar la sala rápido en el evento nativo
// 'disconnect' de socket.io, donde solo tenemos el socket (no el roomCode a la mano).

const socketToRoom = new Map<string, string>();

// Identidad

/** Guests se normalizan (trim + lowercase) para que "Ana" y "ana " sean la misma identidad. */
export function buildIdentityKey(userId?: string, guestName?: string): string {
    if (userId) return `user:${userId}`;
    if (guestName) return `guest:${guestName.trim().toLowerCase()}`;
    throw new Error('Se requiere userId o guestName para construir la identidad de un jugador');
}

// CRUD de salas

export function createRoom(params: {
    matchId: string;
    quizId: string;
    roomCode: string;
    hostUserId: string;
    questions: IQuestion[];
}): LiveRoom {
    const room: LiveRoom = {
        matchId: params.matchId,
        quizId: params.quizId,
        roomCode: params.roomCode.toUpperCase(),
        hostUserId: params.hostUserId,
        hostSocketId: null, // el host se "conecta" aparte con markHostReconnected, sea la primera vez o no;
        // puede pasar que un jugador se una antes de que el host abra su socket.
        state: 'lobby',
        questions: params.questions,
        currentQuestionIndex: -1,
        questionStartedAt: null,
        players: new Map(),
    };
    rooms.set(room.roomCode, room);
    return room;
}

export function getRoom(roomCode: string): LiveRoom | undefined {
    return rooms.get(roomCode.toUpperCase());
}

export function hasRoom(roomCode: string): boolean {
    return rooms.has(roomCode.toUpperCase());
}

export function deleteRoom(roomCode: string): void {
    const room = rooms.get(roomCode.toUpperCase());
    if (!room) return;

    if (room.questionTimer) clearTimeout(room.questionTimer);
    if (room.tickInterval) clearInterval(room.tickInterval);
    if (room.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
    for (const player of room.players.values()) {
        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        socketToRoom.delete(player.socketId);
    }
    if (room.hostSocketId) socketToRoom.delete(room.hostSocketId);

    rooms.delete(room.roomCode);
}

// Índice socketId -> roomCode

export function getRoomCodeBySocket(socketId: string): string | undefined {
    return socketToRoom.get(socketId);
}

export function untrackSocket(socketId: string): void {
    socketToRoom.delete(socketId);
}

// Jugadores: join / late-join / reconexión, todo unificado en un solo punto de entrada

export interface UpsertPlayerResult {
    player: LivePlayer;
    isNew: boolean; // nunca había estado en esta sala (join normal o late join)
    isReconnect: boolean; // ya existía; solo volvió con un socket distinto
}

export function upsertPlayer(
    room: LiveRoom,
    params: { socketId: string; userId?: string; guestName?: string; displayName: string },
): UpsertPlayerResult {
    const identityKey = buildIdentityKey(params.userId, params.guestName);
    const existing = room.players.get(identityKey);

    if (existing) {
        // Reconexión: cancelamos su periodo de gracia si seguía corriendo, y adoptamos su socket nuevo.
        // OJO: no se toca hasAnsweredCurrent/score/etc. — ese progreso se conserva tal cual.
        if (existing.disconnectTimer) {
            clearTimeout(existing.disconnectTimer);
            existing.disconnectTimer = undefined;
        }
        socketToRoom.delete(existing.socketId);
        existing.socketId = params.socketId;
        existing.isConnected = true;
        socketToRoom.set(params.socketId, room.roomCode);
        return { player: existing, isNew: false, isReconnect: true };
    }

    const player: LivePlayer = {
        identityKey,
        socketId: params.socketId,
        userId: params.userId,
        guestName: params.guestName,
        displayName: params.displayName,
        score: 0,
        correctAnswers: 0,
        isConnected: true,
        hasAnsweredCurrent: false,
    };
    room.players.set(identityKey, player);
    socketToRoom.set(params.socketId, room.roomCode);
    return { player, isNew: true, isReconnect: false };
}

export function getPlayerBySocket(room: LiveRoom, socketId: string): LivePlayer | undefined {
    for (const player of room.players.values()) {
        if (player.socketId === socketId) return player;
    }
    return undefined;
}

/*
 Marca a un jugador como desconectado y arranca su periodo de gracia (PLAYER_GRACE_MS).
 Si nadie lo reconecta antes de que se cumpla, se elimina definitivamente y se llama a onExpire
 (el handler usa ese callback para avisarle al resto de la sala con 'room:player_left').
 */
export function markPlayerDisconnected(
    room: LiveRoom,
    socketId: string,
    onExpire: (player: LivePlayer) => void,
): LivePlayer | undefined {
    const player = getPlayerBySocket(room, socketId);
    if (!player) return undefined;

    player.isConnected = false;
    player.disconnectTimer = setTimeout(() => {
        // Si para cuando se cumple el timer NO se reconectó (una reconexión ya habría puesto
        // isConnected en true y limpiado este timer), se elimina definitivamente.
        if (!player.isConnected) {
            room.players.delete(player.identityKey);
            socketToRoom.delete(socketId);
            onExpire(player);
        }
    }, PLAYER_GRACE_MS);

    return player;
}

/* Elimina a un jugador de inmediato, sin periodo de gracia (ej. 'room:leave'). */
export function removePlayer(room: LiveRoom, identityKey: string): LivePlayer | undefined {
    const player = room.players.get(identityKey);
    if (!player) return undefined;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    socketToRoom.delete(player.socketId);
    room.players.delete(identityKey);
    return player;
}

// Host: mismo patrón de gracia, pero si no vuelve, se destruye la sala completa (no se
// "elimina" a un jugador, es la sala entera la que deja de tener sentido sin su host).

/* 
    Nota para Andrés del futuro:
    TODO: Hacer que en lugar de eliminar la sala directamente, si un host no se reconecta después de un periodo de gracia, 
    ver la posibilidad de pasar el título de host a el siguiente jugador que si esté con sesión iniciada
    y si no que sí se elimine el room

    Aunque esto puede no funcionar si el siguiente juggador está jugando desde un celular o pantalla pequeña, se tiene que pensar
    en una UI para esto
*/

export function markHostDisconnected(room: LiveRoom, onExpire: () => void): void {
    const previousSocketId = room.hostSocketId;
    room.hostSocketId = null;
    if (previousSocketId) socketToRoom.delete(previousSocketId);

    room.hostDisconnectTimer = setTimeout(() => {
        if (room.hostSocketId === null) {
            onExpire();
        }
    }, HOST_GRACE_MS);
}

export function markHostReconnected(room: LiveRoom, socketId: string): void {
    if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = undefined;
    }
    room.hostSocketId = socketId;
    socketToRoom.set(socketId, room.roomCode);
}

// Serialización a los shapes públicos definidos en types.ts

export function toPublicPlayer(player: LivePlayer): PublicPlayer {
    return {
        socketId: player.socketId,
        userId: player.userId,
        displayName: player.displayName,
        score: player.score,
        isConnected: player.isConnected,
    };
}

export function listPublicPlayers(room: LiveRoom): PublicPlayer[] {
    return Array.from(room.players.values()).map(toPublicPlayer);
}

export function buildLeaderboard(room: LiveRoom): LeaderboardEntry[] {
    const sorted = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
    return sorted.map((player, index) => ({
        ...toPublicPlayer(player),
        rank: index + 1,
        lastPoints: player.lastPoints ?? 0,
        lastAnswerCorrect: player.lastAnswerCorrect ?? false,
    }));
}

// Helpers de ronda (se usan al arrancar/cerrar cada pregunta desde game.engine.ts)

/** Limpia las banderas de respuesta de todos los jugadores antes de arrancar una nueva pregunta. */
export function resetAnswersForNewQuestion(room: LiveRoom): void {
    for (const player of room.players.values()) {
        player.hasAnsweredCurrent = false;
        player.lastAnswerIndex = undefined;
        player.lastAnswerCorrect = undefined;
        player.lastPoints = undefined;
        player.answeredAt = undefined;
    }
}

export function countAnswered(room: LiveRoom): number {
    let count = 0;
    for (const player of room.players.values()) {
        if (player.hasAnsweredCurrent) count++;
    }
    return count;
}

export function countConnectedPlayers(room: LiveRoom): number {
    let count = 0;
    for (const player of room.players.values()) {
        if (player.isConnected) count++;
    }
    return count;
}
