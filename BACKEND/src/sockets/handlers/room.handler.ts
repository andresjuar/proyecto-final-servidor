import { Match } from '../../models/match.model';
import { Quiz, IQuestion } from '../../models/quiz.model';
import { GameSocket } from '../auth.socket';
import { GameNamespace, playersRoomName, buildSyncData } from '../game.engine';
import {
    LiveRoom,
    PLAYER_GRACE_MS,
    createRoom,
    getRoom,
    deleteRoom,
    getRoomCodeBySocket,
    upsertPlayer,
    getPlayerBySocket,
    markPlayerDisconnected,
    markHostDisconnected,
    markHostReconnected,
    toPublicPlayer,
    listPublicPlayers,
} from '../roomState';
import {
    RoomJoinPayload,
    RoomJoinedOkPayload,
    RoomPlayerJoinedPayload,
    RoomPlayerLeftPayload,
    RoomPlayerDisconnectedPayload,
    ErrorPayload,
} from '../../types/match.types';

/*  Este archivo se trata de todo lo que no es lógica de juego en sí:
    - Entrar a la sala, ya sea por primera vez, tarde o reconectándose
    - Salir de la sala
    - Manejar casos de desconexión

    Este archivo si usa directamente mongo para guardar las partidad una vez finalizadas
    No cada vez que se modifica el match.player por ejemplo.
    
*/

export function registerRoomHandlers(io: GameNamespace, socket: GameSocket): void {
    socket.on('room:join', (payload) => {
        void handleRoomJoin(io, socket, payload);
    });

    socket.on('room:leave', () => {
        void handleRoomLeave(io, socket);
    });

    socket.on('disconnect', () => {
        void handleDisconnect(io, socket);
    });
}

// room:join — cubre join normal, late-join, y reconexión en un solo flujo

async function handleRoomJoin(io: GameNamespace, socket: GameSocket, payload: RoomJoinPayload): Promise<void> {
    const roomCode = payload?.roomCode?.trim().toUpperCase();
    if (!roomCode) {
        emitError(socket, 'ROOM_NOT_FOUND', 'Debes indicar un código de sala.');
        return;
    }

    let room = getRoom(roomCode);
    if (!room) {
        const hydrated = await getRoomFromDB(roomCode);
        if (!hydrated.ok) {
            emitError(socket, hydrated.code, hydrated.message);
            return;
        }
        room = hydrated.room;
    }

    const isHost = Boolean(socket.data.user) && socket.data.user!.id === room.hostUserId;

    // Resolver identidad: logueado (host o jugador) vs invitado
    let userId: string | undefined;
    let guestName: string | undefined;
    let displayName: string;

    if (socket.data.user) {
        userId = socket.data.user.id;
        displayName = socket.data.displayName?.trim() || socket.data.user.email;
    } else {
        const name = payload.guestName?.trim();
        if (!name || name.length < 2 || name.length > 30) {
            emitError(socket, 'UNKNOWN', 'Indica un nombre de invitado de entre 2 y 30 caracteres.');
            return;
        }
        guestName = name;
        displayName = name;
    }

    socket.join(room.roomCode);
    socket.data.matchId = room.matchId;
    socket.data.roomCode = room.roomCode;
    socket.data.role = isHost ? 'host' : 'player';
    if (guestName) socket.data.guestName = guestName;

    if (isHost) {
        markHostReconnected(room, socket.id);

        const ok: RoomJoinedOkPayload = {
            roomCode: room.roomCode,
            role: 'host',
            displayName,
            score: 0,
            isReconnect: false,
            isLateJoin: false,
            players: listPublicPlayers(room),
            sync: buildSyncData(room),
        };
        socket.emit('room:joined_ok', ok);
        return;
    }

    // Jugador (logueado o invitado): late-join y reconexión se resuelven en upsertPlayer
    socket.join(playersRoomName(room.roomCode));

    const wasAlreadyInProgress = room.state !== 'lobby';
    const { player, isNew, isReconnect } = upsertPlayer(room, {
        socketId: socket.id,
        userId,
        guestName,
        displayName,
    });

    const ok: RoomJoinedOkPayload = {
        roomCode: room.roomCode,
        role: 'player',
        displayName: player.displayName,
        score: player.score,
        isReconnect,
        isLateJoin: isNew && wasAlreadyInProgress,
        players: listPublicPlayers(room),
        sync: buildSyncData(room, player),
    };
    socket.emit('room:joined_ok', ok);

    // Avisar al resto de la sala (host + demás jugadores), sin duplicar hacia quien se acaba de unir
    const joinedPayload: RoomPlayerJoinedPayload = {
        players: listPublicPlayers(room),
        joined: toPublicPlayer(player),
        reconnected: isReconnect,
    };
    socket.to(room.roomCode).emit('room:player_joined', joinedPayload);
}

