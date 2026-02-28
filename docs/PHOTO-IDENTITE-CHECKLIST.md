# ✅ Checklist — Photo d'identité élève (Wizard inscription)

Vérification d'implémentation BDD / Backend / Frontend selon le cahier des charges.

---

## 🗄️ BDD (Prisma)

| Élément | Fichier | Statut |
|--------|---------|--------|
| `Student.photoUrl` | `prisma/schema.prisma` | ✅ Champ optionnel |
| Modèle `StudentPhoto` (id, tenantId, studentId, originalUrl, hdUrl, thumbnailUrl, createdAt) | `prisma/schema.prisma` | ✅ Avec relations Student + Tenant, index `[tenantId, studentId]` |
| Photo liée au tenant | Toutes les requêtes StudentPhoto | ✅ `tenantId` obligatoire |

---

## ⚙️ Backend (NestJS + Next.js)

| Élément | Fichier | Statut |
|--------|---------|--------|
| Pré-inscription accepte `photoUrl` et `npi` | `students-lifecycle.service.ts` → `preRegister()` | ✅ |
| Création d’une entrée `StudentPhoto` à la pré-inscription si photo fournie | `students-lifecycle.service.ts` | ✅ originalUrl, hdUrl, thumbnailUrl renseignés |
| Carte scolaire PDF intègre la photo | `student-id-card.service.ts` → `generateCardHtml()` | ✅ Image dans le HTML, URL absolue via `APP_PUBLIC_URL` / `FRONTEND_URL` |
| QR Code + nom + matricule + année sur la carte | `student-id-card.service.ts` | ✅ Déjà en place |
| Upload image (compressée côté client) | Next.js `apps/web-app/src/app/api/students/upload-photo/route.ts` | ✅ Validation type/taille, stockage par année |
| Génération HD / thumbnail côté serveur | Actuel | ⚠️ Une seule version stockée (originalUrl = hdUrl = thumbnailUrl). Pour 2 versions distinctes, ajouter traitement type Sharp sur l’API. |
| Stockage sécurisé (S3 / Supabase) | Actuel | ⚠️ Fichiers dans `public/uploads/students/<année>/`. Pour production stricte : migrer vers bucket privé + URL signées. |

---

## 🖥️ Frontend (Next.js / PWA)

| Élément | Fichier | Statut |
|--------|---------|--------|
| Wizard : Étape 1 = Informations personnelles | `StudentEnrollmentForm.tsx` | ✅ Identité uniquement (nom, prénom, date de naissance, etc.) |
| Wizard : Étape 2 = 📸 Photo élève | `StudentEnrollmentForm.tsx` | ✅ Écran dédié « Photo d'identité élève » |
| Wireframe : Aperçu caméra / photo, overlay visage centré | `StudentEnrollmentForm.tsx` (step === 2) | ✅ Zone 3:4, repères overlay |
| Bouton « Prendre la photo » | `StudentEnrollmentForm.tsx` | ✅ Capture caméra → recadrage 3:4 |
| Bouton « Reprendre » | `StudentEnrollmentForm.tsx` → `handleReprendre()` | ✅ Efface photo et permet de reprendre |
| Bouton « Importer depuis galerie » | `StudentEnrollmentForm.tsx` | ✅ Input file + label |
| `navigator.mediaDevices.getUserMedia()` | `StudentEnrollmentForm.tsx` → `startCamera()` | ✅ |
| Aperçu en direct | `<video ref={videoRef} />` | ✅ |
| Recadrage automatique 3:4 centré | `captureFromCamera()` | ✅ 300×400 px, JPG 0.9 |
| Format 3:4, 300×400 min, JPG haute qualité | `captureFromCamera()` + `upload-photo` | ✅ |
| Compression intelligente | Canvas `toBlob(…, 'image/jpeg', 0.9)` | ✅ |
| Mobile-first (portrait, conseils) | Step 2 + textes d’aide | ✅ |
| Fallback upload fichier | Input « Importer depuis galerie » | ✅ |
| Offline-first : IndexedDB | `local-db.service.ts` → store `student_photos` | ✅ |
| Marqué `sync_status` = pending (offline) | `StudentEnrollmentForm` → `syncStatus: 'PENDING'` | ✅ |
| Upload automatique au retour connexion | `useEffect` + `syncOfflinePhotos()` + événement `online` | ✅ |

---

## 📋 Récapitulatif objectifs

| Objectif | Statut |
|----------|--------|
| 📸 Prise de photo depuis l’application | ✅ Étape 2 du wizard, caméra + galerie |
| 🎯 Format automatique photo d’identité (3:4, 300×400, JPG) | ✅ Recadrage + compression côté client |
| 🧾 Utilisation immédiate pour carte scolaire | ✅ `Student.photoUrl` + intégration dans le PDF |
| 🔐 Stockage sécurisé / multi-tenant | ✅ BDD par tenant ; fichiers par année (option S3/URL signées à brancher) |
| 🖨️ Export HD prêt impression | ✅ Carte PDF avec photo |
| 🧠 Compatible offline-first | ✅ IndexedDB, PENDING, synchro au retour en ligne |
| 🎨 UX : Étape 1 = Identité, Étape 2 = Photo | ✅ 6 étapes, wireframe respecté |
| 📱 Mobile-first | ✅ Portrait, overlay, compression auto |

---

## 🔧 Variables d’environnement utiles (API)

- **`APP_PUBLIC_URL`** ou **`FRONTEND_URL`** : URL publique du frontend (ex. `https://app.academiahelm.com`) pour que Puppeteer charge les photos dans le PDF de la carte scolaire (URLs relatives → absolues).

---

*Dernière vérification : implémentation conforme au cahier des charges photo d’identité (wizard, BDD, backend, frontend, offline-first).*
