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