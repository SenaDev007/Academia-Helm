import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap, finalize } from 'rxjs/operators';

/**
 * ============================================================================
 * LIMITEUR DE CONNEXIONS SIMULTANÉES PAR UTILISATEUR — SÉMAPHORE + FILE
 * ============================================================================
 *
 * ⭐ CAPACITÉ 20/50/100 ÉCOLES (fix concurrence SaaS multi-tenant) :
 *
 * Le SmartThrottlerGuard borne déjà le DÉBIT par utilisateur (30 req/s,
 * 600 req/min, 5000 req/h). Mais un utilisateur peut légitimement émettre
 * une rafale de 20-40 requêtes PARALLÈLES au chargement d'un dashboard
 * (mesuré audit perf 2026-09-07). Sur des endpoints lents (exports Excel,
 * PDF Puppeteer ~5-10 s, requêtes analytiques), 30 req/s × 8 s = jusqu'à
 * 240 requêtes SIMULTANÉMENT en traitement pour UN SEUL utilisateur —
 * ce qui sature l'event loop, le pool Postgres (40) et dégrade TOUS les
 * tenants partageant l'instance.
 *
 * Cet interceptor borne la CONCURRENCE IN-FLIGHT par clé :
 *   - `u:<userId>` : 20 requêtes en traitement simultané (USER_MAX_CONCURRENT)
 *   - `ip:<ip>`    : 40 (routes publiques ; bucket partagé par les IP
 *     sortantes Vercel du BFF — le login d'une école entière passe par là)
 *
 * ⚠️ FILE D'ATTENTE, PAS DE 429 BRUTAL :
 * La 21e requête d'un utilisateur légitime (rafale dashboard) n'est PAS
 * rejetée : elle patiente dans une file FIFO jusqu'à ce qu'un slot se
 * libère (les requêtes précédentes durent typiquement 200-500 ms →
 * l'attente réelle est ~100-300 ms). Le 429 n'arrive que si :
 *   - l'attente dépasse CONCURRENT_QUEUE_WAIT_MS (10 s) → quelque chose
 *     est réellement bloqué côté serveur, ou
 *   - la file dépasse CONCURRENT_MAX_QUEUED (30) → abus (script, bot).
 *
 * Différence avec le throttler : le throttler limite le NOMBRE de requêtes
 * par fenêtre temporelle ; cet interceptor limite le nombre de requêtes
 * EN COURS D'EXÉCUTION — c'est ce qui protège la mémoire, le pool et la CPU.
 *
 * Sécurité mémoire :
 *   - les compteurs retombent à zéro via `finalize` (émission OU erreur) ;
 *   - un balayage périodique réinitialise les compteurs « coincés »
 *     (finalize manquant, bug driver) : toute requête est bornée à 30 s
 *     (timeout applicatif) → un compteur inchangé depuis > 120 s est mort ;
 *   - les entrées vides sont purgées après 5 min d'inactivité.
 *
 * Ne s'applique PAS : requêtes non-HTTP (WebSocket Socket.io — limité côté
 * gateway), OPTIONS (préflight CORS), GET /health et GET / (healthchecks
 * Railway — aucune raison de les compter).
 */

/** Compteur de slots par clé (utilisateur ou IP). */
interface ConcurrencySlot {
  /** Limite appliquée à cette clé (20 utilisateur / 40 IP). */
  limit: number;
  /** Requêtes actuellement en traitement. */
  count: number;
  /** File d'attente FIFO (résolveurs des requêtes en attente de slot). */
  waiters: Array<{
    settle: (acquired: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
    settled: boolean;
  }>;
  /** Dernier changement (count/waiters) — pour le balayage anti-fuite. */
  lastChange: number;
}

@Injectable()
export class ConcurrentConnectionInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ConcurrentLimit');

  /** Clé → slots. Taille bornée par le balayage périodique. */
  private readonly slots = new Map<string, ConcurrencySlot>();

  // ── Paramètres configurables (env) ─────────────────────────────────────
  private readonly userLimit =
    this.parsePositiveInt(process.env.USER_MAX_CONCURRENT, 20);
  private readonly ipLimit =
    this.parsePositiveInt(process.env.IP_MAX_CONCURRENT, 40);
  /** Attente max en file avant 429 (ms) — couvre de loin le pire cas lent (30 s timeout). */
  private readonly queueWaitMs =
    this.parsePositiveInt(process.env.CONCURRENT_QUEUE_WAIT_MS, 10_000);
  /** File max par clé avant 429 immédiat (anti-saturation mémoire). */
  private readonly maxQueued =
    this.parsePositiveInt(process.env.CONCURRENT_MAX_QUEUED, 30);

  /** Statistiques pour la supervision (logs). */
  private readonly stats = { queued: 0, rejected: 0, swept: 0 };

