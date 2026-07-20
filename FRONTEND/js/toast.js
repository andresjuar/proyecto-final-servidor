// toast.js
// Notificaciones simples (toasts) para errores y mensajes de éxito.
// Se usa tanto para errores de REST (mensaje del backend) como para
// errores que lleguen por el evento 'error' de Socket.io.

function ensureToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'error', durationMs = 4000) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type === 'success' ? 'success' : 'error'}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, durationMs);
}

function showErrorToast(err) {
    const message = typeof err === 'string' ? err : err?.message || 'Ocurrió un error inesperado.';
    showToast(message, 'error');
}

function showSuccessToast(message) {
    showToast(message, 'success');
}
