# proyecto-final-servidor
<<<<<<< Updated upstream

Plataforma de trivia interactivas en tiempo real. Proyecto integrador de la
materia Tecnologías de Desarrollo en el Servidor.

**Autores:** Andrés Juárez, Adán Juárez Jr

## Stack de tecnologías

| Capa                         | Tecnología                             |
| ---------------------------- | -------------------------------------- |
| Lenguaje                     | TypeScript                             |
| Backend                      | Node.js, Express.js (arquitectura MVC) |
| Base de datos                | MongoDB + Mongoose                     |
| Tiempo real                  | Socket.io                              |
| Autenticación                | OAuth 2.0 con Google                   |
| IA (generación de preguntas) | Gemini API                             |
| Almacenamiento de imágenes   | Cloudinary / Supabase                  |
| Documentación de API         | Swagger (OpenAPI 3.0)                  |
| Pruebas                      | Jest                                   |
| Calidad de código            | ESLint + Prettier                      |
| CI/CD                        | GitHub Actions (por configurar)        |
| Despliegue                   | Aun no definido                        |

## Configuración local

1. Clonar el repositorio y entrar a la carpeta del servidor:

    ```bash
    git clone <url-del-repo>
    cd proyecto-final-servidor
    ```

2. Instalar dependencias:

    ```bash
    npm install
    ```

3. Copiar el archivo de variables de entorno y llenarlo:

    ```bash
    cp .env.example .env
    ```

4. Levantar el servidor en modo desarrollo:

    ```bash
    npm run dev
    ```

5. El servidor queda disponible en `http://localhost:3000` y la documentación
   interactiva de la API en `http://localhost:3000/api-docs`.

## Scripts Disponibles

<!-- TODO: Hacer tabla con los scripts que tenemos y en este estilo -->

| Script        | Descripción                                                   |
| ------------- | ------------------------------------------------------------- |
| `npm run dev` | Levanta el servidor en modo desarrollo con recarga automática |

## Documentación

- [Diseño inicial de la base de datos](./docs/database.md)
- [Tablero de trabajo](./docs/tablero-trabajo.md)
=======
>>>>>>> Stashed changes
