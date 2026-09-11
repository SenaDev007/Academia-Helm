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
 * ⭐ BRIEF PERF 3.5 — Instrumentation horodatée du temps de réponse par
 * endpoint, pour corréler un signalement utilisateur (« ça a ramé à telle
 * heure ») avec les métriques serveur.
 *
 * - Seuil configurable : SLOW_ROUTE_THRESHOLD (ms, défaut 500 — critère de
 *   validation du brief : aucune route > 500ms en usage normal)
 * - LOG_PERFORMANCE=true → loggue TOUTES les routes
 * - Format : [PERF] méthode route statut durée tenant user timestamp
 * - Le logging des requêtes SQL lentes (> SLOW_QUERY_THRESHOLD, défaut 500ms)
 *   est assuré côté PrismaService ($extends) — les deux logs se corrèlent
 *   par horodatage.
 */
@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThreshold = parseInt(process.env.SLOW_ROUTE_THRESHOLD || '500', 10);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    // Contexte de corrélation (identiques aux guards/interceptors existants)
    const tenantId = request['tenantId'] ? String(request['tenantId']).slice(0, 8) : '-';
    const userId = request['user']?.id ? String(request['user'].id).slice(0, 8) : '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const route = `${method} ${url}`;

          // Logger uniquement les routes lentes (>= seuil) ou en mode debug
          if (duration >= this.slowThreshold || process.env.LOG_PERFORMANCE === 'true') {
            this.logger.warn(
              `[PERF] ${route} — ${duration}ms (seuil ${this.slowThreshold}ms) tenant=${tenantId} user=${userId}`,
            );
          } else if (process.env.LOG_ALL_ROUTES === 'true') {
            this.logger.log(`[PERF] ${route} — ${duration}ms tenant=${tenantId} user=${userId}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const route = `${method} ${url}`;
          const status = error?.status || error?.getStatus?.() || 500;
          this.logger.error(
            `[PERF] ${route} — ÉCHEC ${status} après ${duration}ms tenant=${tenantId} user=${userId} — ${error?.message?.substring(0, 200)}`,
          );
        },
      }),
    );
  }
}
