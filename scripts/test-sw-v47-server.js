/**
 * Harnais de test SW v4.7.0 — bug mobile « fiche sauvegardée qui disparaît »
 * ============================================================================
 * Scénario reproduit (fantôme online) :
 *   1. Serveur DOWN → POST/PUT /api/pedagogy-space/fiches → le SW met en
 *      file + 200 fabriqué (X-Sync-Status: pending) → l'app croit que c'est
 *      sauvegardé alors que le serveur n'a rien.
 *   2. Serveur UP → TRIGGER_SYNC (nouveau déclencheur v4.7.0) → replay :
 *      POST créé avec l'id SERVEUR → remap → PUT rejoués vers l'id serveur.
 *   3. Vérifs : dédup (1 POST + 1 PUT en file malgré 3 sauvegardes), entité
 *      optimiste (mapping pedagogicalworkspace), GET offline sert la fiche
 *      en attente, aucune donnée perdue, aucun 404.
 *
 * Usage : node server.js [port]  (défaut 8899)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 8899);
const SW_PATH = path.resolve(__dirname, '../../Academia-Helm/apps/web-app/public/sw.js');
const PAGE_PATH = path.join(__dirname, 'test.html');

// ─── Journal des requêtes API reçues (pour vérifier le replay) ─────────────
const received = [];
const SERVER_FICHE_ID = '5f5e5d5c-1111-4aaa-bbbb-cccc00001111';
// Fiches « existantes » côté serveur (créées par POST) — un PUT vers une
// fiche inexistante renvoie 404 comme en production (NestJS + Prisma).
const createdFiches = new Set();

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // ─── Endpoints de contrôle du harnais ───
  if (method === 'GET' && url === '/__requests') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(received));
    return;
  }
  if (method === 'GET' && url === '/__reset') {
    received.length = 0;
    createdFiches.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  // ─── Mock API pédagogie (BFF same-origin) ───
  if (url === '/api/pedagogy-space/fiches' && method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ method, url, body, at: Date.now(), status: 200 });
      // Le serveur crée la fiche avec SON id (différent de l'id local du SW).
      // Production-accurate : la fiche créée PERSISTE (base de données) —
      // le nouvel id est déterministe pour survivre aux redémarrages.
      createdFiches.add(SERVER_FICHE_ID);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: SERVER_FICHE_ID, status: 'DRAFT', titre: 'Fiche serveur', serverSide: true }));
    });
    return;
  }
  if (/^\/api\/pedagogy-space\/fiches\/([0-9a-f-]+)$/i.test(url) && method === 'PUT') {
    const ficheId = url.split('/').pop();
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // Production-accurate : la fiche créée par un POST PERSISTE en base —
      // l'id serveur déterministe existe donc même après un redémarrage du
      // processus mock ; les ids LOCAUX n'existent jamais côté serveur.
      const exists = ficheId === SERVER_FICHE_ID || createdFiches.has(ficheId);
      received.push({ method, url, body, at: Date.now(), status: exists ? 200 : 404 });
      if (!exists) {
        // Production-like : fiche inexistante → 404 (id local jamais créé)
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Fiche pédagogique non trouvée', statusCode: 404 }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: ficheId, updated: true }));
    });
    return;
  }
  if (url.startsWith('/api/')) {
    // Autres API : JSON vide par défaut (les GET cachables renvoient [])
    received.push({ method, url, body: null, at: Date.now() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // ─── Fichiers du harnais ───
  if (url === '/sw.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    fs.createReadStream(SW_PATH).pipe(res);
    return;
  }
  if (url === '/test.html' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(PAGE_PATH).pipe(res);
    return;
  }
  if (url === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'AH Test', start_url: '/test.html' }));
    return;
  }

  // Pages pré-cachées par le SW à l'install : HTML minimal
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!DOCTYPE html><html><body>mock</body></html>');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[harnais v4.7.0] http://127.0.0.1:${PORT}/test.html`);
  console.log(`[harnais v4.7.0] SW servi depuis ${SW_PATH}`);
});
