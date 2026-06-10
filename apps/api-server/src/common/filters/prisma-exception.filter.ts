import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Catches ALL exception types — Prisma errors, unknown errors, and runtime errors.
 *
 * Previously only caught PrismaClientKnownRequestError and PrismaClientValidationError,
 * which meant PrismaClientUnknownRequestError, PrismaClientInitializationError,
 * and other runtime errors would bypass this filter and become 500 Internal Server Error.
 *
 * Now catches everything and returns meaningful error messages with full error details.
 * HttpExceptions (like BadRequestException) pass through unchanged.
 */
@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // If it's already an HttpException (e.g. BadRequestException from service code),
    // handle it directly — don't re-throw (would cause infinite loop with @Catch()).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      response.status(status).json(
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : exceptionResponse,
      );
      return;
    }

    // ─── PrismaClientValidationError ───────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientValidationError) {
      const rawMsg = exception.message || '';
      const detail = rawMsg.replace(/\n/g, ' ').substring(0, 500);
      this.logger.error(`PrismaClientValidationError FULL: ${rawMsg}`);

      let specificHint = '';
      const unknownArgMatch = rawMsg.match(/Unknown arg `(\w+)`/i);
      const argMatch = rawMsg.match(/Argument `(\w+)`/i);
      const fieldMatch = rawMsg.match(/field `(\w+)`/i);
      const modelMatch = rawMsg.match(/model (\w+)/i);
      const valueMatch = rawMsg.match(/provided (\S+)/i);
      const expectedMatch = rawMsg.match(/Expected (\w+)/i);
      const didYouMeanMatch = rawMsg.match(/Did you mean `(\w+)`\?/i);

      if (unknownArgMatch) {
        specificHint = `Champ inconnu "${unknownArgMatch[1]}"${modelMatch ? ` sur ${modelMatch[1]}` : ''}${didYouMeanMatch ? ` — vouliez-vous "${didYouMeanMatch[1]}" ?` : ''}`;
      } else if (argMatch) {
        specificHint = `Champ "${argMatch[1]}"${modelMatch ? ` sur ${modelMatch[1]}` : ''}${expectedMatch ? ` : attendu ${expectedMatch[1]}` : ''}${valueMatch ? `, valeur fournie ${valueMatch[1]}` : ''}`;
      } else if (fieldMatch) {
        specificHint = `Champ "${fieldMatch[1]}"${modelMatch ? ` sur ${modelMatch[1]}` : ''}`;
      }

      const shortDetail = detail.substring(0, 200);
      const userMessage = specificHint
        ? `Données invalides : ${specificHint} (${shortDetail})`
        : `Données invalides : vérifiez les formats de champs (${shortDetail})`;

      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: userMessage,
        error: 'PrismaClientValidationError',
        detail,
      });
      return;
    }

    // ─── PrismaClientKnownRequestError (P-codes) ─────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
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
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Table de base de données introuvable. Veuillez contacter le support technique.';
          this.logger.error(`P2021 — Missing table: ${exception.message}`);
          break;
        case 'P2022':
          // Column does not exist — missing migration
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          const p2022Meta = exception.meta as any;
          const missingCol = p2022Meta?.column || p2022Meta?.columnName || 'colonne inconnue';
          const missingTable = p2022Meta?.table || p2022Meta?.tableName || '';
          const missingDetail = missingTable ? ` dans la table ${missingTable}` : '';
          message = `Colonne manquante en base de données (${missingCol}${missingDetail}). Une migration est probablement manquante.`;
          this.logger.error(`P2022 — Missing column: ${JSON.stringify(p2022Meta)} | Full: ${exception.message}`);
          break;
        case 'P2024':
          status = HttpStatus.GATEWAY_TIMEOUT;
          message = 'Délai d\'attente dépassé. Veuillez réessayer.';
          this.logger.error(`P2024 — Transaction timeout: ${exception.message}`);
          break;
        case 'P2034':
          status = HttpStatus.CONFLICT;
          message = 'Conflit de transaction. Veuillez réessayer.';
          this.logger.warn(`P2034 — Transaction write conflict: ${exception.message}`);
          break;
        case 'P2028':
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Transaction interrompue. Veuillez réessayer.';
          this.logger.error(`P2028 — Transaction aborted: ${exception.message}`);
          break;
        default:
          this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`, exception.stack);
          message = `Erreur Prisma ${exception.code}: ${exception.message?.substring(0, 200)}`;
          break;
      }

      response.status(status).json({
        statusCode: status,
        message,
        error: exception.code,
      });
      return;
    }

    // ─── Other Prisma errors (UnknownRequest, Initialization, etc.) ──────
    if (exception?.constructor?.name?.startsWith('PrismaClient')) {
      const errorType = exception.constructor.name;
      const rawMsg = exception.message || '';
      const detail = rawMsg.replace(/\n/g, ' ').substring(0, 500);
      this.logger.error(`${errorType}: ${rawMsg}`, exception.stack);

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Erreur base de données (${errorType}): ${detail.substring(0, 200)}`,
        error: errorType,
        detail,
      });
      return;
    }

    // ─── Catch-all: unknown runtime errors ────────────────────────────────
    const errorType = exception?.constructor?.name || 'UnknownError';
    const rawMsg = exception?.message || String(exception);
    const detail = rawMsg.replace(/\n/g, ' ').substring(0, 500);
    this.logger.error(`UNHANDLED ${errorType}: ${rawMsg}`, exception?.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: `Erreur interne (${errorType}): ${detail.substring(0, 200)}`,
      error: errorType,
      detail,
    });
  }
}
