import { Types } from 'mongoose';
import { Match } from '../match.model';

/**
 * Pruebas básicas del modelo Match usando validateSync(), que corre las
 * validaciones del schema SIN necesitar conexión a MongoDB.
 */

const datosValidos = {
    host: new Types.ObjectId(),
    roomCode: 'abcd',
};

describe('Match model', () => {
    it('acepta un match con datos válidos', () => {
        const match = new Match(datosValidos);
        const error = match.validateSync();
        expect(error).toBeUndefined();
    });

    it('requiere el host', () => {
        const match = new Match({ roomCode: 'ABCD' });
        const error = match.validateSync();
        expect(error?.errors.host).toBeDefined();
    });

    it('requiere el roomCode', () => {
        const match = new Match({ host: new Types.ObjectId() });
        const error = match.validateSync();
        expect(error?.errors.roomCode).toBeDefined();
    });

    it('guarda el roomCode en mayúsculas', () => {
        const match = new Match(datosValidos);
        expect(match.roomCode).toBe('ABCD');
    });

    it('inicia con status "waiting" y sin jugadores', () => {
        const match = new Match(datosValidos);
        expect(match.status).toBe('waiting');
        expect(match.players).toEqual([]);
    });

    it('requiere guestName cuando el jugador NO tiene usuario asociado', () => {
        const match = new Match({
            ...datosValidos,
            players: [{ score: 0 }],
        });
        const error = match.validateSync();
        expect(error?.errors['players.0.guestName']).toBeDefined();
    });

    it('NO requiere guestName cuando el jugador tiene usuario asociado', () => {
        const match = new Match({
            ...datosValidos,
            players: [{ user: new Types.ObjectId() }],
        });
        const error = match.validateSync();
        expect(error).toBeUndefined();
    });
});
