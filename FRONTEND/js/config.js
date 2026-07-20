// config.js
//
// Si sirves este frontend desde el MISMO servidor Express que el backend
// (recomendado, ver README.md), deja API_BASE_URL vacío: las peticiones
// fetch usarán el mismo origen donde se abrió la página, y no hay
// problemas de CORS.
//
// Si en algún momento lo sirves desde otro puerto/servidor, pon aquí
// la URL completa del backend, ej: 'http://localhost:3000'
// (nota: en ese caso hay que agregar el middleware `cors()` en el backend,
// porque ahorita solo Socket.io tiene CORS configurado, la API REST no).

const API_BASE_URL = '';

const SOCKET_URL = API_BASE_URL || window.location.origin;
const SOCKET_NAMESPACE = '/matches';
