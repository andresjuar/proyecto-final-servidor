# Arquitectura del sistema

## Idea general del proyecto

RicoQuiz+ está construido siguiendo una arquitectura **MVC** sobre Node.js y Express. La comunicación con el cliente se divide en dos partes: por un lado, **REST**, que se usa para operaciones como autenticación y manejo de datos; y por otro, **WebSockets con Socket.io**, que se encarga de todo lo que ocurre en tiempo real dentro del juego (lobby, preguntas, puntajes y reconexión de jugadores).

## Decisiones de diseño

* Se utilizó **TypeScript en modo estricto** (`strict: true`) para evitar errores en tiempo de ejecución. En la versión anterior en JavaScript hubo varios problemas relacionados con referencias y sincronización de datos.
* Se organizó el proyecto con una **arquitectura MVC**, separando rutas, controladores y modelos. Esto facilita probar cada parte por separado.
* Se eligió **Socket.io en lugar de `ws`** porque simplifica la reconexión automática y el manejo de salas, lo cual en la versión anterior se hacía manualmente.
* La **documentación de la API se genera con Swagger** a partir de comentarios en el código, para mantenerla siempre actualizada.

## Autenticación

* Se implementó autenticación con **JWT** usando `jsonwebtoken`. El token incluye solo la información necesaria (`id` y `email`).
* Las contraseñas se almacenan usando **bcrypt**, aplicando el hash en un middleware del modelo `User`.
* El middleware `authMiddleware` valida el token enviado en el header `Authorization` y agrega la información del usuario a `req.user`.
* Los campos como `owner` o `host` no se reciben desde el cliente, sino que se obtienen directamente del token para evitar suplantación de identidad.

## Activación de cuenta por correo

Para la funcionalidad de activación de cuenta se implementó lo siguiente:

* El campo `User.isActive` se inicializa en `false`. Al registrarse, el usuario recibe un correo con un enlace de activación, pero no se le entrega un token de sesión en ese momento.
* El endpoint `POST /auth/login` devuelve un error 403 si la cuenta no está activada.
* El enlace de activación utiliza un **JWT con un secreto distinto** al de autenticación, evitando que se use como token de sesión.
* El envío de correos se realiza con **nodemailer**, configurado mediante variables de entorno.
* Si ocurre un error al enviar el correo, la cuenta se crea de todas formas, pero queda inactiva.
* Existe un endpoint (`POST /auth/resend-activation`) para reenviar el correo. Este responde siempre con el mismo mensaje, sin indicar si el correo existe o no, para evitar exponer información.
