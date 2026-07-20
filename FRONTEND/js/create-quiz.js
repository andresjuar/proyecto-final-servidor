// create-quiz.js — formulario para crear un quiz manualmente

let questionCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-gate-btn').addEventListener('click', () => {
        openAuthModal('login', () => updateGateVisibility());
    });
    document.getElementById('add-question-btn').addEventListener('click', () => addQuestionBlock());
    document.getElementById('quiz-form').addEventListener('submit', onSubmitQuiz);

    document.addEventListener('rq:auth-ready', updateGateVisibility);
    document.addEventListener('rq:auth-changed', updateGateVisibility);

    // Arranca con una pregunta ya lista, y cada pregunta con 2 opciones mínimas.
    addQuestionBlock();
});

function updateGateVisibility() {
    document.getElementById('login-gate').classList.toggle('hidden', Boolean(currentUser));
    document.getElementById('quiz-form').classList.toggle('hidden', !currentUser);
}

function addQuestionBlock() {
    questionCount += 1;
    const template = document.getElementById('question-template');
    const clone = template.content.cloneNode(true);
    const block = clone.querySelector('[data-question]');
    block.dataset.index = String(questionCount);

    clone.querySelector('[data-question-number]').textContent = `Pregunta ${questionCount}`;
    clone.querySelector('[data-remove-question]').addEventListener('click', () => {
        block.remove();
        renumberQuestions();
    });
    clone.querySelector('[data-add-option]').addEventListener('click', () => {
        addOptionRow(block.querySelector('[data-options-container]'), block.dataset.index);
    });

    document.getElementById('questions-container').appendChild(clone);

    const optionsContainer = block.querySelector('[data-options-container]');
    addOptionRow(optionsContainer, block.dataset.index);
    addOptionRow(optionsContainer, block.dataset.index);
    // La primera opción queda marcada como correcta por defecto.
    optionsContainer.querySelector('input[data-field="isCorrect"]').checked = true;
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

        questions.push({ question: questionText, options, correctIndex, timeLimitSeconds });
        questionImageFiles.push(imageFile || null);
    }

    const submitBtn = document.getElementById('submit-quiz-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';

    try {
        const quiz = await api.post(
            '/quizzes',
            { title, description, topic, tags, isPublic, questions },
            { auth: true },
        );

        // Subidas de imagen son opcionales/secundarias: si fallan, no se
        // revierte la creación del quiz, solo se avisa.
        if (coverFile) {
            await tryUploadImage(`/quizzes/${quiz._id}/image`, coverFile);
        }
        for (let i = 0; i < questionImageFiles.length; i++) {
            if (questionImageFiles[i]) {
                await tryUploadImage(`/quizzes/${quiz._id}/questions/${i}/image`, questionImageFiles[i]);
            }
        }

        showSuccessToast('¡Quiz creado con éxito!');
        window.location.href = 'explore.html';
    } catch (err) {
        errorBox.textContent = err.errores ? err.errores.join(' ') : err.message;
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear quiz';
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
