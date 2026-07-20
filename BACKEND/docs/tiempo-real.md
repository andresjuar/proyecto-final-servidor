# Funcionalidad de tiempo real: sockets y ciclo de vida de una partida

Este documento explica lo que se agregó en la tercera entrega: envío de correos, autenticación y sockets.

Como se planteó en la propuesta inicial del proyecto, esta parte retoma la lógica de juego desarrollada previamente en la materia de Web. En ese proyecto se utilizó ws en lugar de Socket.io, por lo que en esta versión se adaptó la implementación para trabajar con esta nueva tecnología.

Además, se tiparon las funciones existentes y se ajustaron para seguir los lineamientos de TypeScript.

Por otro lado, se agregaron mejoras, definidas en el scope de este proyecto, como el manejo de reconexión de usuarios y la posibilidad de unirse a partidas en curso, funcionalidades que no estaban contempladas en la versión anterior.

A continuación se explica toda esta funcionalidad.

## 1. Organización del código

```

src/
types/
├── match.types.ts           # Tipos para datos y funciones
sockets/
├── roomState.ts             # Estado en memoria de las salas (Map, no Mongo)
├── game.engine.ts           # Lógica del juego (en memoria)
├── auth.socket.ts           # Middleware para autenticar el handshake
├── index.ts                 # Configuración de sockets: namespace, middleware y handlers
├── **tests**/
│   └── game.engine.spec.ts  # Tests del engine (incompletos)
└── handlers/
├── room.handlers.ts     # Eventos: join, leave, disconnect
└── game.handlers.ts     # Eventos del juego (start, next_question, submit, etc.)

```

## 2. Namespace

Todo corre dentro del namespace `/matches` (`io.of('/matches')`).  
Se separó del namespace principal para evitar mezclar eventos si después se agregan
otras cosas (por ejemplo, notificaciones).

Cada partida usa dos rooms de Socket.io:

- `<roomCode>`: incluye a todos (host y jugadores).
- `<roomCode>::players`: solo jugadores, sin el host.

Esto permite enviar la pregunta con o sin la respuesta correcta dependiendo
de quién la recibe, sin tener que recorrer sockets manualmente.


## 3. Autenticación del handshake (`auth.socket.ts`)

El cliente manda el JWT en `socket.handshake.auth.token`.

- Si el token es válido, se obtiene el usuario desde Mongo y se guarda en `socket.data`.
- Si no hay token, se permite la conexión como invitado.
- Si el token es inválido o expiró, se rechaza la conexión.

La idea es no bloquear desde aquí a los invitados, porque todavía no sabemos
si realmente van a entrar a una sala. Esa validación se hace después.


## 4. Estado en memoria (`roomState.ts`)

El estado de las partidas activas se guarda en memoria, no en Mongo.

Mongo sigue siendo la fuente de verdad (host, código, estado final, etc.),
pero aquí se guarda lo que cambia en tiempo real:

- pregunta actual
- tiempo restante
- respuestas de jugadores
- puntajes parciales

Si el servidor se reinicia, esto se pierde, pero no afecta lo persistente.

Para evitar duplicados al reconectar:
- no se usa `socketId` como identificador, que esto si se usaba en el proyecto del que se basa este, por lo que no existía manera de hacer reconexiones.
- se usa un `identityKey` basado en `userId` o `guestName`

Así, si alguien recarga la página, se reconoce como el mismo jugador.


## 5. Motor del juego (`game.engine.ts`)

Aquí vive la lógica del juego como tal (máquina de estados).

Flujo:

```

lobby -> start -> loading -> question
-> (respuestas / tiempo / forzar) -> reveal
-> leaderboard -> siguiente pregunta
-> finished

```

Este archivo no accede a Mongo directamente.

Cuando algo se necesita guardar (por ejemplo, inicio o fin de partida),
se hace mediante hooks que define `game.handlers.ts`.

Esto permite mantener la lógica separada y facilita hacer pruebas.


## 6. Handlers

### room.handlers.ts
Se encarga de:
- unirse a una sala
- salir de una sala
- manejar desconexiones

Aquí es donde ya se conoce el contexto de la sala y se hacen validaciones
más específicas.


### game.handlers.ts
Conecta los eventos de sockets con el motor del juego:

- `game:start`
- `game:next_question`
- `game:submit_answer`
- etc.

También se encarga de los hooks para persistir en Mongo cuando hace falta.

