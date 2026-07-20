// room.js — controlador de la pantalla de sala/partida.
// Maneja la máquina de estados completa reflejando game.engine.ts del backend:
// lobby -> loading -> question -> reveal -> leaderboard -> (question... | finished)

const ALL_SCREENS = [
    'screen-connecting',
    'screen-guest-gate',
    'screen-room-error',
    'screen-lobby-host',
    'screen-lobby-player',
    'screen-loading',
    'screen-question',
    'screen-reveal',
    'screen-leaderboard',
    'screen-finished',
];

let socket = null;
let roomCode = null;
let urlRole = null; // rol "de intención" leído de la URL, antes de conectar
let myRole = null; // rol AUTORITATIVO, confirmado por el servidor en room:joined_ok
let currentMatchId = null; // solo relevante para el host (llamadas REST de /matches)
let selectedQuizId = null; // id del quiz actualmente asignado a la partida (para resaltar la tarjeta)
let currentQuestion = null;
let ownAnswerIndex = null;
let lobbyTabsWired = false;
let exploreTabLoaded = false;

document.addEventListener('rq:auth-ready', () => {
    void bootstrapRoom();
});

async function bootstrapRoom() {
    const params = new URLSearchParams(window.location.search);
    roomCode = (params.get('code') || '').toUpperCase();
    urlRole = params.get('role');

    if (!roomCode || !urlRole) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('leave-room-btn').addEventListener('click', onLeaveRoomClick);

    if (urlRole === 'host') {
        if (!currentUser) {
            showErrorToast('Necesitas iniciar sesión para ser host.');
            window.location.href = 'index.html';
            return;
        }
        currentMatchId = localStorage.getItem(`rq_matchid_${roomCode}`);
        connectSocket();
        return;
    }

    // urlRole === 'player'
    if (currentUser) {
        connectSocket();
        return;
    }

    const storedGuestName = localStorage.getItem(`rq_guest_${roomCode}`);
    if (storedGuestName) {
        connectSocket(storedGuestName);
        return;
    }

    // No hay sesión ni nombre de invitado guardado (ej. se abrió el link directo):
    // se pide el nombre antes de conectar.
    showScreen('screen-guest-gate');
    document.getElementById('guest-gate-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('guest-gate-name').value.trim();
        if (name.length < 2 || name.length > 30) {
            const errorBox = document.getElementById('guest-gate-error');
            errorBox.textContent = 'El nombre debe tener entre 2 y 30 caracteres.';
            errorBox.classList.remove('hidden');
            return;
        }
        localStorage.setItem(`rq_guest_${roomCode}`, name);
        connectSocket(name);
    });
}

function connectSocket(guestName) {
    showScreen('screen-connecting');

    const auth = {};
    const token = getToken();
    if (token) auth.token = token;

    socket = io(SOCKET_URL + SOCKET_NAMESPACE, { auth });

    socket.on('connect', () => {
        socket.emit('room:join', { roomCode, guestName });
    });

    socket.on('connect_error', (err) => {
        showRoomError(err.message || 'No se pudo conectar al servidor de tiempo real.');
    });

    registerSocketListeners();
}

function registerSocketListeners() {
    socket.on('room:joined_ok', onRoomJoinedOk);
    socket.on('room:player_joined', (payload) => renderPlayerChips(payload.players));
    socket.on('room:player_disconnected', (payload) => renderPlayerChips(payload.players));
    socket.on('room:player_left', (payload) => renderPlayerChips(payload.players));

    socket.on('game:loading', onGameLoading);
    socket.on('game:ready', onGameReady);
    socket.on('game:question', onGameQuestion);
    socket.on('game:timer_tick', onTimerTick);
    socket.on('game:answer_count', onAnswerCount);
    socket.on('game:answer_revealed', onAnswerRevealed);
    socket.on('game:leaderboard', onLeaderboard);
    socket.on('game:over', onGameOver);
    socket.on('game:play_again_ok', onPlayAgainOk);

    socket.on('error', onSocketError);
}

function onRoomJoinedOk(payload) {
    myRole = payload.role;

    document.getElementById('room-code-display').textContent = payload.roomCode;
    document.getElementById('lobby-player-code').textContent = payload.roomCode;
    document.getElementById('room-topbar').style.display = 'flex';

    renderPlayerChips(payload.players);
    applySync(payload.sync);

    if (payload.isReconnect) showSuccessToast('Te reconectaste a la partida.');
    if (payload.isLateJoin) showSuccessToast('Te uniste a una partida ya en curso.');
}

