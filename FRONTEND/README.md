# RicoQuiz+ — Frontend

Frontend en HTML/CSS/JS puro (sin frameworks, sin build tools) para el backend
de RicoQuiz+. Estilo visual tomado del proyecto anterior (Web-Game): fondo
morado con puntos, tarjetas blancas con borde negro grueso y sombra dura,
Fredoka One + Nunito.

## Cómo servirlo (recomendado)

Para evitar problemas de CORS (el backend actual no tiene el middleware
`cors()` para las rutas REST, solo Socket.io lo tiene configurado), lo más
simple es servir esta carpeta desde el MISMO servidor Express, para que quede
en el mismo origen.

Agrega esto en `src/app.ts` del backend, dentro de `createApp()` (antes de
`app.use(router)`):

```ts
import path from 'path';
import express from 'express';
// ...
app.use(express.static(path.join(__dirname, '../../FRONTEND')));
// (ajusta la ruta relativa según dónde pongas esta carpeta FRONTEND)
```

Con eso, abriendo `http://localhost:3000/index.html` todo funciona: las
llamadas `fetch` son same-origin, y los sockets ya tenían CORS `*` por
default.

Si prefieres servirlo de otra forma (Live Server en otro puerto, etc.), vas a
necesitar agregar `cors()` a las rutas REST del backend, o los `fetch` van a
fallar. En ese caso, cambia `API_BASE_URL` en `js/config.js` por la URL
completa del backend.

## Estructura

```
index.html          Home: iniciar/unirse/explorar + modal de login/registro
explore.html         Explorador de quizzes públicos + modal de detalle
create-quiz.html     Formulario para crear un quiz manualmente
room.html            Sala/partida: toda la máquina de estados del juego

css/style.css        Estilos compartidos

js/config.js         URLs del backend
js/api.js            Wrapper de fetch (maneja JWT, errores del backend)
js/toast.js          Notificaciones de error/éxito
js/auth.js           Sesión compartida: login/registro/logout, navbar
js/quiz-explorer.js  Búsqueda/grilla/modal de detalle de quizzes (compartido
                     entre explore.html y el selector de quiz en la sala)
js/home.js           Lógica de index.html
js/explore.js        Lógica de explore.html
js/create-quiz.js    Lógica de create-quiz.html
js/room.js           Lógica de room.html (la más compleja)
```

## Decisiones y simplificaciones tomadas

- **Sesión**: el JWT se guarda en `localStorage` (`rq_token`). Al cargar
  cualquier página, se valida contra `GET /auth/me` + `GET /users/:id` (el
  primero solo trae `{id, email}`, el segundo trae `displayName`/`avatarUrl`).
- **Reconexión de invitados**: como el backend identifica a los invitados por
  `guestName` normalizado (no por socketId), el nombre se guarda en
  `localStorage` como `rq_guest_<CODE>` para que un refresh a media partida
  pueda reconectarse con la misma identidad. Los usuarios logueados no
  necesitan esto (se identifican por su JWT).
- **matchId del host**: se guarda en `localStorage` como `rq_matchid_<CODE>`
  al crear la partida, porque los eventos de socket no lo incluyen — se
  necesita para las llamadas REST (`PATCH /matches/:id/quiz`,
  `POST /matches/:id/generate-quiz`, `GET /matches/:id`).
- **"Mis quizzes" en el lobby**: como `GET /quizzes` siempre filtra
  `isPublic: true` (no hay forma de listar tus propios quizzes privados por
  ese endpoint), se usa `GET /users/:id` para sacar los ids de
  `createdQuizzes` y se piden uno por uno con `GET /quizzes/:id` (este sí
  funciona sin importar `isPublic`).
- **Reconexión mid-pregunta/reveal**: el `sync` que manda el servidor al
  reconectar (`room:joined_ok`) no incluye si el host ve el `correctIndex`
  durante una pregunta activa (`RoomSyncData` solo tiene la versión pública de
  la pregunta), ni si el jugador ya acertó/falló al reconectar en pleno
  reveal. Son limitaciones del contrato de sockets tal como está, no del
  frontend — se simplificó mostrando el estado general sin ese detalle extra
  en esos casos específicos de reconexión.
- Todo se mantiene deliberadamente simple (sin animaciones ni
  micro-interacciones), como pediste.
