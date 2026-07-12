import { Request, Response, NextFunction, RequestHandler } from 'express';

/* 
    Esta función es un wrapper que nos ayuda en los crud para no repetir el bloque try catch en cada 
    método, cuando se tiene que hacer una búsqueda, escritura etc.
*/
export function asyncHandler(funcion: RequestHandler) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(funcion(req, res, next)).catch(next);
    };
}
