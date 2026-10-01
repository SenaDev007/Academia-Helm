/**
 * Vérificateur statique du graphe d'injection NestJS (anti-crash boot Railway)
 * ═══════════════════════════════════════════════════════════════════════════
 * Réplique la résolution de dépendances que Nest effectue au bootstrap — SANS
 * base de données ni connexions — sur le code COMPILÉ (dist/), après un simple
 * stub de @prisma/client (indisponible hors Docker : prisma generate).
 *
 * Attrape avant déploiement :
 *   1. « Nest can't resolve dependencies of the X (... Y at index [i] ...) »
 *      — contrôleurs ET providers, tous modules, y compris modules globaux
 *   2. « Nest cannot export a provider/module that is not part of the module »
 *      — chaque export doit être un provider local ou un module importé
 *
 * Fidélité au comportement Nest (vérifiée empiriquement sur cette app) :
 *   - DynamicModules ASYNCHRONES : @nestjs/config 3.3 retourne une
 *     Promise<DynamicModule> — Nest 10.4 l'attend au bootstrap, on l'attend ici
 *   - @Global() via la clé '__module:global__' (GLOBAL_MODULE_METADATA)
 *   - DynamicModule global via la propriété `global: true` de l'objet résolu
 *     (ScheduleModule.forRoot(), ConfigModule.forRoot({ isGlobal: true })…)
 *   - forwardRef({ forwardRef: () => Module }) — la fonction est appelée
 *   - Built-ins Nest disponibles partout : Reflector, ModuleRef, internes
 *     @nestjs/schedule (DiscoveryService, MetadataScanner…)
 *   - @Optional() et @Inject(token) exclus du contrôle
 *   - Nœuds indexés par IDENTITÉ (jamais par nom) : classes homonymes distinctes
 */
const Module = require('module');
const origLoad = Module._load;

// ── Stub @prisma/client : PrismaClient + fallback Proxy pour les enums ──────
class PrismaClientStub {
  constructor() {}
  $connect() {
    return Promise.resolve();
  }
  $disconnect() {
    return Promise.resolve();
  }
}
const prismaProxy = new Proxy(
  { PrismaClient: PrismaClientStub, __esModule: true },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return new Proxy(
        {},
        {
          get() {
            return undefined;
          },
        },
      );
    },
  },
);
Module._load = function (request, parent, isMain) {
  if (request === '@prisma/client') return prismaProxy;
  return origLoad(request, parent, isMain);
};

const DIST = '/home/z/my-project/ah/apps/api-server/dist';
// reflect-metadata résolu depuis le node_modules de l'API (le script vit hors projet)
origLoad(`${'/home/z/my-project/ah/apps/api-server/node_modules/reflect-metadata'}`, null, false);
const { AppModule } = origLoad(`${DIST}/app.module.js`, null, false);

// ── Métadonnées Nest ─────────────────────────────────────────────────────────
const META = { imports: 'imports', controllers: 'controllers', providers: 'providers', exports: 'exports' };
const GLOBAL_KEY = '__module:global__'; // GLOBAL_MODULE_METADATA (cette version)
const PARAMTYPES = 'design:paramtypes';
const OPTIONAL_PARAMS = 'optional:parameters';
const INJECT_PARAMS = 'self:paramtypes';

// Built-ins Nest disponibles dans TOUT contexte d'injection (core/schedule)
const BUILTIN = new Set([
  'Reflector',
  'ModuleRef',
  'HttpAdapterHost',
  'HttpAdapter',
  'ApplicationConfig',
  'ScheduleExplorer',
  'SchedulerOrchestrator',
  'SchedulerMetadataAccessor',
  'DiscoveryService',
  'MetadataScanner',
  'ExternalContextCreator',
]);

function meta(cls, key) {
  try {
    return Reflect.getMetadata(key, cls) || [];
  } catch {
    return [];
  }
}
function providerToken(p) {
  return p && typeof p === 'object' && 'provide' in p ? p.provide : p;
}
function isClass(v) {
  return typeof v === 'function';
}
const PRIMITIVES = new Set([String, Number, Boolean, Object, Function, Array]);

