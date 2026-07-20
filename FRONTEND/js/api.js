
const TOKEN_KEY = 'rq_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}


async function apiFetch(path, opts = {}) {
    const { method = 'GET', body, auth = false, isMultipart = false } = opts;

    const headers = {};
    if (!isMultipart && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    if (auth) {
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
        });
    } catch (networkErr) {
        const err = new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
        err.isNetworkError = true;
        throw err;
    }

    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        // Respuestas sin body JSON (ej. 204) — se deja data en null.
    }

    if (!res.ok) {
        const message = (data && data.message) || `Error ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.errores = data && data.errores;
        throw err;
    }

    return data;
}

const api = {
    get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
    put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
    patch: (path, body, opts) => apiFetch(path, { ...opts, method: 'PATCH', body }),
    del: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
};
