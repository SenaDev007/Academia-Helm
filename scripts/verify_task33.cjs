#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task33.cjs — Header de la PLATEFORME Academia Helm sur la page
 * publique de consultation des résultats — Task 33 (2026-10-01)
 * ============================================================================
 *
 * CONTEXTE : le lien public /federis/resultats/[token] est construit avec
 * window.location.origin à la génération (FederisDeliberationsPage) → il est
 * partagé aux parents avec l'origine du SOUS-DOMAINE DU PATRONAT
 * (ex: patronatcspeb.academiahelm.com/federis/resultats/xxx). Or le composant
 * Header (header-1) détecte l'hôte : sur un sous-domaine tenant il fetch
 * /api/public/schools/by-subdomain/{sub} et remplace logo + wordmark par le
 * branding de l'école du patronat → la page publique de consultation portait
 * le header du sous-domaine du patronat au lieu de celui de la plateforme.
 *
 * FIX : nouvelle prop `forceAcademiaBrand` sur <Header /> — court-circuite la
 * détection de sous-domaine → logo Academia Helm + wordmark « Academia Helm »
 * TOUJOURS affichés sur la page de consultation, quel que soit le domaine
 * d'ouverture du lien. Comportement par défaut (prop absente) INCHANGÉ pour
 * toutes les autres pages qui utilisent <Header />.
 *
 * VÉRIFICATIONS :
 *   A. Structurel — header-1.tsx : signature prop + défaut false, garde du
 *      useEffect (typeof window === 'undefined' || forceAcademiaBrand), deps
 *      [forceAcademiaBrand], repli wordmark « Academia…Helm » intact,
 *      LogoCircle(tenantLogo || undefined) intact.
 *   B. Structurel — page resultats/[token]/page.tsx : <Header forceAcademiaBrand />.
 *   C. Structurel — anti-régression : aucun AUTRE appelant de Header ne passe
 *      la prop (les autres pages gardent le branding sous-domaine habituel).
 *   D. ⭐ RUNTIME du VRAI composant Header (transpilé SWC + harnais vm avec
 *      mini-React) — 3 scénarios :
 *        D1. forceAcademiaBrand=true sur sous-domaine patronat → AUCUN fetch
 *            branding, wordmark plateforme « Academia Helm », LogoCircle sans
 *            logoUrl (logo Academia par défaut) ;
 *        D2. prop absente sur sous-domaine patronat → fetch branding DÉCLENCHÉ
 *            (comportement inchangé — anti-régression des autres pages) ;
 *        D3. prop absente sur le domaine principal → aucun fetch (hostname
 *            non tenant).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const swc = require('/home/z/my-project/ah/apps/api-server/node_modules/@swc/core');

const ROOT = '/home/z/my-project/ah';
const HEADER_PATH = path.join(ROOT, 'apps/web-app/src/components/ui/header-1.tsx');
const PAGE_PATH = path.join(ROOT, 'apps/web-app/src/app/(public)/federis/resultats/[token]/page.tsx');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A/B/C. CONTRÔLES STRUCTURELS
// ───────────────────────────────────────────────────────────────────────────
console.log('\n── A. header-1.tsx — prop forceAcademiaBrand ──');
const headerSrc = fs.readFileSync(HEADER_PATH, 'utf8');

check('A1. Prop déclarée avec défaut false dans la signature',
  /forceAcademiaBrand\s*=\s*false/.test(headerSrc));
check('A2. Typage de la prop (forceAcademiaBrand\?: boolean)',
  /forceAcademiaBrand\?\s*:\s*boolean/.test(headerSrc));
check('A3. Garde du useEffect court-circuite la détection (typeof window === \'undefined\' || forceAcademiaBrand)',
  headerSrc.includes("if (typeof window === 'undefined' || forceAcademiaBrand) return;"));
check('A4. Dépendances du useEffect incluent forceAcademiaBrand',
  /\},\s*\[forceAcademiaBrand\]\);/.test(headerSrc));
check('A5. Repli wordmark plateforme intact (tenantName || Academia…Helm)',
  /tenantName\s*\|\|\s*\(<>Academia<span className="text-amber-300 ml-1">Helm<\/span><\/>\)/.test(headerSrc));
check('A6. LogoCircle garde le repli (tenantLogo || undefined)',
  /logoUrl=\{tenantLogo\s*\|\|\s*undefined\}/.test(headerSrc));
check('A7. Le fetch branding reste présent (comportement par défaut conservé)',
  headerSrc.includes('`/api/public/schools/by-subdomain/${subdomain}`'));

console.log('\n── B. Page publique de consultation — usage de la prop ──');
const pageSrc = fs.readFileSync(PAGE_PATH, 'utf8');

check('B1. La page rend <Header forceAcademiaBrand />',
  /<Header\s+forceAcademiaBrand\s*\/>/.test(pageSrc));
