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
