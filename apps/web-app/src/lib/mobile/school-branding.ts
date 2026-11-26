/**
 * ============================================================================
 * PONT WEB → COQUILLE NATIVE (CAPACITOR) — BRANDING ÉCOLE
 * ============================================================================
 *
 * Propage l'identité de l'école connectée à la coquille mobile
 * (apps/mobile) :
 *
 *   1. Widget « Branding de l'école » (SchoolWidgetProvider) — logo et nom
 *      de l'école téléchargés au runtime, affichés sur l'écran d'accueil ;
 *   2. Écran de chargement natif rebrandé au prochain démarrage à froid ;
 *   3. Barre de statut colorée aux couleurs de l'école.
 *
 * Appel depuis TenantContext dès que le contexte (/api/context/bootstrap ou
 * cache offline) est connu, et clearSchoolBranding() au logout.
 *
 * SÉCURITÉ D'EXÉCUTION : toutes les fonctions font une feature-detection de
 * Capacitor — dans un navigateur classique (ou un onglet PWA), elles sont
 * des no-op silencieux. Zéro impact hors coquille mobile. Aucune erreur
 * natives ne peut interrompre le rendu web (tout est try/catch + void).
 *
 * NOTE ICÔNE LAUNCHER : l'icône de l'app reste volontairement « Academia
 * Helm » — Android/iOS n'acceptent que des icônes compilées dans l'APK.
 * Le widget est la surface officielle réellement dynamique (bitmap
 * téléchargé). Voir apps/mobile/BRANDING-ECOLE-WIDGET.md.
 */

/**
 * Vue structurelle du contexte tenant — compatible avec AppContext
 * (src/contexts/TenantContext.tsx) sans créer de dépendance circulaire.
 */
interface SchoolBrandingContext {
  tenant?: {
    name?: string | null;
    school?: {
      name?: string | null;
      logo?: string | null;
      primaryColor?: string | null;
      secondaryColor?: string | null;
    } | null;
  } | null;
}

/** Forme minimale du plugin natif (SchoolBrandingPlugin.java). */
interface SchoolBrandingPluginShape {
  setSchoolBranding(options: {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    tagline?: string | null;
  }): Promise<void>;
  clearSchoolBranding(): Promise<void>;
}

/** Navy officiel Academia Helm (cohérent avec capacitor.config.ts). */
const HELM_NAVY = '#0B2F73';

/**
 * Plugins natifs UNIQUEMENT dans la coquille Capacitor (apps/mobile).
 * Dans un navigateur classique, retourne null → tous les appels ci-dessous
 * deviennent des no-op.
 */
function nativePlugins(): Record<string, any> | null {
  const cap = (globalThis as any).Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) {
    return null;
  }
  return (cap.Plugins ?? null) as Record<string, any> | null;
}

/**
 * Rend l'URL du logo absolue et vérifie le schéma (http/https uniquement).
 * Les logos tenant peuvent être relatifs au domaine courant ; le téléchargement
 * se fait côté natif (pas de contrainte CORS).
 */
function absolutizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Propage l'école connectée au natif. Appelé à CHAQUE contexte connu,
 * y compris la reprise de session depuis le cache offline — le natif
 * dédoublonne (cache disque du logo + URL comparée).
 */
export async function syncSchoolBranding(ctx: SchoolBrandingContext | null): Promise<void> {
  const plugins = nativePlugins();
  if (!plugins) return;

  const branding = plugins.SchoolBranding as SchoolBrandingPluginShape | undefined;
  if (!branding || typeof branding.setSchoolBranding !== 'function') return;

  const tenantName = trimOrNull(ctx?.tenant?.name);
  const school = ctx?.tenant?.school ?? null;
  const schoolName = trimOrNull(school?.name) ?? tenantName;

  // Aucune école identifiable (ex. compte multi-écoles non résolu, contexte
  // plateforme) → retour à l'identité Academia Helm.
  if (!schoolName) {
    await clearSchoolBranding();
    return;
  }

  try {
    await branding.setSchoolBranding({
      name: schoolName,
      logoUrl: absolutizeLogoUrl(school?.logo),
      primaryColor: trimOrNull((school as any)?.primaryColor)
        ?? trimOrNull((school as any)?.secondaryColor),
      tagline: tenantName && tenantName !== schoolName ? tenantName : 'Portail Academia Helm',
    });
  } catch (err) {
    console.warn('[school-branding] sync native impossible :', err);
  }
}

/** Logout / retour multi-écoles : widget et écran de chargement reviennent
 * à l'identité Academia Helm. */
export async function clearSchoolBranding(): Promise<void> {
  const plugins = nativePlugins();
  if (!plugins) return;
  const branding = plugins.SchoolBranding as SchoolBrandingPluginShape | undefined;
  if (!branding || typeof branding.clearSchoolBranding !== 'function') return;
  try {
    await branding.clearSchoolBranding();
  } catch (err) {
    console.warn('[school-branding] reset native impossible :', err);
  }
}

/**
 * Barre de statut : couleur principale de l'école si disponible, navy
 * Academia Helm sinon. Le plugin StatusBar natif est enregistré par la
 * coquille — l'appel global suffit (pas besoin du package npm côté web).
 */
export async function applyTenantStatusBarColor(ctx: SchoolBrandingContext | null): Promise<void> {
  const plugins = nativePlugins();
  if (!plugins) return;
  const statusBar = plugins.StatusBar;
  if (!statusBar || typeof statusBar.setBackgroundColor !== 'function') return;

  const color = trimOrNull((ctx?.tenant?.school as any)?.primaryColor) ?? HELM_NAVY;
  try {
    await statusBar.setBackgroundColor({ color });
  } catch (err) {
    console.warn('[school-branding] couleur barre de statut non appliquée :', err);
  }
}