//Obtiene la match desde mongo, ya sea que tenga un quiz asignado o no, y crea la sala en memoria
async function getRoomFromDB(
    roomCode: string,
): Promise<{ ok: true; room: LiveRoom } | { ok: false; code: ErrorPayload['code']; message: string }> {
    // Puede haber mas de una match con el mismo código ya que se puede reusar una sala, entonces se toma
    // la match que esté activa, o en caso de no haber uno activo se devuelve el room finished
    const match =
        (await Match.findOne({ roomCode, status: { $in: ['waiting', 'in_progress'] } })) ??
        (await Match.findOne({ roomCode }).sort({ createdAt: -1 }));
    if (!match) {
        return { ok: false, code: 'ROOM_NOT_FOUND', message: 'No existe ninguna partida con ese código.' };
    }
    if (match.status === 'finished') {
        return { ok: false, code: 'ROOM_FINISHED', message: 'Esa partida ya terminó.' };
    }
    if (match.status === 'cancelled') {
        return { ok: false, code: 'ROOM_CANCELLED', message: 'Esa partida fue cancelada.' };
    }

    let questions: IQuestion[] = [];
    let quizId = '';
    if (match.quiz) {
        const quiz = await Quiz.findById(match.quiz).lean();

        if (quiz) {
            questions = quiz.questions;
            quizId = quiz._id.toString();
        }
    }

    const room = createRoom({
        matchId: match._id.toString(),
        quizId,
        roomCode: match.roomCode,
        hostUserId: match.host.toString(),
        questions,
    });

    if (match.status === 'in_progress') {
        room.state = 'loading';
    }

    return { ok: true, room };
}

// room:leave — salida explícita, no accidental
async function handleRoomLeave(io: GameNamespace, socket: GameSocket): Promise<void> {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const room = getRoom(roomCode);
    leaveSocketRooms(socket, roomCode);
    clearSocketRoomData(socket);
    if (!room) return;

    if (socket.data.role === 'host') {
        io.to(room.roomCode).emit('error', {
            code: 'ROOM_CANCELLED',
            message: 'El host cerró la sala.',
        } satisfies ErrorPayload);
        await cancelMatchInDb(room.matchId);
        deleteRoom(room.roomCode);
        return;
    }

    const player = getPlayerBySocket(room, socket.id);
    if (!player) return;

    room.players.delete(player.identityKey);
    const left: RoomPlayerLeftPayload = {
        players: listPublicPlayers(room),
        left: { socketId: player.socketId, displayName: player.displayName },
    };
    io.to(room.roomCode).emit('room:player_left', left);
}

// disconnect: permite manejar desconexiones en caso de pérdida de conexión o de refresh a la página
// se le da un periodo de gracia
async function handleDisconnect(io: GameNamespace, socket: GameSocket): Promise<void> {
    const roomCode = socket.data.roomCode ?? getRoomCodeBySocket(socket.id);
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room) return;

    if (socket.data.role === 'host' || room.hostSocketId === socket.id) {
        markHostDisconnected(room, () => {
            io.to(room.roomCode).emit('error', {
                code: 'ROOM_CANCELLED',
                message: 'El host se desconectó y no volvió a tiempo. La partida fue cancelada.',
            });
            void cancelMatchInDb(room.matchId);
            deleteRoom(room.roomCode);
        });
        return;
    }

    const disconnectedPlayer = markPlayerDisconnected(room, socket.id, (expiredPlayer) => {
        const left: RoomPlayerLeftPayload = {
            players: listPublicPlayers(room),
            left: { socketId: expiredPlayer.socketId, displayName: expiredPlayer.displayName },
        };
        io.to(room.roomCode).emit('room:player_left', left);
    });

    if (disconnectedPlayer) {
        const payload: RoomPlayerDisconnectedPayload = {
            players: listPublicPlayers(room),
            disconnected: {
                socketId: disconnectedPlayer.socketId,
                displayName: disconnectedPlayer.displayName,
            },
            graceSeconds: PLAYER_GRACE_MS / 1000,
        };
        io.to(room.roomCode).emit('room:player_disconnected', payload);
    }
}

function emitError(socket: GameSocket, code: ErrorPayload['code'], message: string): void {
    socket.emit('error', { code, message });
}

function leaveSocketRooms(socket: GameSocket, roomCode: string): void {
    socket.leave(roomCode);
    socket.leave(playersRoomName(roomCode));
}

function clearSocketRoomData(socket: GameSocket): void {
    socket.data.matchId = undefined;
    socket.data.roomCode = undefined;
    socket.data.role = undefined;
    socket.data.guestName = undefined;
}

async function cancelMatchInDb(matchId: string): Promise<void> {
    try {
        await Match.updateOne(
            { _id: matchId, status: { $in: ['waiting', 'in_progress'] } },
            { $set: { status: 'cancelled' } },
        );
    } catch (err) {
        console.error('No se pudo marcar la partida como cancelada:', err);
    }
}
