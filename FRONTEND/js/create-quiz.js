
let questionCount = 0;
let editQuizId = null;
let formInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    editQuizId = params.get('edit');

    if (editQuizId) {
        document.getElementById('page-heading').textContent = 'Editar quiz';
        document.getElementById('submit-quiz-btn').textContent = 'Guardar cambios';
        document.getElementById('delete-quiz-btn').classList.remove('hidden');
    }

    document.getElementById('login-gate-btn').addEventListener('click', () => {
        openAuthModal('login', () => updateGateVisibility());
    });
    document.getElementById('add-question-btn').addEventListener('click', () => addQuestionBlock());
    document.getElementById('quiz-form').addEventListener('submit', onSubmitQuiz);
    document.getElementById('delete-quiz-btn').addEventListener('click', onDeleteQuiz);

    document.addEventListener('rq:auth-ready', updateGateVisibility);
    document.addEventListener('rq:auth-changed', updateGateVisibility);
});

function updateGateVisibility() {
    const hasSession = Boolean(currentUser);
    document.getElementById('login-gate').classList.toggle('hidden', hasSession);
    document.getElementById('quiz-form').classList.toggle('hidden', !hasSession);

    if (hasSession && !formInitialized) {
        formInitialized = true;
        if (editQuizId) {
            void loadQuizForEdit();
        } else {
            // Arranca con una pregunta ya lista, con 2 opciones mínimas.
            addQuestionBlock();
        }
    }
}

async function loadQuizForEdit() {
    try {
        const quiz = await api.get(`/quizzes/${editQuizId}`);
        const ownerId = typeof quiz.owner === 'object' ? quiz.owner._id : quiz.owner;

        if (ownerId !== currentUser.id) {
            showErrorToast('No puedes editar un quiz que no es tuyo.');
            window.location.href = 'my-quizzes.html';
            return;
        }

        document.getElementById('quiz-title').value = quiz.title || '';
        document.getElementById('quiz-description').value = quiz.description || '';
        document.getElementById('quiz-topic').value = quiz.topic || '';
        document.getElementById('quiz-tags').value = (quiz.tags || []).join(',');
        document.getElementById('quiz-isPublic').checked = Boolean(quiz.isPublic);

        if (quiz.coverImageUrl) {
            const preview = document.getElementById('quiz-cover-preview');
            preview.src = quiz.coverImageUrl;
            preview.classList.remove('hidden');
        }

        document.getElementById('questions-container').innerHTML = '';
        questionCount = 0;
        (quiz.questions || []).forEach((q) => addQuestionBlock(q));
    } catch (err) {
        showErrorToast(err);
        window.location.href = 'my-quizzes.html';
    }
}

function addQuestionBlock(existing) {
    questionCount += 1;
    const template = document.getElementById('question-template');
    const clone = template.content.cloneNode(true);
    const block = clone.querySelector('[data-question]');
    block.dataset.index = String(questionCount);
    block.dataset.existingImageUrl = (existing && existing.imageUrl) || '';

    clone.querySelector('[data-question-number]').textContent = `Pregunta ${questionCount}`;
    clone.querySelector('[data-remove-question]').addEventListener('click', () => {
        block.remove();
        renumberQuestions();
    });
    clone.querySelector('[data-add-option]').addEventListener('click', () => {
        addOptionRow(block.querySelector('[data-options-container]'), block.dataset.index);
    });

    if (existing) {
        clone.querySelector('input[data-field="question"]').value = existing.question || '';
        clone.querySelector('input[data-field="timeLimitSeconds"]').value = existing.timeLimitSeconds || 20;
        if (existing.imageUrl) {
            const preview = clone.querySelector('[data-question-image-preview]');
            preview.src = existing.imageUrl;
            preview.classList.remove('hidden');
        }
    }

    document.getElementById('questions-container').appendChild(clone);

    const optionsContainer = block.querySelector('[data-options-container]');

    if (existing && Array.isArray(existing.options) && existing.options.length > 0) {
        existing.options.forEach(() => addOptionRow(optionsContainer, block.dataset.index));
        const rows = optionsContainer.querySelectorAll('[data-option]');
        rows.forEach((row, i) => {
            row.querySelector('input[data-field="optionText"]').value = existing.options[i];
            if (i === existing.correctIndex) {
                row.querySelector('input[data-field="isCorrect"]').checked = true;
            }
        });
    } else {
        addOptionRow(optionsContainer, block.dataset.index);
        addOptionRow(optionsContainer, block.dataset.index);
        optionsContainer.querySelector('input[data-field="isCorrect"]').checked = true;
    }
}

