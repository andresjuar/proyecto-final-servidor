// home.js — lógica de la pantalla de inicio

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-start-game').addEventListener('click', onStartGameClick);
    document.getElementById('btn-join-game').addEventListener('click', onJoinGameClick);
    document.getElementById('btn-explore').addEventListener('click', () => {
        window.location.href = 'explore.html';
    });

    document.getElementById('join-modal-close').addEventListener('click', closeJoinModal);
    document.getElementById('join-modal').addEventListener('click', (e) => {
        if (e.target.id === 'join-modal') closeJoinModal();
    });
    document.getElementById('join-form').addEventListener('submit', onJoinFormSubmit);
});

function onStartGameClick() {
    if (currentUser) {
        void createMatchAndGoToRoom();
    } else {
        // Se abre el modal CON una acción pendiente: al loguearse, se sigue
        // el flujo original (crear partida + ir a la sala) en vez de solo cerrar.
        openAuthModal('login', createMatchAndGoToRoom);
    }
}

async function createMatchAndGoToRoom() {
    try {
        const match = await api.post('/matches', {}, { auth: true });
        localStorage.setItem(`rq_matchid_${match.roomCode}`, match._id);
        window.location.href = `room.html?code=${match.roomCode}&role=host`;
    } catch (err) {
        showErrorToast(err);
    }
}

function onJoinGameClick() {
    const guestField = document.getElementById('join-guest-field');
    guestField.classList.toggle('hidden', Boolean(currentUser));
    document.getElementById('join-error').classList.add('hidden');
    document.getElementById('join-form').reset();
    document.getElementById('join-modal').classList.remove('hidden');
}

function closeJoinModal() {
    document.getElementById('join-modal').classList.add('hidden');
}

async function onJoinFormSubmit(e) {
    e.preventDefault();
    const errorBox = document.getElementById('join-error');
    errorBox.classList.add('hidden');

    const code = document.getElementById('join-code').value.trim().toUpperCase();
    const guestName = document.getElementById('join-guest-name').value.trim();

    if (!code) return;

    if (!currentUser && (!guestName || guestName.length < 2 || guestName.length > 30)) {
        errorBox.textContent = 'Indica un nombre de invitado de entre 2 y 30 caracteres.';
        errorBox.classList.remove('hidden');
        return;
    }

    try {
        const status = await api.get(`/matches/rooms/${code}/exists`);
        if (!status.exists) {
            errorBox.textContent = 'No existe ninguna partida activa con ese código.';
            errorBox.classList.remove('hidden');
            return;
        }

        if (!currentUser) {
            localStorage.setItem(`rq_guest_${code}`, guestName);
        }

        window.location.href = `room.html?code=${code}&role=player`;
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    }
}
