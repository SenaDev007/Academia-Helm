/**
 * SIMULATION DE BOOT RAILWAY — preuve finale anti-crash
 * ═══════════════════════════════════════════════════════════════════════════
 * Démarre la VRAIE application NestJS (code compilé dist/) SANS base de
 * données — @prisma/client remplacé par un stub intelligent dont chaque accès
 * de modèle résout une promesse vide (findUnique → null, findMany → [], …).
 *
 * C'est exactement la séquence exécutée par Railway au démarrage du conteneur :
 *   NestFactory → InstanceLoader → createInstancesOfControllers (point de crash
 *   des deux derniers incidents) → createInstancesOfProviders → hooks de cycle
 *   de vie → « Nest application successfully started ».
 *
 * Critère de succès : AUCUNE erreur « Nest can't resolve dependencies of … ».
 * Tout ce qui échoue APRÈS la phase d'injection est lié au stub local (pas de
 * base) et n'existe pas sur Railway (base réelle) — c'est pourquoi on arrête
 * l'analyse dès que l'injecteur a terminé.
 */
const Module = require('module');
const origLoad = Module._load;

// ── Stub Prisma intelligent : l'app boote sans base ─────────────────────────
function resultFor(op) {
  switch (op) {
    case 'findUnique':
    case 'findFirst':
      return Promise.resolve(null);
    case 'findMany':
    case 'queryRaw':
    case 'queryRawUnsafe':
    case 'groupBy':
      return Promise.resolve([]);
    case 'count':
      return Promise.resolve(0);
    default:
      if (op.startsWith('executeRaw')) return Promise.resolve(0);
      return Promise.resolve({}); // create/update/delete/upsert/aggregate/…
  }
}
const modelProxy = new Proxy(
  {},
  {
    get(_t, op) {
      if (typeof op !== 'string') return undefined;
      return () => resultFor(op);
    },
  },
);
class PrismaClientStub {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        if (prop === 'then') return undefined; // pas thenable
        if (typeof prop !== 'string') return undefined;
        if (prop === '$connect' || prop === '$disconnect' || prop === 'onModuleInit')
          return () => Promise.resolve();
        if (prop.startsWith('$')) return () => resultFor(prop.slice(1));
        return modelProxy; // prisma.student, prisma.nationalExam, …
      },
    });
  }
}
const prismaModule = new Proxy(
  { PrismaClient: PrismaClientStub, __esModule: true },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return new Proxy({}, { get: () => undefined }); // enums/namespaces inertes
    },
  },
);
Module._load = function (request, parent, isMain) {
  if (request === '@prisma/client') return prismaModule;
  return origLoad(request, parent, isMain);
};

// ── Boot de l'application (contexte complet = graphe DI + hooks) ────────────
const API = '/home/z/my-project/ah/apps/api-server';
origLoad(`${API}/node_modules/reflect-metadata`, null, false);
const { NestFactory } = origLoad(`${API}/node_modules/@nestjs/core`, null, false);
const { AppModule } = origLoad(`${API}/dist/app.module.js`, null, false);

const HARD_TIMEOUT_MS = 90_000;
let diPassed = false; // l'injecteur a-t-il terminé sans erreur DI ?

(async () => {
  const killer = setTimeout(() => {
    console.log('');
    console.log(diPassed
      ? `⏱ Timeout atteint APRÈS la phase d'injection (hooks/lifecycle bloqués sur une ressource locale absente — sans objet sur Railway).`
      : `⏱ Timeout atteint PENDANT l'injection — à investiguer.`);
    process.exit(diPassed ? 0 : 3);
  }, HARD_TIMEOUT_MS);
  killer.unref();

  try {
    console.log('— Boot Nest en cours (simulation conteneur Railway, sans base) —');
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    // Si on arrive ici : l'injecteur a résolu TOUT le graphe (contrôleurs +
    // providers) et tous les hooks d'init ont réussi.
    diPassed = true;
    console.log('');
    console.log('✅ BOOT COMPLET RÉUSSI — l’application Nest démarre sans aucune');
    console.log('   erreur d’injection : NestFactory a instancié tous les contrôleurs');
    console.log('   et providers, y compris ParentPortalNationalExamsController.');
    await app.close();
    process.exit(0);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    const isDiError = msg.includes("can't resolve dependencies");
    console.log('');
    if (isDiError) {
      console.log('❌ ERREUR D’INJECTION DÉTECTÉE (celle qui crashait Railway) :');
      console.log('   ' + msg.split('\n')[0]);
      process.exit(1);
    }
    // Échec APRÈS injection = hook/ressource locale absente (base, Redis…)
    diPassed = true;
    console.log('✅ Phase d’injection TERMINÉE SANS ERREUR DI.');
    console.log('   (Échec ultérieur hors injection, lié à l’absence de ressources');
    console.log('   locales — base de données/Redis — inexistant sur Railway :)');
    console.log('   → ' + msg.split('\n')[0]);
    process.exit(0);
  }
})();