check('B2. Import du Header conservé',
  pageSrc.includes("import { Header } from '@/components/ui/header-1';"));
check('B3. La page rend toujours FederisPublicResultsClient (portail T26/T31 intact)',
  /<FederisPublicResultsClient token=\{token\}\s*\/>/.test(pageSrc));

console.log('\n── C. Anti-régression — autres appelants de Header ──');
// Tous les autres fichiers qui rendent <Header …> ne doivent PAS passer la prop.
const webSrc = path.join(ROOT, 'apps/web-app/src');
const offenders = [];
const pageRel = path.relative(webSrc, PAGE_PATH);
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      const src = fs.readFileSync(p, 'utf8');
      if (p !== HEADER_PATH && path.relative(webSrc, p) !== pageRel && src.includes("from '@/components/ui/header-1'")) {
        const m = src.match(/<Header\b[^>]*forceAcademiaBrand[^>]*>/);
        if (m) offenders.push(path.relative(webSrc, p));
      }
    }
  }
})(webSrc);
check('C1. Aucune autre page ne force le branding Academia (seule la page de consultation)',
  offenders.length === 0, offenders.join(', '));

// ───────────────────────────────────────────────────────────────────────────
// D. RUNTIME — le VRAI composant Header transpilé dans un harnais vm
// ───────────────────────────────────────────────────────────────────────────
console.log('\n── D. Runtime du composant Header (SWC + harnais vm) ──');

// D.0 — Transpilation TSX → CJS (runtime JSX classic → React.createElement)
let compiled;
try {
  compiled = swc.transformSync(headerSrc, {
    jsc: {
      target: 'es2021',
      parser: { syntax: 'typescript', tsx: true, decorators: true, dynamicImport: true },
      transform: { legacyDecorator: true, decoratorMetadata: true, react: { runtime: 'classic' } },
      keepClassNames: true,
    },
    module: { type: 'commonjs' },
  }).code;
  check('D0. header-1.tsx transpilé (SWC, TSX→CJS, JSX classic)', true);
} catch (e) {
  check('D0. header-1.tsx transpilé (SWC, TSX→CJS, JSX classic)', false, e.message);
  process.exit(1);
}

/**
 * Construit un harnais vm avec un mini-React (hooks au montage), les mocks
 * des dépendances du Header, un window/document configurés pour l'hôte donné,
 * et un fetch instrumenté. Retourne de quoi rendre le composant et observer.
 */
function makeHarness(hostname) {
  const fetchCalls = [];
  const logoCircleProps = [];

  // ── Mini-React : hooks collectés au montage, rendu en arbre d'objets ──
  const effects = [];
  const hookCtxStack = [];
  function currentCtx() {
    if (hookCtxStack.length === 0) hookCtxStack.push({ idx: 0 });
    return hookCtxStack[hookCtxStack.length - 1];
  }
  const reactMock = {
    __esModule: true,
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) {
      return { type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } };
    },
    useState(initial) {
      const ctx = currentCtx();
      const i = ctx.idx++;
      const value = typeof initial === 'function' ? initial() : initial;
      return [value, () => {}]; // setter no-op (montage uniquement)
    },
    useEffect(fn) { effects.push(fn); },
    useLayoutEffect(fn) { effects.push(fn); },
    useRef(initial) { const ctx = currentCtx(); ctx.idx++; return { current: initial }; },
  };
  reactMock.default = reactMock;

  // ── Mocks des dépendances ──
  const LinkMock = (props) => ({ type: 'a', props: { ...props, children: props.children } });
  const mocks = {
    'react': reactMock,
    'react-dom': { __esModule: true, createPortal: (children) => ({ type: 'Portal', props: { children } }) },
    'next/link': { __esModule: true, default: LinkMock },
    'lucide-react': { __esModule: true, DoorOpen: () => ({ type: 'DoorOpen', props: {} }), ArrowRight: () => ({ type: 'ArrowRight', props: {} }) },
    '@/components/ui/menu-toggle-icon': { __esModule: true, MenuToggleIcon: () => ({ type: 'MenuToggleIcon', props: {} }) },
    '@/components/ui/use-scroll': { __esModule: true, useScroll: () => false },
    '@/components/ui/LogoCircle': {
      __esModule: true,
      default: (props) => { logoCircleProps.push(props); return { type: 'LogoCircle', props }; },
    },
    '@/lib/utils': { __esModule: true, cn: (...cls) => cls.filter(Boolean).map(String).join(' ') },
  };

  // ── Environnement navigateur simulé ──
  const moduleObj = { exports: {} };
  const sandbox = {
    console,
    URLSearchParams,
    setTimeout,
    module: moduleObj,
    exports: moduleObj.exports, // même objet : SWC définit les exports sur `exports`
    require: (id) => {
      if (mocks[id]) return mocks[id];
      throw new Error(`require inattendu : ${id}`);
    },
    fetch: (url) => {
      fetchCalls.push(String(url));
      return Promise.resolve({
        ok: true,
        json: async () => ({ logoUrl: 'https://exemple.test/logo-patronat.png', schoolName: 'ECOLE PATRONAT TEST' }),
      });
    },
  };
  sandbox.window = {
    location: { hostname, search: '', pathname: '/federis/resultats/abc123' },
    history: { replaceState: () => {} },
  };
  sandbox.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, textContent: '' }),
    head: { appendChild: () => {} },
    body: { style: {} },
  };
  sandbox.sessionStorage = { getItem: () => null, setItem: () => {} };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(compiled, sandbox, { filename: 'header-1.tsx' });
  const Header = moduleObj.exports.Header || sandbox.exports.Header;
  if (typeof Header !== 'function') throw new Error('Header non exporté');

  // ── Rendu récursif (montage) ──
  function renderNode(node) {
    if (node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(renderNode);
    const { type, props } = node;
    if (typeof type === 'function') {
      hookCtxStack.push({ idx: 0 });
      let out;
      try { out = type(props || {}); } finally { hookCtxStack.pop(); }
      return renderNode(out);
    }
    return { type, props: { ...props, children: renderNode(props?.children) } };
  }

  function collectText(node, acc) {
    if (node == null) return acc;
    if (typeof node === 'string' || typeof node === 'number') { acc.push(String(node)); return acc; }
    if (Array.isArray(node)) { node.forEach((n) => collectText(n, acc)); return acc; }
    if (node.props?.children) collectText(node.props.children, acc);
    return acc;
  }

  async function renderHeader(props) {
    effects.length = 0;
    fetchCalls.length = 0;
    logoCircleProps.length = 0;
    const tree = renderNode({ type: Header, props: props || {} });
    // Flush des effets de montage (try/catch par effet)
    for (const fn of effects) {
      try { fn(); } catch (e) { /* effet DOM-only sans DOM réel */ }
    }
    // Laisse filer les microtasks (promesses .then du fetch éventuel)
    await new Promise((r) => setTimeout(r, 10));
    return { tree, texts: collectText(tree, []) };
  }

  return { renderHeader, fetchCalls, logoCircleProps };
}

