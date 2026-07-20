# Arquitectura del sistema

## Idea General del Proyecto

RicoQuiz+ sigue una arquitectura **MVC** sobre Node.js/Express, con dos
canales de comunicación con el cliente: **REST** (operaciones CRUD y auth) y
**WebSockets con Socket.io** (juego en tiempo real: lobby, preguntas,
puntajes, reconexión).

## Decisiones de diseño

- **TypeScript estricto** (`strict: true`) para reducir errores en tiempo de
  ejecución, dado que el proyecto original en JavaScript no tenía tipado y
  eso generó varios bugs de referencias (`sockets`, IDs de jugadores
  desincronizados en el leaderboard).
- **Arquitectura MVC** con separación clara de rutas/controladores/modelos
  para poder testear cada capa de forma aislada con Jest.
- **Socket.io en vez de `ws` puro**: simplifica reconexión automática,
  _rooms_ nativos y _namespaces_, resolviendo de raíz el problema de
  reconexión entre páginas que se manejaba manualmente en la versión anterior.
- **Documentación Swagger generada desde el código** (JSDoc en las rutas)
  para que la documentación de la API no se desincronice del código real.

## Autenticación

- **JWT stateless** (`jsonwebtoken`), firmado con un secreto en variable de
  entorno (`JWT_SECRET`). El payload solo incluye `id` y `email` del
  usuario — lo mínimo necesario para identificarlo en rutas protegidas, sin
  exponer datos sensibles dentro del token.
- **Contraseñas hasheadas con `bcrypt`** en un middleware `pre('save')` del
  modelo `User`, para que el hash ocurra siempre en un solo lugar sin
  depender de que cada controller se acuerde de hacerlo.
- **Middleware `authMiddleware`** valida el header `Authorization: Bearer
  <token>` y adjunta el usuario decodificado a `req.user`, usando una
  extensión de tipos de Express (`src/types/express/index.d.ts`) en vez de
  una interfaz de `Request` separada — así cualquier controller normal
  tipado con `Request` ya tiene acceso a `req.user` sin fricción con
  `asyncHandler`.
- **Owner/host desde el token, no desde el body**: tanto `Quiz.owner` como
  `Match.host` se toman de `req.user.id` en vez de que el cliente los mande
  manualmente — evita que alguien cree un quiz o una partida a nombre de
  otro usuario.
- **Login con Google**: el modelo ya contempla `googleId` (opcional, único),
  y las rutas `/auth/google` / `/auth/google/callback` existen como dummy.
  La implementación real (verificación de ID token con
  `google-auth-library`) queda fuera del alcance de esta entrega.

## Activación de cuenta por correo
 
Para la entrega de creación de funcionalidades se creó lo siguiente:
 
- **`User.isActive`** (default `false`). `POST /auth/register` crea la cuenta
  ya con `isActive:false` y manda un correo con un link de activación —
  **a propósito no regresa un token de sesión en esa respuesta**: si lo
  regresara, cualquiera podría saltarse la verificación con solo registrarse
  y usar ese token directo, sin necesidad de abrir el correo.
- **`POST /auth/login` rechaza con 403** (no 401 — las credenciales sí son
  correctas, lo que falta es el estado de la cuenta) si `isActive` es
  `false`, con un mensaje que invita a revisar el correo.
- **El link de activación (`GET /auth/activate/:token`) usa un JWT, pero
  firmado con un secreto DISTINTO** al de las sesiones
  (`ACTIVATION_TOKEN_SECRET`, derivado de `JWT_SECRET` si no se define uno
  aparte) y con un campo `purpose` que se valida explícitamente
  (`src/utils/activationToken.ts`). Esto evita que un link de activación
  pueda reutilizarse como si fuera un `Bearer token` válido para la API, algo
  que sí pasaría si se usara `generarTokenJWT`/`verificarTokenJWT` tal cual
  (mismo secreto, mismo formato de payload). Queda probado explícitamente en
  `src/utils/__tests__/activationToken.spec.ts`.
- **Envío de correo vía SMTP con `nodemailer`** (`src/services/Mail.service.ts`),
  configurable por variables de entorno (`SMTP_HOST/PORT/USER/PASS`,
  `MAIL_FROM`). Puede reusarse la misma cuenta de Gmail + App Password que ya
  se configuró para las notificaciones de GitHub Actions (Práctica 2,
  `dawidd6/action-send-mail`) — es la misma idea, solo que aquí la usa
  directamente el backend en vez de un workflow de CI.
- **Si el envío del correo falla** (SMTP caído, credenciales mal puestas,
  etc.), el registro **no se cancela**: la cuenta queda creada pero inactiva,
  y el error solo se loguea en el servidor. Botar todo el registro por un
  problema de correo sería peor experiencia que dejar la cuenta pendiente de
  activar.
- **`POST /auth/resend-activation`** reenvía el correo si no llegó o expiró.
  Responde **siempre el mismo mensaje genérico**, sin importar si el correo
  existe, ya está activo, o se reenvió de verdad — mismo criterio que
  "recuperar contraseña" en cualquier sistema serio, para que este endpoint
  no se pueda usar para averiguar qué correos están registrados.