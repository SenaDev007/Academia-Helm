# 📋 Analyse des Workflows - Portails Multi-Types

## 🎯 Vue d'ensemble

Il existe **3 types de portails** avec des workflows d'authentification différents :

1. **Portail École (SCHOOL)** : Email + Password
2. **Portail Enseignant (TEACHER)** : Matricule + Password  
3. **Portail Parent (PARENT)** : Téléphone + OTP

## 📊 Workflows Actuels

### 1. Portail École (SCHOOL)

**Backend** :
- **Endpoint** : `POST /api/portal/auth/school`
- **DTO** : `SchoolPortalLoginDto` (tenantId, email, password)
- **Rôles autorisés** : `DIRECTOR`, `SUPER_DIRECTOR`, `ADMIN`, `ACCOUNTANT`
- **Service** : `PortalAuthService.loginSchool()`

**Frontend** :
- **Route API Next.js** : `/api/portal/auth/school` ✅ (existe)
- **Composant LoginPage** : ❌ Ne gère pas le type de portail
- **Workflow** : Utilisateur sélectionne école → redirige vers `/login?portal=school` → devrait afficher formulaire email/password

**Identifiants de test** (dans `.env`) :
```env
TEST_PROMOTEUR_EMAIL=promoteur@cspeb.bj
TEST_PROMOTEUR_PASSWORD=promoteur123

TEST_DIRECTEUR_EMAIL=s.akpovitohou@gmail.com
TEST_DIRECTEUR_PASSWORD=C@ptain.Yehioracadhub2021

TEST_SECRETAIRE_EMAIL=secretaire@cspeb.bj
TEST_SECRETAIRE_PASSWORD=secretaire123

TEST_COMPTABLE_EMAIL=comptable@cspeb.bj
TEST_COMPTABLE_PASSWORD=comptable123

TEST_SECRETAIRE_COMPTABLE_EMAIL=secretaire.comptable@cspeb.bj
TEST_SECRETAIRE_COMPTABLE_PASSWORD=seccompta123

TEST_CENSEUR_EMAIL=censeur@cspeb.bj
TEST_CENSEUR_PASSWORD=censeur123

TEST_SURVEILLANT_EMAIL=surveillant@cspeb.bj
TEST_SURVEILLANT_PASSWORD=surveillant123
```

### 2. Portail Enseignant (TEACHER)

**Backend** :
- **Endpoint** : `POST /api/portal/auth/teacher`
- **DTO** : `TeacherPortalLoginDto` (tenantId, teacherIdentifier, password)
- **Rôles autorisés** : `TEACHER` uniquement
- **Service** : `PortalAuthService.loginTeacher()`

**Frontend** :
- **Route API Next.js** : `/api/portal/auth/teacher` ✅ (existe)
- **Composant LoginPage** : ❌ Ne gère pas le type de portail
- **Workflow** : Utilisateur sélectionne école → redirige vers `/login?portal=teacher` → devrait afficher formulaire matricule/password

**Identifiants de test** (dans `.env`) :
```env
TEST_ENSEIGNANT_MATRICULE_1=EMP001
TEST_ENSEIGNANT_EMAIL_1=enseignant1@cspeb.bj
TEST_ENSEIGNANT_PASSWORD_1=enseignant123

TEST_ENSEIGNANT_MATRICULE_2=EMP002
TEST_ENSEIGNANT_EMAIL_2=enseignant2@cspeb.bj
TEST_ENSEIGNANT_PASSWORD_2=enseignant456
```

### 3. Portail Parent (PARENT)

**Backend** :
- **Endpoint** : `POST /api/portal/auth/parent`
- **DTO** : `ParentPortalLoginDto` (tenantId, phone, otp?)
- **Rôles autorisés** : `PARENT` uniquement
- **Service** : `PortalAuthService.loginParent()`
- **Workflow OTP** :
  1. Premier appel sans OTP → génère et envoie OTP
  2. Deuxième appel avec OTP → vérifie et connecte

**Frontend** :
- **Route API Next.js** : `/api/portal/auth/parent` ✅ (existe)
- **Composant LoginPage** : ❌ Ne gère pas le type de portail
- **Workflow** : Utilisateur sélectionne école → redirige vers `/login?portal=parent` → devrait afficher formulaire téléphone/OTP

