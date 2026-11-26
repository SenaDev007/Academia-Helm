# Branding école — widget dynamique + interface native

> Implémentation de la recommandation « finale » : **l'icône du lanceur reste
> Academia Helm**, et l'école connectée prend possession du téléphone via
> trois surfaces réellement dynamiques : le **widget écran d'accueil**
> (logo + nom téléchargés au runtime), l'**écran de chargement natif** et la
> **barre de statut**. État au 2026-11-26 — targetSdk 36, minSdk 24,
> coquille Capacitor 7 (`com.yehiortech.academiahelm`).

---

## 1. Rappel de la décision produit

| Question | Réponse | Pourquoi |
|---|---|---|
| L'icône du lanceur peut-elle afficher le logo de l'école ? | **Non** pour un logo téléchargé (SaaS multi-tenant) | Android/iOS n'acceptent que des icônes **compilées dans l'APK/IPA**. Une école créée après la publication n'a pas d'icône embarquée ; le basculer exigerait une republication Play Store — contraire au principe « une seule base de code ». |
| Alternance Academia Helm ↔ école toutes les 5 s ? | **Non** | iOS : dialogue système à chaque changement + rejet App Store. Android : requiert un service au premier plan permanent, l'icône scintille à chaque bascule, les raccourcis se cassent, batterie — et quand l'app est fermée, plus de bascule du tout. |
| Ce qui est livré à la place | **Widget maison + branding in-app** | Le widget `RemoteViews` est LA surface officielle Android acceptant un **bitmap téléchargé au runtime** : réellement dynamique, pour TOUTE école, sans republier l'APK. |

L'utilisateur ajoute le widget une fois (sélecteur de widgets → « Academia
Helm → Branding de l'école ») ; dès lors il affiche l'identité de son école
et la suit à chaque changement d'école ou logout.

---

## 2. Les trois briques livrées

### 2.1 Widget « Branding de l'école » (Android natif)

Bandeau 4×2 (redimensionnable) : logo arrondi + nom de l'école + sous-titre,
fond aux couleurs de l'école. Sans école connectée : identité Academia Helm
(navy `#0B2F73`).

### 2.2 Écran de chargement natif rebrandé

Au démarrage à froid, l'overlay anti-page-blanche (`loading_overlay.xml`)
affiche le logo de l'école **centré** sur fond couleur école — avant même
que le WebView ne peigne la page. Sans branding → splash Academia Helm
inchangée.

### 2.3 Barre de statut à la couleur de l'école

Le web appelle le plugin `StatusBar` (déjà présent dans la coquille) avec
`school.primaryColor`, fallback navy.

---

## 3. Fichiers

### Créés (coquille native `apps/mobile/android/app/src/main/`)

| Fichier | Rôle |
|---|---|
| `java/…/SchoolBrandingStore.java` | Persistance SharedPreferences (nom, URL logo, couleur, sous-titre, cache logo) |
| `java/…/SchoolWidgetProvider.java` | `AppWidgetProvider` : téléchargement du logo (cache disque, écriture atomique, plafond 5 Mo), construction `RemoteViews`, clic → ouverture app |
| `java/…/SchoolBrandingPlugin.java` | Plugin Capacitor `SchoolBranding` : `setSchoolBranding` / `getSchoolBranding` / `clearSchoolBranding` |
| `res/layout/school_widget.xml` | Layout RemoteViews du widget |
| `res/xml/school_widget_info.xml` | Métadonnées (4×2, redimensionnable, `updatePeriodMillis` 30 min) |
| `res/drawable/school_widget_bg.xml` | Fond arrondi (teinté au runtime avec la couleur école, API 26+) |

### Créés (web `apps/web-app/`)

| Fichier | Rôle |
|---|---|
| `src/lib/mobile/school-branding.ts` | Pont web → natif : feature-detect Capacitor, normalisation du payload (nom, logo absolutisé, couleur), no-op total hors coquille mobile |

### Modifiés

| Fichier | Changement |
|---|---|
| `android/…/AndroidManifest.xml` | `<receiver .SchoolWidgetProvider>` + meta-data widget (`exported=false`, forme officielle actuelle) |
| `android/…/MainActivity.java` | `registerPlugin(SchoolBrandingPlugin.class)` + rebranding de l'overlay au démarrage (`applySchoolBrandingToLoadingOverlay`) |
| `android/…/res/layout/loading_overlay.xml` | Ids `loading_root` / `loading_logo` pour le rebranding runtime |
| `android/…/res/values/strings.xml` | Chaînes du widget |
| `web-app/src/contexts/TenantContext.tsx` | Import du pont + `useEffect` sur `context` (sync native) + reset au `clearContext` |

**Aucune dépendance Gradle ajoutée** — tout repose sur `androidx.core`
(déjà présent via appcompat) et les APIs du framework. Aucune modif de
`capacitor.config.ts` ni du manifest des permissions.

---

## 4. Flux complets

```
Première connexion (après installation)
────────────────────────────────────────
/portal → sélection école → login
  → /auth/select-tenant → /api/context/bootstrap
  → TenantContext : setContext(data)
  → useEffect [context] :
      syncSchoolBranding(data)  ──► SchoolBrandingPlugin.setSchoolBranding
      applyTenantStatusBarColor ──► StatusBar.setBackgroundColor
  ──► natif : store persisté → logo téléchargé (https, cache disque)
      → widget mis à jour IMMÉDIATEMENT (logo arrondi + nom + couleur)
      → prochain démarrage à froid : overlay rebrandé

Session suivante (app fermée puis réouverte)
─────────────────────────────────────────────
Reprise par cookie → loadContext → même pont (dédoublonné côté natif)

Logout
──────
clearContext → clearSchoolBranding() → widget + overlay → Academia Helm

Widget rafraîchi par le système (30 min, plafond Android)
─────────────────────────────────────────────────────────
onUpdate → re-synchronise le logo SI l'URL a changé → re-push des RemoteViews
```