function applySync(sync) {
    switch (sync.state) {
        case 'lobby':
            if (myRole === 'host') {
                showScreen('screen-lobby-host');
                void initLobbyHostView();
            } else {
                showScreen('screen-lobby-player');
            }
            break;
        case 'loading':
            showScreen('screen-loading');
            document.getElementById('loading-message').textContent = 'Preparando la partida...';
            document.getElementById('loading-next-btn').classList.add('hidden');
            break;
        case 'question':
            renderQuestion(sync.question, sync.secondsLeft, sync.alreadyAnswered);
            break;
        case 'reveal':
            renderReveal(sync.revealed);
            break;
        case 'leaderboard':
            renderLeaderboard(sync.leaderboard, false);
            break;
        case 'finished':
            renderFinished(sync.result);
            break;
    }
}

function onSocketError(payload) {
    showErrorToast(payload.message);
    const fatalCodes = ['ROOM_NOT_FOUND', 'ROOM_FINISHED', 'ROOM_CANCELLED'];
    if (fatalCodes.includes(payload.code)) {
        cleanupRoomStorage();
        showRoomError(payload.message);
    }
}

function showRoomError(message) {
    document.getElementById('room-error-message').textContent = message;
    showScreen('screen-room-error');
}

function onLeaveRoomClick() {
    socket?.emit('room:leave');
    cleanupRoomStorage();
    window.location.href = 'index.html';
}

function cleanupRoomStorage() {
    if (roomCode) {
        localStorage.removeItem(`rq_guest_${roomCode}`);
        localStorage.removeItem(`rq_matchid_${roomCode}`);
    }
}

// ---------- Utilidades de pantalla ----------

function showScreen(id) {
    ALL_SCREENS.forEach((s) => document.getElementById(s).classList.toggle('hidden', s !== id));
}

function renderPlayerChips(players) {
    const html = players
        .map(
            (p) =>
                `<span class="player-chip${p.isConnected ? '' : ' disconnected'}">${escapeHtml(p.displayName)}</span>`,
        )
        .join('');
    const list = document.getElementById('player-chip-list');
    if (list) list.innerHTML = html;
    const lobbyList = document.getElementById('lobby-player-chip-list');
    if (lobbyList) lobbyList.innerHTML = html;
}

// ---------- Lobby: HOST ----------

async function initLobbyHostView() {
    wireLobbyTabsOnce();
    await refreshMatchQuizStatus();
    await loadMyQuizzesTab();
}

function wireLobbyTabsOnce() {
    if (lobbyTabsWired) return;
    lobbyTabsWired = true;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('tab-mine').classList.toggle('hidden', tab !== 'mine');
            document.getElementById('tab-explore').classList.toggle('hidden', tab !== 'explore');
            document.getElementById('tab-ai').classList.toggle('hidden', tab !== 'ai');

            if (tab === 'explore' && !exploreTabLoaded) {
                exploreTabLoaded = true;
                fetchQuizzes({ limit: 9 })
                    .then((result) => {
                        renderQuizGrid(document.getElementById('lobby-explore-list'), result.data, openQuizPickerModal);
                        highlightSelectedQuiz();
                    })
                    .catch(showErrorToast);
            }
        });
    });

    document.getElementById('lobby-search-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = document.getElementById('lobby-search-q').value.trim();
        try {
            const result = await fetchQuizzes({ q, limit: 9 });
            renderQuizGrid(document.getElementById('lobby-explore-list'), result.data, openQuizPickerModal);
            highlightSelectedQuiz();
        } catch (err) {
            showErrorToast(err);
        }
    });

    document.getElementById('lobby-ai-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = document.getElementById('lobby-ai-topic').value.trim();
        const numQuestions = Number(document.getElementById('lobby-ai-num').value) || 10;
        const btn = document.getElementById('lobby-ai-submit');
        btn.disabled = true;
        btn.textContent = 'Generando...';
        try {
            const match = await api.post(`/matches/${currentMatchId}/generate-quiz`, { topic, numQuestions }, { auth: true });
            setLobbyQuizStatus(`Quiz asignado: Quiz de ${topic}`, true);
            selectedQuizId = typeof match.quiz === 'object' ? match.quiz._id : match.quiz;
            showSuccessToast('Quiz generado con IA.');
            await loadMyQuizzesTab();
        } catch (err) {
            showErrorToast(err);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Generar quiz';
        }
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
        socket.emit('game:start');
    });

    document.getElementById('loading-next-btn').addEventListener('click', () => {
        socket.emit('game:next_question');
    });

    document.getElementById('force-reveal-btn').addEventListener('click', () => {
        socket.emit('game:reveal_answer');
    });

    document.getElementById('next-question-btn').addEventListener('click', () => {
        socket.emit('game:next_question');
    });

    document.getElementById('play-again-btn').addEventListener('click', () => {
        socket.emit('game:play_again');
    });

    document.getElementById('quiz-detail-close').addEventListener('click', () => {
        document.getElementById('quiz-detail-modal').classList.add('hidden');
    });
    document.getElementById('quiz-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'quiz-detail-modal') document.getElementById('quiz-detail-modal').classList.add('hidden');
    });
}

