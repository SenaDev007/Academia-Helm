import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        const target = (exception.meta as any)?.target?.join(', ') || 'champ unique';
        message = `Conflit : la valeur pour "${target}" existe déjà`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Enregistrement introuvable';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Référence invalide : l\'entité liée n\'existe pas';
        break;
      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message = 'Violation de relation requise';
        break;
      case 'P2004':
        status = HttpStatus.FORBIDDEN;
        message = 'Opération non autorisée sur cette donnée';
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