Points de robustesse :

- **Échec réseau du logo** → le cache disque existant est conservé ; le
  widget affiche l'icône Academia Helm en attendant. Jamais d'état vide.
- **URL invalide / schéma exotique** (`file:`, `data:`) → rejetée côté
  plugin ET côté provider.
- **École sans logo** → widget avec icône Academia Helm + nom école + couleur.
- **Mode hors ligne** → le contexte vient du cache offline, la sync native
  repart de l'état persistant (store) : le widget reste juste.
- **Téléchargement hors thread UI** (executor sérialisé) ; `goAsync()` dans
  `onUpdate` garde le processus vivant, `finish()` garanti dans `finally`.

---

## 5. Contraintes et limites à connaître

1. **`updatePeriodMillis`** : plafond système à 30 minutes minimum (Android
   impose ≥ 1 800 000 ms) — mais la mise à jour **au login est immédiate**,
   c'est le cas d'usage principal.
2. **Format logo** : PNG/JPEG bitmap (le PNG est écrit en cache). Un SVG
   répondra « format non bitmap » dans les logs et sera ignoré — vérifier
   que les logos téléversés par les écoles sont des bitmaps.
3. **Doze / économiseur de batterie** : les rafraîchissements périodiques
   peuvent être groupés par le système ; l'affichage au login n'est pas
   concerné (processus vivant).
4. **iOS** : non couvert par ce livrable (aucun dossier `ios` dans le dépôt).
   Le pendant sera un widget WidgetKit avec budget de rechargement (~40-70
   actualisations/jour) ; les APIs natives (`setAlternateIconName`) exigent
   elles aussi des icônes embarquées et affichent un dialogue système.
5. **Play Store** : rien à changer (icône de fiche = icône lanceur Academia
   Helm, inchangée). Le widget apparaît dans le sélecteur de widgets après
   installation — penser à en montrer l'ajout dans l'onboarding si souhaité.

---

## 6. Tests manuels

### 6.1 Build

```bash
cd apps/mobile
npm install            # si pas déjà fait
npx cap sync android   # régénère les plugins (aucun nouveau plugin npm)
npx cap open android   # ou: cd android && ./gradlew assembleDebug
```

### 6.2 Scénario complet (téléphone/émulateur API 26+)

1. Installer l'APK debug, ouvrir l'app → `/portal` s'affiche, splash
   Academia Helm normale.
2. **Ajouter le widget** : appui long sur l'écran d'accueil → Widgets →
   Academia Helm → « Branding de l'école ». Il affiche *Academia Helm /
   Portails scolaires* sur fond navy.
3. Se connecter à une école dont le profil a un **logo PNG** et des
   couleurs (champs `primaryColor`/`secondaryColor` de l'école).
4. Observer : la barre de statut change de couleur ; 2-3 s plus tard le
   widget affiche **logo arrondi + nom de l'école** sur fond couleur école.
5. Fermer l'app (swipe), rouvrir → **l'écran de chargement natif** montre le
   logo de l'école centré sur fond couleur école.
6. Logout → widget revient à *Academia Helm / Portails scolaires* (navy) ;
   l'écran de chargement suivant reprend la splash Academia Helm.
7. Se connecter à une **autre école** → widget + statut suivent la nouvelle
   école (cache logo invalidé par changement d'URL).

### 6.3 Aides au diagnostic

```bash
# État du branding persisté (nom, URL, couleur, logo en cache ?)
adb shell run-as com.yehiortech.academiahelm cat /data/data/com.yehiortech.academiahelm/shared_prefs/school_branding.xml

# Forcer un rafraîchissement du widget (utile pour tester onUpdate)
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE \
  -n com.yehiortech.academiahelm/.SchoolWidgetProvider

# Logs du téléchargement logo / overlay
adb logcat -s SchoolWidget SchoolBranding
```

Appel natif à la main (console WebView, chrome://inspect) :

```js
Capacitor.Plugins.SchoolBranding.setSchoolBranding({
  name: 'Lycée Le Bonheur',
  logoUrl: 'https://…/logo.png',
  primaryColor: '#1B5E20',
});
Capacitor.Plugins.SchoolBranding.getSchoolBranding();
```

---

## 7. Intégration web — ce qui a été câblé

`TenantContext.tsx` est le point d'entrée unique (le contexte est reconstruit
à chaque ouverture d'app et à chaque refresh) :

```tsx
useEffect(() => {
  if (context) {
    void syncSchoolBranding(context);
    void applyTenantStatusBarColor(context);
  }
}, [context]);
```

- Les données viennent de `/api/context/bootstrap`
  (`tenant.name`, `tenant.school.name`, `tenant.school.logo`,
  `tenant.school.primaryColor|secondaryColor`).
- `school-branding.ts` est **auto-portant** (type structurel, aucune
  dépendance circulaire) et **no-op hors coquille Capacitor** — les autres
  surfaces web (desktop Tauri, navigateur, PWA) ne sont pas touchées.
- Si une autre surface de login doit pousser le branding (ex. onboarding
  multi-écoles résolu autrement), réutiliser exactement les mêmes fonctions.

## 8. Évolutions possibles (hors périmètre actuel)

- Widget **iOS** (WidgetKit) quand la coquille iOS existera.
- Deuxième taille de widget (2×2, logo seul) via une seconde ressource
  `appwidget-provider`.
- Bouton « Ajouter automatiquement le widget » (requestPinAppWidget) à la
  première connexion — natif Android 9+, à évaluer UX avant d'ajouter.
