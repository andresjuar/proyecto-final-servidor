# Diseño inicial de la base de datos

Base de datos: **MongoDB** (NoSQL, documentos), gestionada con **Mongoose**
como ODM. Se eligió MongoDB por la naturaleza semi-estructurada de los
quizzes (número variable de preguntas y opciones por pregunta).
A continuación, se muestra el diagrama ER de la base de datos.


![Diagrama ER](./Diagrama%20ER.jpg)


## Modelos

### User

| Campo            | Tipo                  | Notas                                             |
| ---------------- | --------------------- | -------------------------------------------------- |
| `email`          | `String`, requerido    | único, formato validado                            |
| `displayName`    | `String`, requerido    | 2–50 caracteres                                    |
| `password`       | `String`, requerido    | hasheado con bcrypt, oculto por defecto en queries |
| `avatarUrl`      | `String`, opcional     | default `''`                                       |
| `createdQuizzes` | `[ObjectId]` → `Quiz` | quizzes creados por el usuario                     |

Actualmente todo usuario se registra con email + contraseña
(`POST /auth/register`). 

### Quiz

| Campo            | Tipo                | Notas                                   |
| ---------------- | ------------------- | ---------------------------------------- |
| `title`          | `String`, requerido  | 3–100 caracteres                         |
| `owner`          | `ObjectId` → `User`  | se asigna desde el usuario autenticado (JWT)|
| `questions`      | `[Question]`         | subdocumento embebido, mínimo 1 pregunta |
| `isPublic`       | `Boolean`            | default `false`                          |
| `tags`           | `[String]`           |                                           |
| `timesPlayed`    | `Number`             | default `0`                              |

Cada `Question` embebida tiene `question`, `options[]` (mínimo 2),
`correctIndex` (validado contra el largo de `options`), y
`timeLimitSeconds` (5–120, default 20). Mejor explicados en `http://localhost:3000/api-docs` una vez iniciado el proyecto

### Match

| Campo      | Tipo                     | Notas                                                |
| ---------- | ------------------------ | ----------------------------------------------------- |
| `quiz`     | `ObjectId` -> `Quiz`       | requerido                                              |
| `host`     | `ObjectId` →/> `User`       | se asigna desde el usuario autenticado (JWT), no desde el body |
| `roomCode` | `String`, 4 letras         | único mientras el status es `waiting`/`in_progress`   |
| `status`   | enum                      | `waiting` \| `in_progress` \| `finished` \| `cancelled` |
| `players`  | `[Player]`                | subdocumento embebido                                  |

Cada `Player` embebido tiene `user` (opcional, `ObjectId` -> `User`) o
`guestName` (requerido solo si no hay `user`) - permite jugadores invitados
sin cuenta.

## Relaciones

```
User 1---N Quiz        (Quiz.owner)
User 1---N Match        (Match.host)
Quiz 1---N Match        (Match.quiz)
User 1---N Match.players (Match.players[].user, opcional)
```