// ── Phase 1 (asynchrone) : parcours du graphe, Promises attendues ───────────
const nodeByRef = new WeakMap(); // classe → nœud
const nodeByObj = new Map(); // objet DynamicModule résolu → nœud
const globalProviders = new Set(); // exports de tous les modules globaux
const nodes = [];
let dynamicCount = 0;
let promiseCount = 0;

function registerNode(raw, resolvedFromPromise) {
  // raw est soit une classe, soit un objet DynamicModule RÉSOLU (plus de Promise)
  if (isClass(raw)) {
    if (nodeByRef.has(raw)) return nodeByRef.get(raw);
    const isGlobal = Reflect.getMetadata(GLOBAL_KEY, raw) === true;
    const exports = new Set(meta(raw, META.exports).map(providerToken));
    const node = {
      name: raw.name || 'ModuleAnonyme',
      providers: new Set(meta(raw, META.providers).map(providerToken)),
      exports,
      controllers: meta(raw, META.controllers),
      rawImports: meta(raw, META.imports),
      dynamic: false,
      resolvedImports: [],
    };
    nodeByRef.set(raw, node);
    nodes.push(node);
    if (isGlobal) for (const e of exports) globalProviders.add(e);
    return node;
  }
  if (raw && typeof raw === 'object' && raw.module) {
    if (nodeByObj.has(raw)) return nodeByObj.get(raw);
    dynamicCount++;
    // ⚠️ Nest FUSIONNE les métadonnées de la classe référencée par `module`
    // avec celles de l'objet DynamicModule — p.ex. @nestjs/jwt 10.2 : la classe
    // JwtModule porte elle-même providers/exports [JwtService] alors que
    // registerAsync() ne retourne que le provider d'options asynchrones.
    const cls = raw.module;
    const clsProviders = isClass(cls) ? meta(cls, META.providers).map(providerToken) : [];
    const clsExports = isClass(cls) ? meta(cls, META.exports).map(providerToken) : [];
    const node = {
      name: `${(cls && cls.name) || 'DynamicModule'}#dyn${dynamicCount}`,
      providers: new Set([...(raw.providers || []).map(providerToken), ...clsProviders]),
      exports: new Set([...(raw.exports || []).map(providerToken), ...clsExports]),
      controllers: raw.controllers || [],
      rawImports: raw.imports || [],
      dynamic: true,
      resolvedImports: [],
    };
    nodeByObj.set(raw, node);
    nodes.push(node);
    const clsGlobal = isClass(cls) && Reflect.getMetadata(GLOBAL_KEY, cls) === true;
    if (raw.global === true || clsGlobal) for (const e of node.exports) globalProviders.add(e);
    return node;
  }
  return null;
}

async function resolveImport(imp) {
  if (imp && typeof imp === 'object' && typeof imp.then === 'function') {
    promiseCount++;
    return resolveImport(await imp); // DynamicModule asynchrone (ConfigModule…)
  }
  if (imp && typeof imp === 'object' && typeof imp.forwardRef === 'function') {
    return resolveImport(imp.forwardRef()); // forwardRef(() => Module)
  }
  return imp;
}

async function walk(mod, seen) {
  const node = registerNode(mod);
  if (!node) return;
  if (seen.has(node)) return;
  seen.add(node);
  for (const imp of node.rawImports || []) {
    const resolved = await resolveImport(imp);
    const child = registerNode(resolved);
    if (child) {
      node.resolvedImports.push(child);
      await walk(resolved, new Set(seen));
    }
  }
}

// ── Phase 2 (synchrone) : résolution des dépendances, miroir de l'injecteur ──
const violations = [];

// Un module peut EXPORTER UNE CLASSE-MODULE (p.ex. CommonModule @Global qui
// ré-exporte OpenRouterModule) : Nest rend alors disponibles les exports de ce
// module — expansion transitive jusqu'au point fixe.
function expandModuleExports(available) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...available]) {
      if (!isClass(item)) continue;
      const n = nodeByRef.get(item);
      if (!n) continue;
      for (const e of n.exports) {
        if (!available.has(e)) {
          available.add(e);
          changed = true;
        }
      }
    }
  }
}

