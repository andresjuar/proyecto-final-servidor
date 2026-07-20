// my-quizzes.js - lista de los quizzes propios (públicos y privados) con
// acciones de editar / eliminar / cambiar visibilidad.

document.addEventListener('rq:auth-ready', updateGateAndLoad);
document.addEventListener('rq:auth-changed', updateGateAndLoad);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-gate-btn').addEventListener('click', () => {
        openAuthModal('login', () => updateGateAndLoad());
    });
});

function updateGateAndLoad() {
    const hasSession = Boolean(currentUser);
    document.getElementById('login-gate').classList.toggle('hidden', hasSession);
    document.getElementById('my-quizzes-content').classList.toggle('hidden', !hasSession);
    if (hasSession) {
        void loadMyQuizzes();
    }
}

async function loadMyQuizzes() {
    const grid = document.getElementById('my-quizzes-grid');
    const emptyMsg = document.getElementById('my-quizzes-empty');

    try {
        const profile = await api.get(`/users/${currentUser.id}`);
        const ids = profile.createdQuizzes || [];

        if (ids.length === 0) {
            grid.innerHTML = '';
            emptyMsg.classList.remove('hidden');
            return;
        }
        emptyMsg.classList.add('hidden');

        const quizzes = await Promise.all(ids.map((id) => api.get(`/quizzes/${id}`).catch(() => null)));
        renderMyQuizzesGrid(quizzes.filter(Boolean));
    } catch (err) {
        showErrorToast(err);
    }
}

function renderMyQuizzesGrid(quizzes) {
    const grid = document.getElementById('my-quizzes-grid');
    grid.innerHTML = '';

    quizzes.forEach((quiz) => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.dataset.quizId = quiz._id;

        card.innerHTML = `
            <img class="quiz-card-cover" src="${quiz.coverImageUrl || PLACEHOLDER_COVER}" alt="${escapeHtml(quiz.title)}" />
            <div class="quiz-card-body">
                <div class="quiz-card-title">${escapeHtml(quiz.title)}</div>
                <div class="quiz-card-meta">${quiz.questions.length} preguntas · ${quiz.timesPlayed ?? 0} jugadas</div>
                <span class="tag-chip visibility-badge ${quiz.isPublic ? 'visibility-badge-public' : 'visibility-badge-private'}" data-role="visibility-badge">
                    ${quiz.isPublic ? 'Público' : 'Privado'}
                </span>
                <div class="quiz-card-actions">
                    <button type="button" class="btn btn-small" data-action="edit">Editar</button>
                    <button type="button" class="btn btn-small" data-action="toggle">
                        ${quiz.isPublic ? 'Hacer privado' : 'Hacer público'}
                    </button>
                    <button type="button" class="btn btn-small btn-danger" data-action="delete">Eliminar</button>
                </div>
            </div>
        `;

        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
            window.location.href = `create-quiz.html?edit=${quiz._id}`;
        });
        card.querySelector('[data-action="toggle"]').addEventListener('click', () => void toggleVisibility(card, quiz));
        card.querySelector('[data-action="delete"]').addEventListener('click', () => void deleteQuiz(card, quiz));

        grid.appendChild(card);
    });
}

async function toggleVisibility(card, quiz) {
    const newValue = !quiz.isPublic;
    try {
        await api.put(`/quizzes/${quiz._id}`, { isPublic: newValue }, { auth: true });
        quiz.isPublic = newValue;

        const badge = card.querySelector('[data-role="visibility-badge"]');
        badge.textContent = newValue ? 'Público' : 'Privado';
        badge.classList.toggle('visibility-badge-public', newValue);
        badge.classList.toggle('visibility-badge-private', !newValue);

        card.querySelector('[data-action="toggle"]').textContent = newValue ? 'Hacer privado' : 'Hacer público';
        showSuccessToast(newValue ? 'Ahora es público.' : 'Ahora es privado.');
    } catch (err) {
        showErrorToast(err);
    }
}

async function deleteQuiz(card, quiz) {
    const confirmed = window.confirm(`¿Seguro que quieres eliminar "${quiz.title}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
        await api.del(`/quizzes/${quiz._id}`, { auth: true });
        card.remove();
        showSuccessToast('Quiz eliminado.');

        if (document.querySelectorAll('#my-quizzes-grid .quiz-card').length === 0) {
            document.getElementById('my-quizzes-empty').classList.remove('hidden');
        }
    } catch (err) {
        showErrorToast(err);
    }
}
