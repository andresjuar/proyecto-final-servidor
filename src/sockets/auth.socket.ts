import type { Socket } from 'socket.io';
import { verificarTokenJWT } from '../utils/jwt';
import { User } from '../models/user.model';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '../types/match.types';

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, SocketData>;

/*
Middleware para autenticar el handshake en el namespace de partidas.

- Si llega un JWT válido, se busca el usuario en Mongo (id, email, displayName)
  y se guarda en socket.data. Puede ser host o jugador logueado.
- Si no hay token, se deja pasar como invitado (socket.data.user queda undefined).
  No se valida aquí porque todavía no sabemos si intentará unirse a una sala;
  eso se revisa en 'room:join'.
- Si hay token pero es inválido o expirado, se rechaza la conexión.

matchId, roomCode y role no se asignan aquí; se definen después en
room.handlers.ts cuando ya se conoce la sala.
*/
export async function socketAuthMiddleware(socket: GameSocket, next: (err?: Error) => void): Promise<void> {
    const token = extractToken(socket);

    if (!token) {
        // Conexión sin token: se trata como posible invitado hasta que intente unirse a una sala.
        next();
        return;
    }

    try {
        const payload = verificarTokenJWT(token);

        const user = await User.findById(payload.id).select('email displayName').lean();
        if (!user) {
            next(new Error('Usuario no encontrado o token inválido'));
            return;
        }

        socket.data.user = { id: payload.id, email: user.email };
        socket.data.displayName = user.displayName;

        next();
    } catch {
        next(new Error('Token inválido o expirado'));
    }
}

function extractToken(socket: GameSocket): string | undefined {
    // Convención recomendada por Socket.io: mandar el token en handshake.auth, no en headers.
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
        return authToken;
    }

    // Fallback por si el cliente prefiere mandarlo como header Authorization: Bearer <token>
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        return header.slice('Bearer '.length);
    }

    return undefined;
}