function checkDeps(cls, available, ownerKind, ownerName) {
  const params = Reflect.getMetadata(PARAMTYPES, cls);
  if (!params || !params.length) return;
  const optional = Reflect.getMetadata(OPTIONAL_PARAMS, cls) || [];
  const injected = Reflect.getMetadata(INJECT_PARAMS, cls) || [];
  params.forEach((P, i) => {
    if (optional.includes(i)) return;
    if (injected[i] !== undefined) return; // @Inject(token) — hors périmètre
    if (!isClass(P) || PRIMITIVES.has(P)) return;
    if (BUILTIN.has(P.name)) return; // core Nest / schedule
    if (!available.has(P)) {
      violations.push(
        `${ownerKind} ${ownerName} : « ${cls.name || 'classe anonyme'} » ` +
          `paramètre #${i} « ${P.name || P} » introuvable dans le contexte du module`,
      );
    }
  });
}

function checkAll() {
  // Expansion transitive des globaux (CommonModule @Global ré-exporte OpenRouterModule…)
  expandModuleExports(globalProviders);
  for (const node of nodes) {
    // disponibles = providers locaux ∪ exports des imports directs ∪ globaux
    const available = new Set(node.providers);
    for (const impNode of node.resolvedImports) {
      for (const e of impNode.exports) available.add(e);
    }
    for (const g of globalProviders) available.add(g);
    expandModuleExports(available);

    // 1. contrôleurs
    for (const ctrl of node.controllers) {
      if (isClass(ctrl)) checkDeps(ctrl, available, 'Contrôleur', node.name);
    }
    // 2. providers (classes + factories avec inject:[...])
    for (const p of node.providers) {
      if (isClass(p)) checkDeps(p, available, 'Provider', node.name);
      if (p && typeof p === 'object' && Array.isArray(p.inject)) {
        for (const t of p.inject) {
          if (isClass(t) && !BUILTIN.has(t.name) && !available.has(t)) {
            violations.push(
              `Provider ${node.name} : factory « ${(p.provide && p.provide.name) || String(p.provide)} » ` +
                `injecte « ${t.name} » introuvable`,
            );
          }
        }
      }
    }
    // 3. chaque export doit être un provider local OU un module importé.
    //    Uniquement pour les modules STATIQUES de l'app : les dynamic modules
    //    du framework (@nestjs/config exporte ConfigHostModule sans l'importer)
    //    ont des formes internes légitimes — le bug historique visé
    //    (« FederisCandidatesExportService dans exports sans être provider »)
    //    vit sur les @Module statiques.
    if (!node.dynamic) {
      const rawImportClasses = new Set(
        (node.rawImports || []).filter((i) => isClass(i)),
      );
      for (const e of node.exports) {
        if (node.providers.has(e)) continue;
        if (rawImportClasses.has(e)) continue;
        if (isClass(e) || typeof e === 'string' || typeof e === 'symbol') {
          violations.push(
            `Module ${node.name} : export « ${isClass(e) ? e.name : String(e)} » ` +
              `ni provider local ni module importé (Nest refusera au boot)`,
          );
        }
      }
    }
  }
}

// ── Point d'entrée ────────────────────────────────────────────────────────────
(async () => {
  await walk(AppModule, new Set());
  checkAll();

  const nbStatic = nodes.filter((n) => !n.dynamic).length;
  console.log(`Modules parcourus        : ${nodes.length} (${nbStatic} statiques + ${dynamicCount} dynamic)`);
  console.log(`DynamicModules asynchrones attendus : ${promiseCount}`);
  console.log(`Providers globaux        : ${globalProviders.size}`);
  console.log('');
  if (violations.length === 0) {
    console.log('✅ Aucune violation DI — le bootstrap Nest peut résoudre tout le graphe.');
    process.exit(0);
  } else {
    console.log(`❌ ${violations.length} violation(s) DI détectée(s) :`);
    for (const v of violations) console.log('  - ' + v);
    process.exit(1);
  }
})().catch((e) => {
  console.error('ÉCHEC du vérificateur :', e && e.stack ? e.stack : e);
  process.exit(2);
});