function addOptionRow(container, questionIndex) {
    const template = document.getElementById('option-template');
    const clone = template.content.cloneNode(true);
    const radio = clone.querySelector('input[data-field="isCorrect"]');
    radio.name = `correct-${questionIndex}`;

    clone.querySelector('[data-remove-option]').addEventListener('click', (e) => {
        const row = e.target.closest('[data-option]');
        if (container.querySelectorAll('[data-option]').length <= 2) {
            showErrorToast('Cada pregunta debe tener al menos 2 opciones.');
            return;
        }
        row.remove();
    });

    container.appendChild(clone);
}

function renumberQuestions() {
    const blocks = document.querySelectorAll('#questions-container [data-question]');
    blocks.forEach((block, i) => {
        block.querySelector('[data-question-number]').textContent = `Pregunta ${i + 1}`;
    });
}

async function onSubmitQuiz(e) {
    e.preventDefault();
    const errorBox = document.getElementById('quiz-form-error');
    errorBox.classList.add('hidden');

    const title = document.getElementById('quiz-title').value.trim();
    const description = document.getElementById('quiz-description').value.trim();
    const topic = document.getElementById('quiz-topic').value.trim();
    const tagsRaw = document.getElementById('quiz-tags').value.trim();
    const isPublic = document.getElementById('quiz-isPublic').checked;
    const coverFile = document.getElementById('quiz-cover-file').files[0];

    const tags = tagsRaw
        ? tagsRaw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : [];

    const questionBlocks = document.querySelectorAll('#questions-container [data-question]');
    if (questionBlocks.length === 0) {
        errorBox.textContent = 'Agrega al menos una pregunta.';
        errorBox.classList.remove('hidden');
        return;
    }

    const questions = [];
    const questionImageFiles = [];

    for (const block of questionBlocks) {
        const questionText = block.querySelector('input[data-field="question"]').value.trim();
        const timeLimitSeconds = Number(block.querySelector('input[data-field="timeLimitSeconds"]').value) || 20;
        const imageFile = block.querySelector('input[data-field="imageFile"]').files[0];

        const optionRows = block.querySelectorAll('[data-option]');
        const options = [];
        let correctIndex = -1;

        optionRows.forEach((row, i) => {
            const text = row.querySelector('input[data-field="optionText"]').value.trim();
            options.push(text);
            if (row.querySelector('input[data-field="isCorrect"]').checked) {
                correctIndex = i;
            }
        });

        if (!questionText || options.length < 2 || options.some((o) => !o) || correctIndex === -1) {
            errorBox.textContent =
                'Cada pregunta necesita texto, al menos 2 opciones con texto, y una marcada como correcta.';
            errorBox.classList.remove('hidden');
            return;
        }

        const questionPayload = { question: questionText, options, correctIndex, timeLimitSeconds };
        // Si estamos editando y esta pregunta ya tenía imagen, la mantenemos en el
        // payload para no perderla al reemplazar el arreglo completo de preguntas;
        // si se elige un archivo nuevo, se sobrescribe después con tryUploadImage.
        if (block.dataset.existingImageUrl) {
            questionPayload.imageUrl = block.dataset.existingImageUrl;
        }

        questions.push(questionPayload);
        questionImageFiles.push(imageFile || null);
    }

    const submitBtn = document.getElementById('submit-quiz-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = editQuizId ? 'Guardando...' : 'Creando...';

    try {
        let quizId = editQuizId;
        if (editQuizId) {
            await api.put(
                `/quizzes/${editQuizId}`,
                { title, description, topic, tags, isPublic, questions },
                { auth: true },
            );
        } else {
            const quiz = await api.post(
                '/quizzes',
                { title, description, topic, tags, isPublic, questions },
                { auth: true },
            );
            quizId = quiz._id;
        }

     
        if (coverFile) {
            await tryUploadImage(`/quizzes/${quizId}/image`, coverFile);
        }
        for (let i = 0; i < questionImageFiles.length; i++) {
            if (questionImageFiles[i]) {
                await tryUploadImage(`/quizzes/${quizId}/questions/${i}/image`, questionImageFiles[i]);
            }
        }

        showSuccessToast(editQuizId ? '¡Quiz actualizado con éxito!' : '¡Quiz creado con éxito!');
        window.location.href = 'my-quizzes.html';
    } catch (err) {
        errorBox.textContent = err.errores ? err.errores.join(' ') : err.message;
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editQuizId ? 'Guardar cambios' : 'Crear quiz';
    }
}

async function onDeleteQuiz() {
    if (!editQuizId) return;
    const confirmed = window.confirm('¿Seguro que quieres eliminar este quiz? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
        await api.del(`/quizzes/${editQuizId}`, { auth: true });
        showSuccessToast('Quiz eliminado.');
        window.location.href = 'my-quizzes.html';
    } catch (err) {
        showErrorToast(err);
    }
}

async function tryUploadImage(path, file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        await api.post(path, formData, { auth: true, isMultipart: true });
    } catch (err) {
        showErrorToast(`No se pudo subir una imagen: ${err.message}`);
    }
}