**Identifiants de test** (dans `.env`) :
```env
TEST_PARENT_PHONE_1=+22912345678
TEST_PARENT_EMAIL_1=parent1@example.com
TEST_PARENT_OTP_1=123456

TEST_PARENT_PHONE_2=+22987654321
TEST_PARENT_EMAIL_2=parent2@example.com
TEST_PARENT_OTP_2=654321
```

## ❌ Problèmes Identifiés

### 1. LoginPage ne gère pas les types de portails

Le composant `LoginPage` actuel :
- Utilise toujours `/api/auth/login` (authentification standard)
- Ne lit pas le paramètre `portal` de l'URL
- N'affiche pas de formulaires différents selon le type de portail
- Ne gère pas le workflow OTP pour les parents

### 2. Routes API Next.js manquent de gestion de session

Les routes API proxy (`/api/portal/auth/*`) :
- ✅ Existent et fonctionnent
- ❌ Ne gèrent pas la session (cookies, tokens)
- ❌ Ne redirigent pas après connexion

### 3. Workflow incomplet

Le flux actuel :
1. ✅ Page portail : sélection du type de portail
2. ✅ Page portail : sélection de l'école
3. ✅ Redirection vers `/login?portal={type}&tenant={id}`
4. ❌ LoginPage ne détecte pas le type de portail
5. ❌ LoginPage utilise la mauvaise route API
6. ❌ Pas de gestion de session après connexion portail

## ✅ Solutions à Implémenter

### 1. Modifier LoginPage pour gérer les types de portails

- Lire le paramètre `portal` de l'URL
- Afficher le formulaire approprié :
  - **SCHOOL** : Email + Password
  - **TEACHER** : Matricule + Password
  - **PARENT** : Téléphone + OTP (2 étapes)
- Utiliser les bonnes routes API selon le type

### 2. Améliorer les routes API Next.js

- Gérer la session après connexion réussie
- Stocker les tokens dans les cookies
- Rediriger vers la bonne page après connexion

### 3. Ajouter gestion de session pour portails

- Créer une fonction pour stocker la session portail
- Gérer les tokens JWT retournés par le backend
- Rediriger vers `/app` ou la page appropriée

## 📝 Identifiants de Test Résumés

### Portail École
- **Promoteur** : `promoteur@cspeb.bj` / `promoteur123`
- **Directeur** : `s.akpovitohou@gmail.com` / `C@ptain.Yehioracadhub2021`
- **Secrétaire** : `secretaire@cspeb.bj` / `secretaire123`
- **Comptable** : `comptable@cspeb.bj` / `comptable123`
- **Secrétaire-Comptable** : `secretaire.comptable@cspeb.bj` / `seccompta123`
- **Censeur** : `censeur@cspeb.bj` / `censeur123`
- **Surveillant** : `surveillant@cspeb.bj` / `surveillant123`

### Portail Enseignant
- **Enseignant 1** : Matricule `EMP001` / Password `enseignant123`
- **Enseignant 2** : Matricule `EMP002` / Password `enseignant456`

### Portail Parent
- **Parent 1** : Téléphone `+22912345678` / OTP `123456`
- **Parent 2** : Téléphone `+22987654321` / OTP `654321`

## 🔄 Workflow Cible (Après Corrections)

### Portail École
1. Utilisateur sélectionne "Portail École"
2. Utilisateur sélectionne une école
3. Redirection vers `/login?portal=school&tenant={id}`
4. LoginPage affiche formulaire Email + Password
5. Soumission → `/api/portal/auth/school`
6. Backend valide et retourne token
7. Frontend stocke session et redirige vers `/app`

### Portail Enseignant
1. Utilisateur sélectionne "Portail Enseignant"
2. Utilisateur sélectionne une école
3. Redirection vers `/login?portal=teacher&tenant={id}`
4. LoginPage affiche formulaire Matricule + Password
5. Soumission → `/api/portal/auth/teacher`
6. Backend valide et retourne token
7. Frontend stocke session et redirige vers `/app`

### Portail Parent
1. Utilisateur sélectionne "Portail Parents & Élèves"
2. Utilisateur sélectionne une école
3. Redirection vers `/login?portal=parent&tenant={id}`
4. LoginPage affiche formulaire Téléphone
5. Soumission → `/api/portal/auth/parent` (sans OTP)
6. Backend génère et retourne OTP
7. LoginPage affiche champ OTP
8. Soumission → `/api/portal/auth/parent` (avec OTP)
9. Backend valide et retourne token
10. Frontend stocke session et redirige vers `/app`
