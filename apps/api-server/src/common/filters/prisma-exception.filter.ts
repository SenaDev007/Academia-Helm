import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Catches both PrismaClientKnownRequestError (P-codes) and PrismaClientValidationError.
 * PrismaClientValidationError occurs when data types don't match the schema
 * (e.g. passing "2025-03-15" as a string for a DateTime field).
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle PrismaClientValidationError (bad data types, missing required fields, etc.)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      const rawMsg = exception.message || '';
      const detail = rawMsg.replace(/\n/g, ' ').substring(0, 500);
      this.logger.warn(`PrismaClientValidationError: ${detail}`);

      // Extract the specific field name from the Prisma error message
      // Typical format: "Argument `salary`: Invalid value provided. Expected Decimal, provided ..."
      // Or: "Unknown arg `xyz` in data.x for model Staff."
      let specificHint = '';
      const argMatch = rawMsg.match(/Argument `(\w+)`/i);
      const fieldMatch = rawMsg.match(/field `(\w+)`/i);
      const modelMatch = rawMsg.match(/model (\w+)/i);
      const valueMatch = rawMsg.match(/provided (\S+)/i);
      const expectedMatch = rawMsg.match(/Expected (\w+)/i);
      const unknownArgMatch = rawMsg.match(/Unknown arg `(\w+)`/i);

      if (unknownArgMatch) {
        specificHint = `Champ inconnu "${unknownArgMatch[1]}"`;
      } else if (argMatch) {
        specificHint = `Champ "${argMatch[1]}"${expectedMatch ? ` : attendu ${expectedMatch[1]}` : ''}${valueMatch ? `, valeur fournie ${valueMatch[1]}` : ''}`;
      } else if (fieldMatch) {
        specificHint = `Champ "${fieldMatch[1]}"${modelMatch ? ` sur ${modelMatch[1]}` : ''}`;
      }

      const userMessage = specificHint
        ? `Données invalides : ${specificHint}`
        : `Données invalides : vérifiez les formats de champs (dates, nombres, etc.)`;

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: userMessage,
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
      case 'P2021':
        // Table does not exist — likely a missing migration
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Table de base de données introuvable. Veuillez contacter le support technique.';
        this.logger.error(`P2021 — Missing table: ${exception.message}`);
        break;
      case 'P2022':
        // Column does not exist — missing migration
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        const missingCol = (exception.meta as any)?.column || 'colonne inconnue';
        message = `Colonne manquante en base de données (${missingCol}). Une migration est probablement manquante.`;
        this.logger.error(`P2022 — Missing column: ${exception.message}`);
        break;
      case 'P2024':
        // Transaction timeout
        status = HttpStatus.GATEWAY_TIMEOUT;
        message = 'Délai d\'attente dépassé. Veuillez réessayer.';
        this.logger.error(`P2024 — Transaction timeout: ${exception.message}`);
        break;
      case 'P2034':
        // Transaction write conflict (retry)
        status = HttpStatus.CONFLICT;
        message = 'Conflit de transaction. Veuillez réessayer.';
        this.logger.warn(`P2034 — Transaction write conflict: ${exception.message}`);
        break;
      case 'P2028':
        // Transaction aborted (interactive)
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Transaction interrompue. Veuillez réessayer.';
        this.logger.error(`P2028 — Transaction aborted: ${exception.message}`);
        break;
      default:
        // Log unhandled Prisma error codes for debugging
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`, exception.stack);
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