  constructor() {
    // Balayage anti-fuite : un compteur inchangé depuis > 120 s avec des
    // slots occupés est forcément mort (toute requête est bornée à 30 s).
    const sweeper = setInterval(() => this.sweep(), 60_000);
    sweeper.unref?.(); // ne doit pas empêcher le process de sortir
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // WebSocket / RPC / autres protocoles : hors périmètre HTTP.
    if (context.getType<string>() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Préflights CORS et healthchecks : jamais comptés ni limités.
    if (method === 'OPTIONS') return next.handle();
    const path: string = url?.split('?')[0] ?? '';
    if (method === 'GET' && (path === '/health' || path === '/')) {
      return next.handle();
    }

    // Même clé que SmartThrottlerGuard : utilisateur authentifié d'abord
    // (les guards courent AVANT les intercepteurs → req.user est déjà posé
    // par JwtAuthGuard), sinon l'IP réelle (trust proxy dans main.ts).
    const userId = request?.user?.id;
    const isUser =
      typeof userId === 'string' && userId.length > 0;
    const key = isUser
      ? `u:${userId}`
      : `ip:${request.ip ?? 'unknown'}`;
    const limit = isUser ? this.userLimit : this.ipLimit;

    return this.acquireSlot(key, limit).pipe(
      mergeMap(() =>
        next.handle().pipe(
          finalize(() => this.releaseSlot(key)),
        ),
      ),
    );
  }

  /**
   * Observable qui n'émet QUAND un slot est acquis :
   * immédiatement si < limit, sinon après la file (FIFO), erreur 429 si
   * l'attente dépasse queueWaitMs ou que la file est pleine.
   */
  private acquireSlot(key: string, limit: number): Observable<void> {
    return new Observable<void>((subscriber) => {
      let entry = this.slots.get(key);
      if (!entry) {
        entry = { limit, count: 0, waiters: [], lastChange: Date.now() };
        this.slots.set(key, entry);
      }
      entry.lastChange = Date.now();

      // Slot libre → acquisition immédiate (cas normal, 99,9 % des requêtes).
      if (entry.count < entry.limit) {
        entry.count++;
        subscriber.next();
        subscriber.complete();
        return;
      }

      // File pleine → abus réel (script / onglets en masse) : 429 immédiat.
      if (entry.waiters.length >= this.maxQueued) {
        this.stats.rejected++;
        this.logger.warn(
          `[CONCURRENT] REJET file pleine (${entry.waiters.length} en attente) — ${key}`,
        );
        this.reply429(subscriber, entry.limit);
        return;
      }

      // File d'attente : la requête patiente jusqu'à libération d'un slot.
      this.stats.queued++;
      this.logger.warn(
        `[CONCURRENT] File d'attente ${key} (${entry.count}/${entry.limit} en traitement, ${entry.waiters.length + 1} en attente)`,
      );

      const waiter = {
        settle: (acquired: boolean) => {
          if (waiter.settled) return;
          waiter.settled = true;
          clearTimeout(waiter.timer);
          if (acquired) {
            subscriber.next();
            subscriber.complete();
          } else {
            this.reply429(subscriber, entry!.limit);
          }
        },
        timer: setTimeout(() => {
          // Attente dépassée → libérer la place et rejeter proprement.
          const idx = entry!.waiters.indexOf(waiter);
          if (idx >= 0) entry!.waiters.splice(idx, 1);
          this.stats.rejected++;
          waiter.settle(false);
        }, this.queueWaitMs),
        settled: false,
      };
      entry.waiters.push(waiter);

      // Annulation client (déconnexion pendant l'attente) : retirer la place.
      return () => {
        if (waiter.settled) return;
        waiter.settled = true;
        clearTimeout(waiter.timer);
        const idx = entry!.waiters.indexOf(waiter);
        if (idx >= 0) entry!.waiters.splice(idx, 1);
        subscriber.complete(); // ne déclenche PAS le mergeMap → pas de handler
      };
    });
  }

  /** Libère un slot et réveille les requêtes en file (FIFO, dans la limite). */
  private releaseSlot(key: string): void {
    const entry = this.slots.get(key);
    if (!entry) return;
    entry.lastChange = Date.now();
    if (entry.count > 0) entry.count--;

    while (entry.waiters.length > 0 && entry.count < entry.limit) {
      const waiter = entry.waiters.shift();
      if (!waiter || waiter.settled) continue;
      entry.count++;
      waiter.settle(true);
    }

    // Nettoyage mémoire : entrée vide et calme depuis 5 min.
    if (
      entry.count === 0 &&
      entry.waiters.length === 0 &&
      Date.now() - entry.lastChange > 5 * 60_000
    ) {
      this.slots.delete(key);
    }
  }

  /** Balayage anti-fuite : réinitialise les compteurs coincés (> 120 s inchangés). */
  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.slots) {
      const idle = now - entry.lastChange;
      if (idle > 5 * 60_000 && entry.count === 0 && entry.waiters.length === 0) {
        this.slots.delete(key);
        continue;
      }
      // 30 s de timeout applicatif par requête → 120 s sans changement
      // avec des slots occupés = finalize perdu (bug driver, crash handler).
      if (idle > 120_000 && (entry.count > 0 || entry.waiters.length > 0)) {
        this.stats.swept++;
        this.logger.warn(
          `[CONCURRENT] Balayage : compteur coincé réinitialisé (${entry.count} slots, ${entry.waiters.length} en file) — ${key}`,
        );
        for (const waiter of entry.waiters.splice(0)) {
          waiter.settle(false);
        }
        entry.count = 0;
        entry.lastChange = now;
      }
    }
  }

  /** Réponse 429 standardisée avec Retry-After (le client retry-safe l'honore). */
  private reply429(
    subscriber: { error: (err: unknown) => void },
    limit: number,
  ): void {
    subscriber.error(
      new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Concurrent Requests',
          message: `Trop de requêtes simultanées (max ${limit} en traitement). Réessayez dans un instant.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
