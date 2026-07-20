// quiz-explorer.js
// Lógica reutilizable para: buscar quizzes (GET /quizzes), pintarlos en una
// grilla de tarjetas, y abrir el modal de detalle con sus preguntas —
// SIN mostrar nunca cuál es la respuesta correcta (ni siquiera al dueño).
//
// La usan tanto explore.html (explorador general) como room.html (el host
// eligiendo un quiz público para su partida).

const PLACEHOLDER_COVER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">' +
            '<rect width="100%" height="100%" fill="%23f2ecd8"/>' +
            '<text x="50%" y="50%" font-size="20" text-anchor="middle" fill="%231a1a1a" font-family="sans-serif">Sin portada</text>' +
            '</svg>',
    );


async function fetchQuizzes(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.tags) query.set('tags', params.tags);
    if (params.owner) query.set('owner', params.owner);
    query.set('page', String(params.page || 1));
    query.set('limit', String(params.limit || 12));

    return api.get(`/quizzes?${query.toString()}`);
}


function renderQuizGrid(container, quizzes, onCardClick) {
    container.innerHTML = '';
    for (const quiz of quizzes) {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.dataset.quizId = quiz._id;

        const ownerName = quiz.owner && typeof quiz.owner === 'object' ? quiz.owner.displayName : '';

        card.innerHTML = `
            <img class="quiz-card-cover" src="${quiz.coverImageUrl || PLACEHOLDER_COVER}" alt="${escapeHtml(quiz.title)}" />
            <div class="quiz-card-body">
                <div class="quiz-card-title">${escapeHtml(quiz.title)}</div>
                <div class="quiz-card-meta">${ownerName ? 'Por ' + escapeHtml(ownerName) : ''} · ${quiz.timesPlayed ?? 0} jugadas</div>
                <div>${(quiz.tags || []).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>
            </div>
        `;
        card.addEventListener('click', () => onCardClick(quiz._id));
        container.appendChild(card);
    }
}


async function openQuizDetailModal(quizId) {
    try {
        const quiz = await api.get(`/quizzes/${quizId}`);
        renderQuizDetail(quiz);
        document.getElementById('quiz-detail-modal').classList.remove('hidden');
    } catch (err) {
        showErrorToast(err);
    }
}

function renderQuizDetail(quiz) {
    document.getElementById('quiz-detail-title').textContent = quiz.title;

    const ownerName = quiz.owner && typeof quiz.owner === 'object' ? quiz.owner.displayName : '';
    document.getElementById('quiz-detail-meta').textContent =
        `${quiz.questions.length} preguntas` + (ownerName ? ` · Por ${ownerName}` : '');

    const list = document.getElementById('quiz-detail-questions');
    list.innerHTML = '';

    quiz.questions.forEach((q, i) => {
        const item = document.createElement('div');
        item.className = 'question-list-item';
        item.innerHTML = `
            <strong>${i + 1}. ${escapeHtml(q.question)}</strong>
            ${q.imageUrl ? `<img src="${q.imageUrl}" alt="" />` : ''}
            <div>${q.options.map((opt) => `<span class="option-pill">${escapeHtml(opt)}</span>`).join('')}</div>
        `;
        list.appendChild(item);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
