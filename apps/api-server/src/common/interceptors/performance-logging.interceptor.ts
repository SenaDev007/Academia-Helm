import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor de profiling pour mesurer les temps de réponse des routes API
 * 
 * Objectif: Identifier les routes lentes (> 500ms)
 * 
 * Usage: Appliqué globalement dans app.module.ts
 */
@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const route = `${method} ${url}`;
          
          // Logger uniquement les routes lentes (> 500ms) ou en mode debug
          if (duration > 500 || process.env.LOG_PERFORMANCE === 'true') {
            this.logger.warn(
              `⚠️  SLOW ROUTE: ${route} took ${duration}ms`,
            );
          } else if (process.env.LOG_ALL_ROUTES === 'true') {
            this.logger.log(`✓ ${route} - ${duration}ms`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const route = `${method} ${url}`;
          this.logger.error(
            `✗ ${route} FAILED after ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
