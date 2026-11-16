# Updater desktop (Tauri v2) — Guide complet

> Mise en place : task 121 (2026-11-17). Contexte : l'audit d'alignement
> web/desktop/mobile (task 120) avait confirmé que le **contenu** de la coquille
> desktop est toujours à jour (elle charge le web LIVE via
> `app.academiahelm.com`), mais que l'**updater** était inopérant :
> `releases.academiahelm.com/desktop/...` répondait 404 et `tauri.conf.json`
> contenait encore la pubkey `PUBKEY_PLACEHOLDER_REPLACE_WITH_GENERATED_KEY`.
> Ce guide documente la chaîne désormais en place.

## 1. Architecture du canal de mise à jour

```
Coquille desktop (Tauri v1.1.1+)
  └─ plugins.updater (actif, au démarrage : check_for_updates() dans src-tauri/src/lib.rs)
       └─ GET https://releases.academiahelm.com/desktop/{{target}}/{{arch}}/{{current_version}}
            (target = msi|nsis selon le bundle installé ; arch = x86_64)
            └─ releases.academiahelm.com = alias de domaine Vercel du web-app
                 └─ next.config.js → rewrite vers /desktop/{target}/{arch}/latest.json
                      └─ apps/web-app/public/desktop/{msi,nsis}/x86_64/latest.json  (manifest JSON)
                           └─ platforms.windows-x86_64.url → /desktop/{target}/{x86_64}/files/<installeur>
                                └─ apps/web-app/public/desktop/{target}/x86_64/files/ (installeur + .sig)
```

- Le manifest est servi **sans cache** (`no-store`) : une coquille voit une
  nouvelle version dès qu'elle est publiée.
- Les installeurs (noms immuables : version dans le nom) sont servis avec
  `Cache-Control: immutable, max-age=31536000`.
- Si `{{target}}` prend une valeur inattendue (ex. triple Rust), le rewrite
  générique sert le manifest **nsis** (saveur d'update recommandée par Tauri).
- La page `/desktop` (« Changer d'école ») est servie par le filesystem AVANT
  les rewrites : elle n'est jamais touchée.
- Manifest `version` ≤ version de la coquille → `Ok(None)`, l'updater journalise
  « à jour » sans aucun téléchargement. Un manifest plus récent → notification
  + téléchargement + vérification de signature (pubkey intégrée) + install
  passif.

## 2. Clé de signature (faite une fois pour toutes — task 121)

Générée avec `npx @tauri-apps/cli signer generate` :

| Élément | Emplacement (LIVRÉ, hors dépôt git) |
|---|---|
| Clé privée | `download/desktop-updater/academia-helm-updater.key` |
| Mot de passe de la clé | `download/desktop-updater/MOT-DE-PASSE-cle-signature.txt` |
| Clé publique | `download/desktop-updater/academia-helm-updater.key.pub` — **déjà intégrée** dans `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) |

⚠️ **RÈGLES ABSOLUES**
1. La clé privée et son mot de passe ne doivent **jamais** entrer dans le dépôt
   git (aucun commit, aucun patch, aucun zip). Ils sont perdus → plus aucune
   mise à jour ne pourra être signée → conserver une sauvegarde hors ligne
   (clé USB / coffre).
2. Toute coquille construite **avant** cette task (v1.1.0 avec pubkey
   placeholder) ne peut pas valider les signatures de ce canal : elle journalise
   une erreur d'updater et dégrade silencieusement. Elle devra être
   **réinstallée une fois** avec un installeur signé. Les nouvelles coquilles
   (v1.1.1+, construites avec la vraie pubkey intégrée) se mettent à jour
   toutes seules pour toujours.

## 3. Construire une version signée (machine Windows)

```powershell
cd apps/desktop

# Variables de signature (PowerShell) — adapter les chemins vers les fichiers livrés
$env:TAURI_SIGNING_PRIVATE_KEY = "C:\chemin\vers\academia-helm-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<mot de passe de la clé>"

# 1. Bump de version (tauri.conf.json → "version": "1.1.2", …)
# 2. Build signé (msi + nsis, cf. bundle.targets)
npx tauri build
```

Produit dans `src-tauri/target/release/bundle/` :
- `nsis/Academia Helm_<version>_x64-setup.exe` **+** `.exe.sig`
- `msi/Academia Helm_<version>_x64_en-US.msi` **+** `.msi.sig`

> Sans les variables d'environnement, `tauri build` échoue ou produit des
> artefacts non signés (le script de publication refusera un installeur sans
> `.sig` : c'est voulu).

## 4. Publier

```powershell
cd apps/desktop
node publish-desktop-release.mjs --notes "Ce que corrige cette version"
# --dry-run pour simuler, --base-url pour un autre domaine
```

Le script :
- relit la version de `tauri.conf.json` et refuse la pubkey placeholder ;
- copie chaque installeur + `.sig` vers
  `apps/web-app/public/desktop/{nsis,msi}/x86_64/files/` (nom sans espaces) ;
- régénère les deux `latest.json` (manifest Tauri v2 : `version`, `notes`,
  `pub_date`, `platforms.windows-x86_64.signature` = contenu du `.sig`,
  `url` = URL publique de l'installeur) ;
- affiche les commandes git à exécuter (commit + push → déploiement Vercel).

## 5. Vérifier après déploiement Vercel

```bash
# Manifest versionné (ce que la coquille appelle) :
curl -s https://releases.academiahelm.com/desktop/nsis/x86_64/1.1.0 | python -m json.tool
curl -s https://releases.academiahelm.com/desktop/msi/x86_64/1.1.0  | python -m json.tool

# Artefact (doit répondre 200 + taille cohérente) :
curl -sI https://releases.academiahelm.com/desktop/nsis/x86_64/files/Academia-Helm_<version>_x64-setup.exe
```

## 6. Notes diverses

- Le domaine `releases.academiahelm.com` est un simple **alias Vercel** du
  web-app : aucune infrastructure nouvelle à maintenir ; publier = `git push`.
- Les installeurs (~8–15 Mo) transitent par le dépôt git (dossier
  `public/desktop/.../files/`). Si le dépôt grossit trop, basculer les
  `files/` vers le bucket R2 existant (`downloads.academiahelm.com`) : seules
  les `url` du manifest changeront (option `--base-url` du script + dépose
  manuelle) — les coquilles n'ont besoin d'aucune modification.
- La notification d'update s'affiche via `tauri-plugin-notification`
  (`check_for_updates()` dans `src-tauri/src/lib.rs`) ; l'installation Windows
  est en mode `passive` (`plugins.updater.windows.installMode`).
- Mobile : non concerné — la coquille Capacitor se met à jour via le Play
  Store (App Links déjà vérifiés, task 120) ; le web est déployé à chaque push.