async function loadMyQuizzesTab() {
    const container = document.getElementById('my-quizzes-list');
    const emptyMsg = document.getElementById('my-quizzes-empty');
    try {
        const profile = await api.get(`/users/${currentUser.id}`);
        const ids = profile.createdQuizzes || [];
        if (ids.length === 0) {
            container.innerHTML = '';
            emptyMsg.classList.remove('hidden');
            return;
        }
        emptyMsg.classList.add('hidden');
        const quizzes = await Promise.all(ids.map((id) => api.get(`/quizzes/${id}`).catch(() => null)));
        renderQuizGrid(container, quizzes.filter(Boolean), openQuizPickerModal);
        highlightSelectedQuiz();
    } catch (err) {
        showErrorToast(err);
    }
}

async function refreshMatchQuizStatus() {
    if (!currentMatchId) {
        setLobbyQuizStatus('Aún no has asignado un quiz. Elige uno o genera uno con IA.', false);
        return;
    }
    try {
        const match = await api.get(`/matches/${currentMatchId}`);
        if (match.quiz) {
            const title = typeof match.quiz === 'object' ? match.quiz.title : 'Quiz asignado';
            selectedQuizId = typeof match.quiz === 'object' ? match.quiz._id : match.quiz;
            setLobbyQuizStatus(`Quiz asignado: ${title}`, true);
        } else {
            selectedQuizId = null;
            setLobbyQuizStatus('Aún no has asignado un quiz. Elige uno o genera uno con IA.', false);
        }
        highlightSelectedQuiz();
    } catch (err) {
        showErrorToast(err);
    }
}

function setLobbyQuizStatus(text, hasQuiz) {
    document.getElementById('lobby-quiz-status').textContent = text;
    document.getElementById('start-game-btn').disabled = !hasQuiz;
}

function highlightSelectedQuiz() {
    document.querySelectorAll('.quiz-card').forEach((card) => {
        const isSelected = Boolean(selectedQuizId) && card.dataset.quizId === selectedQuizId;
        card.classList.toggle('selected', isSelected);

        let badge = card.querySelector('.quiz-card-selected-badge');
        if (isSelected && !badge) {
            badge = document.createElement('div');
            badge.className = 'quiz-card-selected-badge';
            badge.textContent = '✓ Usado en esta partida';
            card.querySelector('.quiz-card-body').prepend(badge);
        } else if (!isSelected && badge) {
            badge.remove();
        }
    });
}

async function openQuizPickerModal(quizId) {
    try {
        const quiz = await api.get(`/quizzes/${quizId}`);
        renderQuizDetail(quiz);
        const useBtn = document.getElementById('quiz-detail-use-btn');
        useBtn.classList.remove('hidden');
        useBtn.onclick = () => void selectQuizForMatch(quiz._id, quiz.title);
        document.getElementById('quiz-detail-modal').classList.remove('hidden');
    } catch (err) {
        showErrorToast(err);
    }
}

async function selectQuizForMatch(quizId, title) {
    try {
        await api.patch(`/matches/${currentMatchId}/quiz`, { quizId }, { auth: true });
        document.getElementById('quiz-detail-modal').classList.add('hidden');
        setLobbyQuizStatus(`Quiz asignado: ${title}`, true);
        selectedQuizId = quizId;
        highlightSelectedQuiz();
        showSuccessToast('Quiz asignado a la partida.');
    } catch (err) {
        showErrorToast(err);
    }
}

// ---------- Loading / ready ----------

function onGameLoading(payload) {
    showScreen('screen-loading');
    document.getElementById('loading-message').textContent = payload.message;
    document.getElementById('loading-next-btn').classList.add('hidden');
}

function onGameReady() {
    document.getElementById('loading-message').textContent = '¡Todo listo!';
    document.getElementById('loading-next-btn').classList.toggle('hidden', myRole !== 'host');
}

// ---------- Pregunta ----------

function onGameQuestion(payload) {
    renderQuestion(payload, payload.timeLimitSeconds, false);
}

