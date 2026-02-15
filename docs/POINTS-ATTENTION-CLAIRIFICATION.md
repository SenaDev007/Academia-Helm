# Clarification des 3 points d’attention — Academia Hub

Ce document précise les trois points d’attention identifiés lors de l’analyse du projet et propose des actions pour les traiter.

---

## 1. Double stack front (Vite à la racine vs Next.js dans `web-app`)

### Constat

- **À la racine du monorepo** :
  - `package.json` contient des scripts **Vite** : `"dev": "vite"`, `"build": "tsc && vite build"`, `"preview": "vite preview"`.
  - Les dépendances sont celles d’une app **React + Vite** (react, react-dom, @vitejs/plugin-react, vite, etc.).
  - `index.html` pointe vers `/src/main.tsx`.
- **Dans `apps/web-app/`** :
  - L’application front **réellement utilisée** est en **Next.js 14** (App Router).
  - Les scripts de démarrage orchestré (`start-dev.bat`, `start:dev:win`) lancent uniquement **api-server** et **web-app** (Next.js).
- **Problème** :
  - Il n’existe **pas** de `vite.config.*` à la racine.
  - Il n’existe **pas** de `src/main.tsx` à la racine (le seul `main.ts` est dans `apps/api-server/src`).
  - Donc `npm run dev` ou `npm run build` à la racine **ne peuvent pas fonctionner** : la stack Vite à la racine est **incomplète / abandonnée**.

### Conclusion

- **Stack front de production** : uniquement **Next.js** dans `apps/web-app/`.
- La partie **Vite + React à la racine** est un **résidu** (ancien setup ou copie) et n’est plus utilisée.

### Recommandations

**Option A (recommandée) — Nettoyer la racine**

- Conserver à la racine uniquement :
  - le **nom** et la **description** du monorepo ;
  - les scripts **d’orchestration** : `start:api`, `start:frontend`, `start:dev:win`, Docker, etc. ;
  - éventuellement des **outils communs** (ex. `concurrently`, `cross-env`) en devDependencies.
- Supprimer :
  - les scripts `dev`, `build`, `preview`, `clean`, `prepack` liés à Vite ;
  - `index.html` à la racine ;
  - toutes les **dependencies** et **devDependencies** utilisées uniquement par cette ancienne app Vite (react, react-dom, vite, @vitejs/plugin-react, etc.).
- Résultat : la racine sert uniquement de **point d’entrée pour lancer l’API et le front Next.js**, sans stack front en double.

**Option B — Garder une app Vite à la racine**

- Si vous souhaitez vraiment une app Vite à la racine (ex. outil interne, démo) :
  - ajouter un `vite.config.ts` (ou `.js`) à la racine ;
  - créer `src/main.tsx` (et structure minimale) pour que `index.html` soit valide ;
  - documenter clairement la différence d’usage : Vite à la racine vs Next.js dans `web-app`.

En l’état actuel, **Option A** est la plus cohérente avec l’usage réel du projet.

---

## 2. Cohérence des dépendances (racine vs `web-app`)

### Constat

- **Racine** : nombreuses dépendances (React, Vite, Tailwind, Zustand, axios, lucide-react, recharts, jspdf, etc.) qui ne sont **pas utilisées** par un code à la racine (il n’y a pas de `src` front à la racine).
- **`apps/web-app`** : possède son propre `package.json` avec Next.js, React, Supabase, Tailwind, etc.
- Il n’y a **pas** de `workspaces` dans le `package.json` racine : chaque app a son propre `node_modules` ; il n’y a pas de partage ni de hoisting des dépendances.

Conséquences :

- **Doublons** : mêmes librairies (axios, react, react-dom, lucide-react, tailwind, etc.) peuvent exister à la racine et dans `web-app`, avec des **versions potentiellement différentes** (ex. TypeScript `^5.2.2` à la racine vs `^5.5.0` dans web-app).
- **Risque de confusion** : on ne sait pas quelle version est “la bonne” pour le front.
- **Poids et temps d’install** : `npm install` à la racine installe des paquets inutiles si la stack Vite racine est supprimée.

### Recommandations

1. **Si vous appliquez l’Option A (nettoyage de la racine)**  
   - Réduire les **dependencies** et **devDependencies** de la racine au strict nécessaire pour les scripts d’orchestration (ex. `concurrently`, `cross-env`).  
   - Toutes les dépendances du **front** restent dans `apps/web-app/package.json` ; plus de doublon front racine / web-app.

2. **Versions**  
   - Pour React / TypeScript / Tailwind, considérer **`web-app`** comme la référence pour le front.  
   - Aligner les versions entre apps si vous partagez du code plus tard (ex. via npm workspaces ou packages internes).

3. **Optionnel — Monorepo avec workspaces**  
   - Si vous voulez partager des paquets entre `api-server`, `web-app` et éventuellement la racine, ajouter dans le `package.json` racine :
     ```json
     "workspaces": [ "apps/*" ]
     ```
   - Puis gérer les dépendances au niveau des `apps/*` et garder la racine légère. À faire seulement si vous en avez besoin.

---

## 3. Dépôt Git (versioning et déploiements)

### Constat

- Le workspace **n’est pas détecté comme dépôt Git** (pas de dossier `.git`).
- Un fichier **`.gitignore`** existe déjà à la racine et est pertinent (node_modules, .env, build, .next, etc.).
- Les apps ont aussi leurs `.gitignore` (api-server, web-app, mobile-app).

Sans Git :

- pas d’historique des changements ;
- pas de branches (dev, staging, prod) ;
- pas d’intégration simple avec CI/CD (GitHub Actions, GitLab CI, etc.) ;
- travail en équipe compliqué.

### Recommandations

1. **Initialiser le dépôt** (à la racine du monorepo) :
   ```bash
   cd "d:\Projet YEHI OR Tech\Academia Hub Web"
   git init
   ```

2. **Conserver le `.gitignore` actuel** ; éventuellement ajouter (si besoin) :
   - `.env*.local`, `*.pem`, dossiers de rapports (ex. `lighthouse-report.html`) si vous ne voulez pas les versionner.

3. **Premier commit** (après avoir vérifié que rien de sensible n’est inclus) :
   ```bash
   git add .
   git status   # vérifier les fichiers ajoutés
   git commit -m "chore: initial commit - Academia Hub monorepo"
   ```

4. **Remote** : créer un dépôt distant (GitHub, GitLab, etc.) et faire le lien :
   ```bash
   git remote add origin <url-du-repo>
   git branch -M main
   git push -u origin main
   ```

Ensuite vous pourrez configurer les déploiements (ex. OVH pour frontend et API, voir docs/HEBERGEMENT-OVH.md) à partir de ce dépôt.

---

## Synthèse des actions proposées

| Point | Action prioritaire |
|--------|---------------------|
| **1. Double stack** | Nettoyer la racine : supprimer scripts Vite, `index.html`, et dépendances inutiles ; garder uniquement l’orchestration (Option A). |
| **2. Dépendances** | Après nettoyage, racine = peu de deps ; référence front = `apps/web-app`. Optionnel : workspaces si partage de code. |
| **3. Git** | `git init` à la racine, garder `.gitignore`, premier commit, puis ajout du remote et branche `main`. |

Si vous le souhaitez, on peut détailler pas à pas les modifications à faire dans le `package.json` racine (scripts et dépendances à supprimer/ajouter) et les commandes Git à exécuter dans votre environnement.