(async () => {
  // D1 — forceAcademiaBrand=true sur le SOUS-DOMAINE du patronat
  try {
    const h = makeHarness('patronatcspeb.academiahelm.com');
    const { texts } = await h.renderHeader({ forceAcademiaBrand: true });
    check('D1a. Sous-domaine patronat + forceAcademiaBrand → AUCUN fetch branding',
      h.fetchCalls.length === 0, `fetch=${JSON.stringify(h.fetchCalls)}`);
    const joined = texts.join(' ');
    check('D1b. Wordmark PLATEFORME « Academia…Helm » affiché',
      /Academia/.test(joined) && /Helm/.test(joined), JSON.stringify(texts.slice(0, 4)));
    check('D1c. Aucun nom d’école tenant injecté (ECOLE PATRONAT TEST absent)',
      !joined.includes('ECOLE PATRONAT TEST'));
    check('D1d. LogoCircle rendu SANS logoUrl (logo Academia Helm par défaut)',
      h.logoCircleProps.length === 1 && (h.logoCircleProps[0].logoUrl === undefined
        || h.logoCircleProps[0].logoUrl === null),
      JSON.stringify(h.logoCircleProps.map((p) => p.logoUrl)));
  } catch (e) {
    check('D1. Scénario forceAcademiaBrand (sous-domaine)', false, e.message);
  }

  // D2 — prop absente sur le sous-domaine du patronat (comportement inchangé)
  try {
    const h = makeHarness('patronatcspeb.academiahelm.com');
    await h.renderHeader({});
    check('D2a. Sous-domaine patronat SANS prop → fetch branding DÉCLENCHÉ (comportement conservé)',
      h.fetchCalls.length === 1);
    check('D2b. URL du fetch = /api/public/schools/by-subdomain/patronatcspeb',
      h.fetchCalls[0] === '/api/public/schools/by-subdomain/patronatcspeb',
      JSON.stringify(h.fetchCalls));
  } catch (e) {
    check('D2. Scénario défaut (sous-domaine)', false, e.message);
  }

  // D3 — prop absente sur le domaine principal (non tenant)
  try {
    const h = makeHarness('academiahelm.com');
    await h.renderHeader({});
    check('D3. Domaine principal sans prop → aucun fetch branding (hostname non tenant)',
      h.fetchCalls.length === 0, JSON.stringify(h.fetchCalls));
  } catch (e) {
    check('D3. Scénario domaine principal', false, e.message);
  }

  // ── Bilan ──
  console.log(`\n═══ TASK 33 : ${pass} ✅ / ${fail} ❌ ═══`);
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('ERREUR FATALE :', e); process.exit(1); });