function renderQuestion(question, secondsLeft, alreadyAnswered) {
    currentQuestion = question;
    ownAnswerIndex = null;
    showScreen('screen-question');

    document.getElementById('question-progress').textContent =
        `Pregunta ${question.questionIndex + 1} de ${question.totalQuestions}`;
    document.getElementById('question-timer').textContent = secondsLeft;
    document.getElementById('question-text').textContent = question.question;

    const img = document.getElementById('question-image');
    if (question.imageUrl) {
        img.src = question.imageUrl;
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }

    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';
    const isHostView = 'correctIndex' in question;

    question.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = isHostView && i === question.correctIndex ? `${opt}` : opt;

        if (myRole === 'player') {
            btn.disabled = alreadyAnswered;
            btn.addEventListener('click', () => submitAnswer(i));
        } else {
            btn.disabled = true;
        }
        optionsContainer.appendChild(btn);
    });

    const hostAnswerCount = document.getElementById('host-answer-count');
    const forceRevealBtn = document.getElementById('force-reveal-btn');
    const playerWaitingMsg = document.getElementById('player-waiting-msg');

    if (myRole === 'host') {
        hostAnswerCount.classList.remove('hidden');
        hostAnswerCount.textContent = 'Esperando respuestas...';
        forceRevealBtn.classList.remove('hidden');
        playerWaitingMsg.classList.add('hidden');
    } else {
        hostAnswerCount.classList.add('hidden');
        forceRevealBtn.classList.add('hidden');
        playerWaitingMsg.classList.toggle('hidden', !alreadyAnswered);
        if (alreadyAnswered) markOptionAsChosen(null);
    }
}

function submitAnswer(index) {
    if (ownAnswerIndex !== null) return;
    ownAnswerIndex = index;

    socket.emit('game:submit_answer', {
        questionIndex: currentQuestion.questionIndex,
        answerIndex: index,
    });

    markOptionAsChosen(index);
    document.getElementById('player-waiting-msg').classList.remove('hidden');
}

function markOptionAsChosen(index) {
    document.querySelectorAll('#question-options .option-btn').forEach((btn, i) => {
        btn.disabled = true;
        if (i === index) btn.classList.add('chosen');
    });
}

function onTimerTick(payload) {
    document.getElementById('question-timer').textContent = payload.secondsLeft;
}

function onAnswerCount(payload) {
    document.getElementById('host-answer-count').textContent =
        `${payload.answeredCount}/${payload.totalPlayers} jugadores han respondido.`;
}

// ---------- Reveal ----------

function onAnswerRevealed(payload) {
    renderReveal(payload);
}

function renderReveal(revealed) {
    showScreen('screen-reveal');
    document.getElementById('reveal-correct-text').textContent = revealed.correctText;

    const ownResult = document.getElementById('reveal-own-result');
    if (myRole === 'player' && ownAnswerIndex !== null) {
        ownResult.textContent =
            ownAnswerIndex === revealed.correctIndex ? '¡Acertaste! 🎉' : 'Esta vez no era correcta.';
    } else {
        ownResult.textContent = '';
    }
}

// ---------- Leaderboard ----------

function onLeaderboard(payload) {
    renderLeaderboard(payload.leaderboard, payload.isFinalRound);
}

function renderLeaderboard(leaderboard, isFinalRound) {
    showScreen('screen-leaderboard');
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = leaderboard
        .map(
            (entry) => `
        <tr>
            <td>${entry.rank}</td>
            <td>${escapeHtml(entry.displayName)}</td>
            <td>${entry.score}</td>
            <td>${entry.lastAnswerCorrect ? `✅ +${entry.lastPoints}` : '❌'}</td>
        </tr>`,
        )
        .join('');

    const nextBtn = document.getElementById('next-question-btn');
    nextBtn.classList.toggle('hidden', myRole !== 'host');
    nextBtn.textContent = isFinalRound ? 'Ver resultados finales' : 'Siguiente pregunta';
}

// ---------- Finished ----------

function onGameOver(payload) {
    renderFinished(payload);
}

function renderFinished(result) {
    showScreen('screen-finished');
    document.getElementById('finished-winner-name').textContent = result.winner.displayName;
    document.getElementById('finished-winner-score').textContent = `${result.winner.score} puntos`;

    const body = document.getElementById('finished-leaderboard-body');
    body.innerHTML = result.leaderboard
        .map(
            (entry) => `
        <tr>
            <td>${entry.rank}</td>
            <td>${escapeHtml(entry.displayName)}</td>
            <td>${entry.score}</td>
        </tr>`,
        )
        .join('');

    document.getElementById('play-again-btn').classList.toggle('hidden', myRole !== 'host');
}

function onPlayAgainOk(payload) {
    currentMatchId = payload.matchId;
    if (myRole === 'host') {
        localStorage.setItem(`rq_matchid_${roomCode}`, payload.matchId);
    }
    renderPlayerChips(payload.players);

    if (myRole === 'host') {
        showScreen('screen-lobby-host');
        selectedQuizId = null;
        setLobbyQuizStatus('Aún no has asignado un quiz. Elige uno o genera uno con IA.', false);
        exploreTabLoaded = false; 
        void loadMyQuizzesTab(); 
    } else {
        showScreen('screen-lobby-player');
    }
}
