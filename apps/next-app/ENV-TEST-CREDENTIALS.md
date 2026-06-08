# 🔐 Configuration des Identifiants de Test

Ce document décrit les variables d'environnement nécessaires pour les identifiants de test de chaque type d'utilisateur de la plateforme.

## 📊 Hiérarchie des Utilisateurs

```
SYSTEM
└── PLATFORM_OWNER (DEV only)

PLATEFORME
└── SUPER_ADMIN

ÉCOLE
├── Promoteur
├── Directeur
├── Secrétaire
├── Comptable
├── Secrétaire-Comptable
├── Censeur (Secondaire)
├── Surveillant(e) (Secondaire)
└── Enseignant / Instituteur / Professeur

EXTERNES
├── Parent
└── Élève
```

## 📋 Variables d'Environnement Requises

Créez un fichier `.env.local` dans `apps/web-app/` avec les variables suivantes :

```env
# ============================================================================
# IDENTIFIANTS DE TEST - SYSTEM (DEV only)
# ============================================================================
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
PLATFORM_OWNER_SECRET=C@ptain.Yehioracadhub2021

# ============================================================================
# IDENTIFIANTS DE TEST - PLATEFORME
# ============================================================================
TEST_SUPER_ADMIN_EMAIL=superadmin@academiahub.com
TEST_SUPER_ADMIN_PASSWORD=superadmin123

# ============================================================================
# IDENTIFIANTS DE TEST - PORTAL PATRONAT
# ============================================================================
TEST_PATRONAT_ADMIN_EMAIL=patronat@test.com
TEST_PATRONAT_ADMIN_PASSWORD=patronat123

TEST_PATRONAT_OPERATOR_EMAIL=operateur@test.com
TEST_PATRONAT_OPERATOR_PASSWORD=operateur123

# ============================================================================
# IDENTIFIANTS DE TEST - ÉCOLE (CSPEB-EVEIL D'AFRIQUE EDUCATION)
# ============================================================================
# Promoteur
TEST_PROMOTEUR_EMAIL=promoteur@cspeb.bj
TEST_PROMOTEUR_PASSWORD=promoteur123

# Directeur
TEST_DIRECTEUR_EMAIL=s.akpovitohou@gmail.com
TEST_DIRECTEUR_PASSWORD=C@ptain.Yehioracadhub2021

# Secrétaire
TEST_SECRETAIRE_EMAIL=secretaire@cspeb.bj
TEST_SECRETAIRE_PASSWORD=secretaire123

# Comptable
TEST_COMPTABLE_EMAIL=comptable@cspeb.bj
TEST_COMPTABLE_PASSWORD=comptable123

# Secrétaire-Comptable
TEST_SECRETAIRE_COMPTABLE_EMAIL=secretaire.comptable@cspeb.bj
TEST_SECRETAIRE_COMPTABLE_PASSWORD=seccompta123

# Censeur (Secondaire)
TEST_CENSEUR_EMAIL=censeur@cspeb.bj
TEST_CENSEUR_PASSWORD=censeur123

# Surveillant(e) (Secondaire)
TEST_SURVEILLANT_EMAIL=surveillant@cspeb.bj
TEST_SURVEILLANT_PASSWORD=surveillant123

# Enseignant / Instituteur / Professeur
TEST_ENSEIGNANT_MATRICULE_1=EMP001
TEST_ENSEIGNANT_EMAIL_1=enseignant1@cspeb.bj
TEST_ENSEIGNANT_PASSWORD_1=enseignant123

TEST_ENSEIGNANT_MATRICULE_2=EMP002
TEST_ENSEIGNANT_EMAIL_2=enseignant2@cspeb.bj
TEST_ENSEIGNANT_PASSWORD_2=enseignant456

# ============================================================================
# IDENTIFIANTS DE TEST - EXTERNES
# ============================================================================
# Parent
TEST_PARENT_PHONE_1=+22912345678
TEST_PARENT_EMAIL_1=parent1@example.com
TEST_PARENT_OTP_1=123456

TEST_PARENT_PHONE_2=+22987654321
TEST_PARENT_EMAIL_2=parent2@example.com
TEST_PARENT_OTP_2=654321

# Élève
TEST_ELEVE_CODE_1=ELEVE001
TEST_ELEVE_EMAIL_1=eleve1@cspeb.bj
TEST_ELEVE_PASSWORD_1=eleve123

TEST_ELEVE_CODE_2=ELEVE002
TEST_ELEVE_EMAIL_2=eleve2@cspeb.bj
TEST_ELEVE_PASSWORD_2=eleve456

# ============================================================================
# INFORMATIONS ÉCOLE DE TEST (CSPEB)
# ============================================================================
TEST_SCHOOL_NAME=Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d'Afrique Education
TEST_SCHOOL_NAME_SHORT=CSPEB-Eveil d'Afrique Education
TEST_SCHOOL_ADDRESS=A 500m de la RNIE 2, 1ère Von apres EPP Bèyarou
TEST_SCHOOL_CONTACT=+229 0195722234
TEST_SCHOOL_EMAIL=cspeb-eveildafriqueeducation@gmail.com
TEST_SCHOOL_CITY=Parakou
TEST_SCHOOL_COUNTRY=Bénin
```

## 📝 Notes

- Les variables d'environnement sont utilisées uniquement côté serveur (dans les API routes)
- Le fichier `.env.local` n'est pas versionné (déjà dans `.gitignore`)
- En production, configurez ces variables dans votre plateforme de déploiement (Vercel, etc.)
- Les identifiants de test sont uniquement pour le développement et les tests