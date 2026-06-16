/**
 * ============================================================================
 * PROXY SSE — HR COPILOT STREAMING (Sarah Assistante RH)
 * ============================================================================
 *
 * Route dédiée pour le streaming SSE du Copilote RH.
 * Le proxy catch-all `/api/hr/[...path]/route.ts` parse le body en JSON et
 * ne préserve pas le flux SSE — d'où la nécessité d'une route dédiée qui
 * stream les chunks `data: {...}\n\n` tels quels vers le client.
 *
 * Flux :
 *   Client (browser)
 *     ↓ POST /api/hr/ia/copilot/stream (avec Authorization Bearer)
 *   Next.js BFF (cette route)
 *     ↓ POST {API_BASE}/hr/ia/copilot/stream (avec Authorization du cookie)
 *   NestJS IaPrismaController.copilotChatStream
 *     ↓ openRouter.chatStream (SSE)
 *   OpenRouter (GLM-5.1-FP8)
 *
 * Sécurité :
 *   - Le JWT est récupéré depuis les cookies/request headers via getProxyAuthHeaders
 *   - Le tenantId est résolu côté NestJS depuis le JWT (jamais du body)
 *   - PermissionsGuard vérifie RH_read côté NestJS
 *
 * Le stream est transmis en `text/event-stream` sans buffering.
 * ============================================================================
 */

import { NextRequest } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

/** Force dynamique — les cookies / session doivent être lus côté serveur. */
export const dynamic = 'force-dynamic';

/** Pas de parsing body — on forward le JSON brut pour streaming. */
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export async function POST(request: NextRequest) {
  const backendUrl = nestControllerUrl('hr/ia/copilot/stream');

  // Récupérer les headers auth (Authorization + cookies) depuis la requête client
  const authHeaders = await getProxyAuthHeaders(request);

  // Lire le body brut (JSON) tel quel pour le forwarder
  const bodyText = await request.text();

  try {
    const upstream = await fetch(normalizeApiUrl(backendUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: bodyText,
      cache: 'no-store',
      // Pas de timeout côté BFF — le stream peut durer jusqu'à 60s+ côté backend
    });

    // Si le backend renvoie une erreur non-SSE, on la forward en JSON
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType || 'application/json',
        },
      });
    }

    // ─── Forward le flux SSE tel quel vers le client ────────────────────
    // On wrap dans un ReadableStream pour respecter l'API Web Streams.
    if (!upstream.body) {
      return new Response('No stream body from backend', { status: 502 });
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // Pass-through exact des bytes SSE
            controller.enqueue(value);
          }
        } catch (err: any) {
          // En cas d'erreur en cours de stream, on envoie un chunk d'erreur SSE
          // puis on ferme proprement le stream côté client.
          const errorChunk = `data: ${JSON.stringify({
            type: 'error',
            text: err?.message || 'Stream interrompu',
          })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
        } finally {
          controller.close();
          try { reader.releaseLock(); } catch { /* noop */ }
        }
      },
      cancel(reason) {
        // Le client a fermé la connexion — le fetch upstream sera automatiquement annulé
        // par la fermeture du ReadableStream.
        console.log('[hr/ia/copilot/stream] Client cancelled stream:', reason);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('[hr/ia/copilot/stream] proxy error:', err);
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        text: 'Service RH indisponible : ' + (err?.message || 'erreur inconnue'),
      })}\n\n`,
      {
        status: 502,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      },
    );
  }
}
