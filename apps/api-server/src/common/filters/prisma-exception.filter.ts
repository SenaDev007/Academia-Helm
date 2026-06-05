import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Catches both PrismaClientKnownRequestError (P-codes) and PrismaClientValidationError.
 * PrismaClientValidationError occurs when data types don't match the schema
 * (e.g. passing "2025-03-15" as a string for a DateTime field).
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle PrismaClientValidationError (bad data types, missing required fields, etc.)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      const detail = exception.message?.replace(/\n/g, ' ').substring(0, 300);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Données invalides : vérifiez les formats de champs (dates, nombres, etc.)`,
        error: 'PrismaClientValidationError',
        detail,
      });
      return;
    }

    // Handle PrismaClientKnownRequestError (P-codes)
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
        const fkDetail = (exception.meta as any)?.field_name || (exception.meta as any)?.constraint || '';
        message = `Référence invalide : l'entité liée n'existe pas${fkDetail ? ` (${fkDetail})` : ''}`;
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
