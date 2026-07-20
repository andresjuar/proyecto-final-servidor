// auth.js
// Manejo de sesión compartido entre todas las páginas:



let currentUser = null;
let pendingAuthAction = null;

async function initAuth() {
    renderNav();
    wireAuthModal();

    const token = getToken();
    if (token) {
        try {
            const me = await api.get('/auth/me', { auth: true });
            const profile = await api.get(`/users/${me.user.id}`);
            currentUser = {
                id: me.user.id,
                email: me.user.email,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
            };
        } catch (err) {
            // Token inválido/expirado: se limpia silenciosamente.
            clearToken();
            currentUser = null;
        }
    } else {
        currentUser = null;
    }

    renderNav();
    document.dispatchEvent(new CustomEvent('rq:auth-ready', { detail: { currentUser } }));
}

function renderNav() {
    const loginBtn = document.getElementById('nav-login-btn');
    const userBox = document.getElementById('nav-user-box');
    const userName = document.getElementById('nav-user-name');

    if (!loginBtn || !userBox || !userName) return;

    if (currentUser) {
        loginBtn.classList.add('hidden');
        userBox.classList.remove('hidden');
        userName.textContent = currentUser.displayName;
    } else {
        loginBtn.classList.remove('hidden');
        userBox.classList.add('hidden');
    }
}

function wireAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return; // esta página no tiene el modal (no debería pasar, pero por seguridad)

    const closeBtn = document.getElementById('auth-modal-close');
    const loginBtn = document.getElementById('nav-login-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');
    const toRegister = document.getElementById('to-register');
    const toLogin = document.getElementById('to-login');
    const successClose = document.getElementById('auth-success-close');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginBtn?.addEventListener('click', () => openAuthModal('login', null));
    logoutBtn?.addEventListener('click', handleLogout);
    closeBtn?.addEventListener('click', closeAuthModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAuthModal();
    });

    toRegister?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('register');
    });
    toLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('login');
    });
    successClose?.addEventListener('click', () => {
        closeAuthModal();
        showAuthView('login');
    });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLoginSubmit();
    });
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegisterSubmit();
    });
}

/**
 * Abre el modal de sesión.
 * @param {'login'|'register'} mode
 * @param {(() => void)|null} onSuccess - acción pendiente a ejecutar tras loguearse
 *   exitosamente. Si es null, el modal solo se cierra al loguearse (comportamiento
 *   del botón genérico "Iniciar sesión" de la navbar).
 */
function openAuthModal(mode, onSuccess) {
    pendingAuthAction = onSuccess || null;
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    showAuthView(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal?.classList.add('hidden');
    pendingAuthAction = null;
    clearAuthErrors();
}

function showAuthView(view) {
    document.getElementById('auth-login-view')?.classList.toggle('hidden', view !== 'login');
    document.getElementById('auth-register-view')?.classList.toggle('hidden', view !== 'register');
    document.getElementById('auth-register-success')?.classList.add('hidden');
    clearAuthErrors();
}

function clearAuthErrors() {
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    if (loginError) {
        loginError.textContent = '';
        loginError.classList.add('hidden');
    }
    if (registerError) {
        registerError.textContent = '';
        registerError.classList.add('hidden');
    }
}

async function handleLoginSubmit() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');
    const submitBtn = document.querySelector('#login-form button[type="submit"]');

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Entrando...';

    try {
        const data = await api.post('/auth/login', { email, password });
        setToken(data.token);

        const me = await api.get('/auth/me', { auth: true });
        const profile = await api.get(`/users/${me.user.id}`);
        currentUser = {
            id: me.user.id,
            email: me.user.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
        };
        renderNav();
        document.dispatchEvent(new CustomEvent('rq:auth-changed', { detail: { currentUser } }));

        const action = pendingAuthAction;
        pendingAuthAction = null;
        closeAuthModal();

        if (action) {
            await action();
        }
    } catch (err) {
        if (errorBox) {
            // 403 = cuenta no activada: mensaje específico, no genérico.
            errorBox.textContent = err.message;
            errorBox.classList.remove('hidden');
        } else {
            showErrorToast(err);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleRegisterSubmit() {
    const email = document.getElementById('register-email').value.trim();
    const displayName = document.getElementById('register-displayName').value.trim();
    const password = document.getElementById('register-password').value;
    const errorBox = document.getElementById('register-error');
    const submitBtn = document.querySelector('#register-form button[type="submit"]');

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creando cuenta...';

    try {
        await api.post('/auth/register', { email, displayName, password });
        // El backend NO regresa token al registrarse (a propósito): hay que
        // activar la cuenta por correo antes de poder iniciar sesión.
        document.getElementById('auth-login-view')?.classList.add('hidden');
        document.getElementById('auth-register-view')?.classList.add('hidden');
        document.getElementById('auth-register-success')?.classList.remove('hidden');
    } catch (err) {
        if (errorBox) {
            errorBox.textContent = err.message;
            errorBox.classList.remove('hidden');
        } else {
            showErrorToast(err);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function handleLogout() {
    clearToken();
    currentUser = null;
    renderNav();
    document.dispatchEvent(new CustomEvent('rq:auth-changed', { detail: { currentUser } }));
    showSuccessToast('Sesión cerrada.');
}

document.addEventListener('DOMContentLoaded', initAuth);
