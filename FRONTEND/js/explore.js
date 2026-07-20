// explore.js — controlador de la pantalla de explorar quizzes

const EXPLORE_LIMIT = 12;
let exploreState = { page: 1, total: 0, q: '', tags: '' };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        exploreState.q = document.getElementById('search-q').value.trim();
        exploreState.tags = document.getElementById('search-tags').value.trim();
        exploreState.page = 1;
        void loadQuizzes();
    });

    document.getElementById('prev-page').addEventListener('click', () => {
        if (exploreState.page > 1) {
            exploreState.page -= 1;
            void loadQuizzes();
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const maxPage = Math.max(1, Math.ceil(exploreState.total / EXPLORE_LIMIT));
        if (exploreState.page < maxPage) {
            exploreState.page += 1;
            void loadQuizzes();
        }
    });

    document.getElementById('quiz-detail-close').addEventListener('click', () => {
        document.getElementById('quiz-detail-modal').classList.add('hidden');
    });
    document.getElementById('quiz-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'quiz-detail-modal') {
            document.getElementById('quiz-detail-modal').classList.add('hidden');
        }
    });

    void loadQuizzes();
});

async function loadQuizzes() {
    try {
        const result = await fetchQuizzes({
            q: exploreState.q,
            tags: exploreState.tags,
            page: exploreState.page,
            limit: EXPLORE_LIMIT,
        });

        exploreState.total = result.total;

        const grid = document.getElementById('quiz-grid');
        const emptyState = document.getElementById('empty-results');

        if (result.data.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            renderQuizGrid(grid, result.data, openQuizDetailModal);
        }

        const maxPage = Math.max(1, Math.ceil(exploreState.total / EXPLORE_LIMIT));
        document.getElementById('page-info').textContent = `Página ${exploreState.page} de ${maxPage}`;
        document.getElementById('prev-page').disabled = exploreState.page <= 1;
        document.getElementById('next-page').disabled = exploreState.page >= maxPage;
    } catch (err) {
        showErrorToast(err);
    }
}
