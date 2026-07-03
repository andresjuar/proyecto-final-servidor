# Diseño inicial de la base de datos

Base de datos: **MongoDB** (NoSQL, documentos), gestionada con **Mongoose**
como ODM. Se eligió MongoDB por la naturaleza semi-estructurada de los
quizzes (número variable de preguntas y opciones por pregunta) y porque el
proyecto requiere iterar rápido el esquema conforme se agreguen modos de
juego (Liar Game, etc.).

A continuación, se muestra el diagrama ER de la base de datos
![Diagrama ER](./Diagrama%20ER.jpg)