+-----------------------------------------------------------------------+
| **YEHI OR TECH**                                                      |
|                                                                       |
| *Academia Helm \-- MediHelm \-- Travel Helm \-- LifeHelm*             |
|                                                                       |
| **SECURITY**                                                          |
|                                                                       |
| **HARDENING GUIDE**                                                   |
|                                                                       |
| *HYPER HIGH LEVEL*                                                    |
|                                                                       |
| Stack : Next.js \-- NestJS \-- PostgreSQL \-- Prisma ORM \-- Vercel   |
| \-- Fly.io \-- Cloudflare R2                                          |
|                                                                       |
| Referentiel : OWASP Top 10 2025 \-- NIST CSF \-- ISO 27001            |
|                                                                       |
| **Version 1.0 \-- Avril 2026 \-- CONFIDENTIEL**                       |
+-----------------------------------------------------------------------+

  ------------------- ---------------------------------------------------
  **Perimetre**       Academia Helm, MediHelm, Travel Helm, LifeHelm

  **Referentiels**    OWASP Top 10 2025, NIST Cybersecurity Framework,
                      ISO 27001

  **CTO & Auteur**    Senakpon Dawes Akpovi \-- YEHI OR Tech

  **Version**         1.0 \-- Document de reference officiel

  **Statut**          CONFIDENTIEL \-- Usage interne YEHI OR Tech
                      uniquement
  ------------------- ---------------------------------------------------

+-----+----------------------------------------------------------------+
| **0 | **INTRODUCTION & PHILOSOPHIE DE SECURITE**                     |
| 1** |                                                                |
|     | *Security by Design \-- Anticiper avant de reparer*            |
+-----+----------------------------------------------------------------+

**Philosophie :** *\"Security by Design\" \-- la securite n\'est pas une
couche additionnelle. Elle est integree a chaque decision
d\'architecture, de code et d\'infrastructure. Chaque developpeur est
responsable de la securite de ce qu\'il ecrit.*

**Proverbe 22:3 \--** *\"L\'homme prudent voit le danger et se met a
l\'abri.\" Cette vision guide notre approche : anticiper avant de
reparer.*

**Perimetre d\'application**

  ----------------------------------- -----------------------------------
  **+** Academia Helm \-- SaaS        **+** MediHelm \-- SaaS de gestion
  multi-tenant de gestion scolaire    pharmaceutique (donnees medicales,
  (donnees eleves, parents, notes)    ordonnances, stock)

  **+** Travel Helm \-- Marketplace   **+** LifeHelm \-- Application de
  B2B/B2C de transport (paiements,    gestion de vie personnelle (donnees
  reservations, trajets)              ultra-sensibles)
  ----------------------------------- -----------------------------------

**Niveaux de criticite**

  ------------ ---------------------------------- ------------------------
  **Niveau**   **Definition**                     **Consequence sur le
                                                  deploiement**

  CRITIQUE     Exploitation directe possible \--  Bloquer le deploiement
               impact catastrophique immediat     si non resolu

  ELEVE        Exploitation probable avec         A corriger avant mise en
               dommages significatifs             production

  MODERE       Risque reel mais necessite         A corriger dans le
               conditions specifiques             sprint suivant

  FAIBLE       Bonne pratique defensive           A integrer dans le cycle
                                                  normal
  ------------ ---------------------------------- ------------------------

+-----+----------------------------------------------------------------+
| **0 | **AUTHENTIFICATION & GESTION DES SESSIONS**                    |
| 2** |                                                                |
|     | *Premier rempart \-- Une faille ici donne acces a tout le      |
|     | reste*                                                         |
+-----+----------------------------------------------------------------+

L\'authentification est le premier rempart. Chaque plateforme YEHI OR
Tech manipule des donnees sensibles \-- une compromission d\'acces peut
etre fatale a la reputation et a la viabilite legale de l\'entreprise.

**2.1 Hachage des mots de passe**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Lecon LinkedIn 2012 : hacher sans salt = desastre. Regle
                 absolue pour toutes les plateformes YEHI OR Tech.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- bcrypt avec salt rounds minimum 12                      |
|                                                                       |
| import \* as bcrypt from \'bcrypt\';                                  |
|                                                                       |
| const SALT_ROUNDS = 12;                                               |
|                                                                       |
| const hash = await bcrypt.hash(password, SALT_ROUNDS);                |
|                                                                       |
| const isValid = await bcrypt.compare(password, hash);                 |
|                                                                       |
| // Alternative recommandee pour nouveaux projets : Argon2             |
|                                                                       |
| import \* as argon2 from \'argon2\';                                  |
|                                                                       |
| const hash = await argon2.hash(password, { type: argon2.argon2id });  |
+-----------------------------------------------------------------------+

  ------------------- ---------------------------------------------------
  **INTERDIT**        Ne jamais utiliser MD5, SHA1, ou SHA256 brut pour
                      les mots de passe.

  **Salt**            Automatiquement inclus dans bcrypt \-- ne pas gerer
                      manuellement.

  **Argon2id**        Prefere pour les nouveaux projets. Plus resistant
                      aux attaques GPU.
  ------------------- ---------------------------------------------------

**2.2 Authentification Multi-Facteurs (MFA)**

  ----------- -------------------------------------------------------------
  **ELEVE**   Obligatoire pour tous les acces administrateurs. Fortement
              recommande pour les utilisateurs finaux.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Integration TOTP avec speakeasy                         |
|                                                                       |
| import \* as speakeasy from \'speakeasy\';                            |
|                                                                       |
| const secret = speakeasy.generateSecret({ name: \'AcademiaHelm\' });  |
|                                                                       |
| const verified = speakeasy.totp.verify({                              |
|                                                                       |
| secret: secret.base32,                                                |
|                                                                       |
| encoding: \'base32\',                                                 |
|                                                                       |
| token: userToken                                                      |
|                                                                       |
| });                                                                   |
+-----------------------------------------------------------------------+

**2.3 Gestion des JWT**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Mauvaise configuration JWT = acces permanent non revocable.
                 Impact immediat sur toutes les donnees d\'un tenant.

  -------------- -------------------------------------------------------------

  ------------------------ ----------------------------------------------
  **Parametre JWT**        **Valeur requise**

  Duree access token       15 minutes maximum

  Duree refresh token      7 jours maximum

  Algorithme signature     RS256 (asymetrique) \-- jamais HS256 en
                           production

  Stockage refresh token   En base de donnees avec hash \-- jamais en
                           clair

  Revocation               Blacklist Redis operationnelle pour
                           invalidation immediate

  Payload JWT              Jamais de donnees sensibles dans le payload

  Cle secrete              Minimum 256 bits \-- stockee dans les secrets
                           Vercel/Fly.io
  ------------------------ ----------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Configuration JWT securisee                             |
|                                                                       |
| JwtModule.register({                                                  |
|                                                                       |
| secret: process.env.JWT_SECRET, // min 256 bits                       |
|                                                                       |
| signOptions: {                                                        |
|                                                                       |
| expiresIn: \'15m\',                                                   |
|                                                                       |
| algorithm: \'RS256\'                                                  |
|                                                                       |
| }                                                                     |
|                                                                       |
| })                                                                    |
+-----------------------------------------------------------------------+

**2.4 Protection Brute Force & Rate Limiting Auth**

  ----------- -------------------------------------------------------------
  **ELEVE**   Blocage progressif obligatoire sur toutes les routes
              d\'authentification.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Rate limiting avec \@nestjs/throttler                   |
|                                                                       |
| ThrottlerModule.forRoot(\[{                                           |
|                                                                       |
| name: \'auth\',                                                       |
|                                                                       |
| ttl: 60000,                                                           |
|                                                                       |
| limit: 5 // 5 tentatives max par minute                               |
|                                                                       |
| }\])                                                                  |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** 5 echecs -\> lockout 15       **+** 10 echecs -\> lockout 1 heure
  minutes                             

  **+** 15 echecs -\> lockout 24      **+** Notification email
  heures + alerte admin               automatique apres 3 tentatives
                                      echouees

  **+** CAPTCHA declenche apres 3     **+** Rate limiting : 5 requetes /
  echecs consecutifs                  minute / IP sur /auth/\*
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **0 | **CONTROLE D\'ACCES & MULTI-TENANCY**                          |
| 3** |                                                                |
|     | *Vulnerabilite #1 OWASP 2025 \-- Priorite absolue pour         |
|     | Academia Helm*                                                 |
+-----+----------------------------------------------------------------+

Pour Academia Helm specifiquement, la separation des tenants (ecoles)
est une exigence absolue et non negociable. Un directeur d\'ecole ne
doit JAMAIS voir les donnees d\'une autre ecole. Cette regle est
verifiee a chaque requete, sans exception.

**3.1 Architecture RBAC \-- Roles par Plateforme**

  ---------------- -------------- ------------------ ---------------------
  **Plateforme**   **Admin        **Admin Tenant**   **Utilisateurs**
                   Systeme**                         

  Academia Helm    SUPER_ADMIN    SCHOOL_ADMIN /     TEACHER / PARENT /
                                  DIRECTOR           STUDENT / ACCOUNTANT

  MediHelm         SUPER_ADMIN    PHARMACY_ADMIN     PHARMACIST / CLIENT

  Travel Helm      SUPER_ADMIN    COMPANY_ADMIN      DRIVER / PASSENGER

  LifeHelm         SUPER_ADMIN    N/A                USER
  ---------------- -------------- ------------------ ---------------------

**3.2 Modele Prisma \-- UserRole Multi-Tenant**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Chaque role DOIT etre scope par tenantId. Sans cette
                 contrainte, l\'isolation des ecoles est impossible.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // prisma/schema.prisma \-- Modele de roles multi-tenant              |
|                                                                       |
| model UserRole {                                                      |
|                                                                       |
| id String \@id \@default(cuid())                                      |
|                                                                       |
| userId String                                                         |
|                                                                       |
| tenantId String // TOUJOURS scoper par tenant \-- sans exception      |
|                                                                       |
| role RoleEnum                                                         |
|                                                                       |
| @@unique(\[userId, tenantId\])                                        |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

**3.3 TenantGuard NestJS \-- Validation Obligatoire**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Ce guard doit etre applique sur TOUTES les routes protegees
                 de l\'API Academia Helm. Aucune exception.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- TenantGuard : validation cross-tenant                   |
|                                                                       |
| \@Injectable()                                                        |
|                                                                       |
| export class TenantGuard implements CanActivate {                     |
|                                                                       |
| canActivate(ctx: ExecutionContext): boolean {                         |
|                                                                       |
| const req = ctx.switchToHttp().getRequest();                          |
|                                                                       |
| const userTenantId = req.user.tenantId;                               |
|                                                                       |
| const paramTenantId = req.params.tenantId;                            |
|                                                                       |
| // Toute tentative cross-tenant = ForbiddenException + audit log      |
|                                                                       |
| if (userTenantId !== paramTenantId)                                   |
|                                                                       |
| throw new ForbiddenException(\'Cross-tenant access denied\');         |
|                                                                       |
| return true;                                                          |
|                                                                       |
| }                                                                     |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

**3.4 PostgreSQL Row-Level Security (RLS)**

  ------------ -------------------------------------------------------------
  **MODERE**   Couche de securite supplementaire au niveau base de donnees
               \-- renforce le TenantGuard applicatif.

  ------------ -------------------------------------------------------------

+-----------------------------------------------------------------------+
| \-- PostgreSQL RLS \-- isolation tenant au niveau base de donnees     |
|                                                                       |
| ALTER TABLE students ENABLE ROW LEVEL SECURITY;                       |
|                                                                       |
| CREATE POLICY tenant_isolation ON students                            |
|                                                                       |
| USING (tenant_id = current_setting(\'app.current_tenant\')::uuid);    |
|                                                                       |
| \-- Appliquer sur toutes les tables critiques :                       |
|                                                                       |
| \-- students, enrollments, payments, grades, employees, etc.          |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Chaque query Prisma doit      **+** Tests automatises
  inclure un filtre tenantId \--      d\'isolation de tenant dans la
  AUCUNE exception                    CI/CD pipeline

  **+** Audit log systematique de     **+** RLS PostgreSQL comme filet de
  chaque tentative d\'acces           securite supplementaire
  cross-tenant                        
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **0 | **PREVENTION DES INJECTIONS**                                  |
| 4** |                                                                |
|     | *SQL Injection \-- XSS \-- Command Injection*                  |
+-----+----------------------------------------------------------------+

**4.1 SQL Injection \-- Prisma & Raw Queries**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Avec Prisma ORM, le risque est naturellement reduit \-- mais
                 les raw queries restent dangereuses sans precautions.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // DANGEREUX \-- A ne JAMAIS faire                                    |
|                                                                       |
| await prisma.\$queryRaw(\`SELECT \* FROM users WHERE id =             |
| \${userId}\`);                                                        |
|                                                                       |
| // CORRECT \-- Parametres types avec Prisma.sql                       |
|                                                                       |
| await prisma.\$queryRaw(Prisma.sql\`SELECT \* FROM users WHERE id =   |
| \${userId}\`);                                                        |
|                                                                       |
| // MIEUX \-- Utiliser les methodes ORM Prisma en priorite             |
|                                                                       |
| await prisma.student.findUnique({ where: { id: studentId } });        |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Utiliser EXCLUSIVEMENT les    **+** Si raw query inevitable :
  methodes ORM Prisma (findMany,      Prisma.sql template literals
  findUnique, create\...)             uniquement \-- jamais de
                                      concatenation

  **+** Activer le query logging en   **+** Revue de code systematique de
  developpement pour detecter les     toutes les raw queries avant merge
  anomalies                           
  ----------------------------------- -----------------------------------

**4.2 XSS \-- Cross-Site Scripting**

  ----------- -------------------------------------------------------------
  **ELEVE**   Academia Helm affiche des donnees eleves dans l\'interface
              \-- un XSS stocke peut exfiltrer des donnees sensibles de
              families.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // Next.js \-- Sanitization DOMPurify cote client                     |
|                                                                       |
| import DOMPurify from \'dompurify\';                                  |
|                                                                       |
| const clean = DOMPurify.sanitize(userInput);                          |
|                                                                       |
| // NestJS \-- Sanitization avec class-validator + class-transformer   |
|                                                                       |
| \@IsString()                                                          |
|                                                                       |
| \@Transform(({ value }) =\> sanitize(value))                          |
|                                                                       |
| username: string;                                                     |
|                                                                       |
| // next.config.js \-- Content Security Policy stricte                 |
|                                                                       |
| headers: \[{                                                          |
|                                                                       |
| key: \'Content-Security-Policy\',                                     |
|                                                                       |
| value: \"default-src \'self\'; script-src \'self\'                    |
| \'nonce-{NONCE}\'\"                                                   |
|                                                                       |
| }\]                                                                   |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Jamais de                     **+** HttpOnly cookies \--
  dangerouslySetInnerHTML sans        inaccessibles depuis JavaScript \--
  sanitization DOMPurify prealable    obligatoire pour les tokens

  **+** Content Security Policy (CSP) **+** Validation de toutes les
  stricte dans les headers Next.js    entrees utilisateur avant rendu
  ----------------------------------- -----------------------------------

**4.3 Validation Globale des Entrees \-- NestJS ValidationPipe**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   La validation globale doit etre activee des l\'initialisation
                 de l\'application NestJS. Sans cela, toutes les routes sont
                 vulnerables.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // main.ts \-- ValidationPipe global obligatoire                      |
|                                                                       |
| app.useGlobalPipes(new ValidationPipe({                               |
|                                                                       |
| whitelist: true, // Supprimer les champs inconnus                     |
|                                                                       |
| forbidNonWhitelisted: true, // Rejeter si champs inconnus             |
|                                                                       |
| transform: true, // Auto-transformation des types                     |
|                                                                       |
| disableErrorMessages: false,                                          |
|                                                                       |
| }));                                                                  |
+-----------------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **0 | **SECURITE DES APIS & ENDPOINTS**                              |
| 5** |                                                                |
|     | *Colonne vertebrale des plateformes \-- Sa securisation est    |
|     | non-negociable*                                                |
+-----+----------------------------------------------------------------+

**5.1 CORS \-- Cross-Origin Resource Sharing**

  ----------- -------------------------------------------------------------
  **ELEVE**   CORS trop permissif = n\'importe quel site peut appeler
              l\'API Academia Helm au nom d\'un utilisateur connecte.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS main.ts \-- CORS restrictif avec whitelist explicite        |
|                                                                       |
| app.enableCors({                                                      |
|                                                                       |
| origin: \[                                                            |
|                                                                       |
| \'https://academiahelm.com\',                                         |
|                                                                       |
| \'https://\*.academiahelm.com\', // Wildcard sous-domaines            |
|                                                                       |
| process.env.NODE_ENV === \'development\'                              |
|                                                                       |
| ? \'http://localhost:3000\'                                           |
|                                                                       |
| : \'\'                                                                |
|                                                                       |
| \].filter(Boolean),                                                   |
|                                                                       |
| credentials: true,                                                    |
|                                                                       |
| methods: \[\'GET\',\'POST\',\'PUT\',\'DELETE\',\'PATCH\'\],           |
|                                                                       |
| });                                                                   |
+-----------------------------------------------------------------------+

**5.2 Rate Limiting Differencie par Route**

  ----------- -------------------------------------------------------------
  **ELEVE**   Trois niveaux de throttling selon la sensibilite de la route.
              A configurer avant tout deploiement production.

  ----------- -------------------------------------------------------------

  --------------------------------- -------------------------------------
  **Type de route**                 **Limite**

  Routes d\'authentification        5 requetes / minute / IP

  Routes publiques (landing, SARA)  20 requetes / minute

  API generale                      100 requetes / minute
  (school.academiahelm.com)         

  Generation PDF (bulletins, recus) 10 requetes / minute

  Exports (EducMaster, CNSS)        5 requetes / heure
  --------------------------------- -------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Rate limiting differencie                               |
|                                                                       |
| \@Throttle({ default: { limit: 100, ttl: 60000 } }) // Global         |
|                                                                       |
| \@Throttle({ auth: { limit: 5, ttl: 60000 } }) // Auth routes         |
|                                                                       |
| \@Throttle({ public: { limit: 20, ttl: 60000 } }) // Routes publiques |
+-----------------------------------------------------------------------+

**5.3 Headers HTTP de Securite \-- Helmet.js**

  ----------- -------------------------------------------------------------
  **ELEVE**   Headers actives via Helmet.js sur l\'ensemble de l\'API
              NestJS. Obligatoire avant mise en production.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Helmet.js pour les headers de securite                  |
|                                                                       |
| import helmet from \'helmet\';                                        |
|                                                                       |
| app.use(helmet({                                                      |
|                                                                       |
| contentSecurityPolicy: {                                              |
|                                                                       |
| directives: { defaultSrc: \[\"\'self\'\"\] }                          |
|                                                                       |
| },                                                                    |
|                                                                       |
| hsts: {                                                               |
|                                                                       |
| maxAge: 31536000, // 1 an                                             |
|                                                                       |
| includeSubDomains: true,                                              |
|                                                                       |
| preload: true                                                         |
|                                                                       |
| },                                                                    |
|                                                                       |
| noSniff: true,                                                        |
|                                                                       |
| xssFilter: true,                                                      |
|                                                                       |
| }));                                                                  |
+-----------------------------------------------------------------------+

  ------------------------------ ----------------------------------------
  **Header HTTP**                **Protection apportee**

  X-Frame-Options: DENY          Prevention clickjacking

  X-Content-Type-Options:        Prevention MIME sniffing
  nosniff                        

  Strict-Transport-Security      Forcer HTTPS sur tous les domaines

  Referrer-Policy: strict-origin Controle des informations de referrer

  Content-Security-Policy        Prevention XSS, controle des ressources
                                 chargees
  ------------------------------ ----------------------------------------

+-----+----------------------------------------------------------------+
| **0 | **CRYPTOGRAPHIE & PROTECTION DES DONNEES**                     |
| 6** |                                                                |
|     | *Donnees d\'eleves mineurs + donnees medicales = chiffrement   |
|     | non optionnel*                                                 |
+-----+----------------------------------------------------------------+

Academia Helm traite des donnees d\'eleves mineurs. MediHelm traite des
donnees medicales. Ces categories font l\'objet de reglementations
strictes en Afrique et internationalement. Le chiffrement est une
obligation legale et ethique, pas un choix.

**6.1 Chiffrement des Donnees au Repos**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Les champs sensibles doivent etre chiffres en base avant
                 stockage \-- AES-256-GCM. Les cles ne doivent jamais etre
                 dans le code source.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // Node.js \-- Chiffrement AES-256-GCM des champs sensibles           |
|                                                                       |
| import { createCipheriv, randomBytes, createDecipheriv } from         |
| \'crypto\';                                                           |
|                                                                       |
| const ALGO = \'aes-256-gcm\';                                         |
|                                                                       |
| const KEY = Buffer.from(process.env.ENCRYPTION_KEY, \'hex\'); // 32   |
| bytes                                                                 |
|                                                                       |
| // Champs a chiffrer dans Academia Helm :                             |
|                                                                       |
| // - numeros de telephone parents                                     |
|                                                                       |
| // - adresses domicile                                                |
|                                                                       |
| // - informations medicales (infirmerie)                              |
|                                                                       |
| // - donnees de paie (salaires, comptes bancaires)                    |
+-----------------------------------------------------------------------+

  --------------------------- -------------------------------------------
  **Regle**                   **Detail**

  Champs a chiffrer (Academia Telephones, adresses, donnees medicales
  Helm)                       infirmerie, salaires, CNSS

  Gestion des cles            Key Management Service (KMS) \-- jamais
                              dans les variables .env

  Rotation des cles           Tous les 90 jours avec processus de
                              re-chiffrement planifie

  Neon PostgreSQL             Activer le chiffrement at-rest natif sur la
                              base de donnees

  Cloudflare R2               Chiffrement automatique des objets stockes
                              active
  --------------------------- -------------------------------------------

**6.2 Gestion des Variables d\'Environnement**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   Jamais de secrets dans le code source. Jamais de .env commite
                 dans Git. Verification mensuelle obligatoire.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| \# .gitignore \-- obligatoire dans tous les repositories YEHI OR Tech |
|                                                                       |
| .env                                                                  |
|                                                                       |
| .env.local                                                            |
|                                                                       |
| .env.production                                                       |
|                                                                       |
| .env.staging                                                          |
|                                                                       |
| \*.pem                                                                |
|                                                                       |
| \*.key                                                                |
|                                                                       |
| \# Fly.io \-- injection des secrets en production                     |
|                                                                       |
| fly secrets set DATABASE_URL=postgres://\... JWT_SECRET=\...          |
| ENCRYPTION_KEY=\...                                                   |
|                                                                       |
| \# Vercel \-- variables d\'environnement chiffrees via dashboard      |
|                                                                       |
| \# Jamais de NEXT_PUBLIC\_ pour les secrets \-- accessible cote       |
| client                                                                |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Audit mensuel avec            **+** Vercel : Environment
  git-secrets ou TruffleHog pour      Variables chiffrees dans le
  detecter les leaks historiques      dashboard \-- jamais en dur dans le
                                      code

  **+** Fly.io : fly secrets set \--  **+** Separation stricte des
  jamais dans fly.toml                environnements : dev / staging /
                                      production
  ----------------------------------- -----------------------------------

**6.3 HTTPS & Certificats TLS**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   TLS 1.3 minimum sur tous les domaines academiahelm.com.
                 Desactiver TLS 1.0 et 1.1.

  -------------- -------------------------------------------------------------

  ----------------------------------- -----------------------------------
  **+** TLS 1.3 minimum \--           **+** Certificats Let\'s Encrypt
  desactiver TLS 1.0 et 1.1 sur       auto-renouveles \-- alertes 30
  Fly.io et Vercel                    jours avant expiration

  **+** HSTS preload active sur tous  **+** Certificate Transparency
  les domaines YEHI OR Tech           monitoring pour detecter les
                                      certificats frauduleux
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **0 | **SECURITE DES FICHIERS & UPLOADS**                            |
| 7** |                                                                |
|     | *Bulletins \-- Photos \-- Ordonnances \-- Vecteur d\'attaque   |
|     | tres sous-estime*                                              |
+-----+----------------------------------------------------------------+

Academia Helm gere des uploads de fichiers : photos d\'eleves,
bulletins, certificats, pieces d\'identite, documents RH. C\'est l\'un
des vecteurs d\'attaque les plus sous-estimes dans les applications
SaaS.

**7.1 Validation Stricte des Fichiers**

  ----------- -------------------------------------------------------------
  **ELEVE**   Ne jamais faire confiance a l\'extension du fichier \--
              verifier les magic bytes. Un .jpg peut contenir du code
              executable.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Validation des fichiers uploades                        |
|                                                                       |
| \@UseInterceptors(FileInterceptor(\'file\', {                         |
|                                                                       |
| fileFilter: (req, file, cb) =\> {                                     |
|                                                                       |
| const allowed = \[\'image/jpeg\', \'image/png\',                      |
| \'application/pdf\'\];                                                |
|                                                                       |
| if (!allowed.includes(file.mimetype)) {                               |
|                                                                       |
| return cb(                                                            |
|                                                                       |
| new BadRequestException(\'Type de fichier non autorise\'),            |
|                                                                       |
| false                                                                 |
|                                                                       |
| );                                                                    |
|                                                                       |
| }                                                                     |
|                                                                       |
| cb(null, true);                                                       |
|                                                                       |
| },                                                                    |
|                                                                       |
| limits: { fileSize: 5 \* 1024 \* 1024 } // 5MB maximum                |
|                                                                       |
| }))                                                                   |
+-----------------------------------------------------------------------+

  ---------------------- ------------------------------------------------
  **Regle upload**       **Implementation**

  Validation MIME type   Verifier le mimetype ET les magic bytes du
                         fichier \-- pas seulement l\'extension

  Scan antivirus         ClamAV ou service cloud (VirusTotal API) avant
                         tout stockage definitif

  Renommage obligatoire  Renommer avec UUID v4 \-- jamais conserver le
                         nom original (traversal attack)

  Stockage securise      Cloudflare R2 uniquement \-- JAMAIS dans le
                         dossier public accessible en clair

  Acces temporaire       URLs signees de 15 minutes maximum pour les
                         fichiers prives

  Taille maximale        5 MB par fichier \-- configurable par type de
                         document
  ---------------------- ------------------------------------------------

+-----------------------------------------------------------------------+
| // Cloudflare R2 \-- URL signee temporaire (15 minutes)               |
|                                                                       |
| const url = await r2.getSignedUrl(\'getObject\', {                    |
|                                                                       |
| Bucket: process.env.R2_BUCKET,                                        |
|                                                                       |
| Key: fileKey, // UUID genere au stockage                              |
|                                                                       |
| Expires: 900 // 15 minutes                                            |
|                                                                       |
| });                                                                   |
+-----------------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **0 | **SECURITE INFRASTRUCTURE \-- VERCEL, FLY.IO & POSTGRESQL**    |
| 8** |                                                                |
|     | *La securite du code est inutile si l\'infrastructure est      |
|     | vulnerable*                                                    |
+-----+----------------------------------------------------------------+

**8.1 Fly.io \-- NestJS Backend**

  ----------- -------------------------------------------------------------
  **ELEVE**   Configuration Fly.io securisee requise avant tout deploiement
              en production.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| \# fly.toml \-- Configuration securisee                               |
|                                                                       |
| \[http_service\]                                                      |
|                                                                       |
| internal_port = 3001                                                  |
|                                                                       |
| force_https = true                                                    |
|                                                                       |
| auto_stop_machines = true                                             |
|                                                                       |
| \[\[vm\]\]                                                            |
|                                                                       |
| memory = \'512mb\'                                                    |
|                                                                       |
| cpu_kind = \'shared\'                                                 |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Fly.io Firewall Rules \--     **+** Endpoint /health dedie et
  whitelist IP Vercel uniquement \--  sans informations sensibles pour
  bloquer tout acces direct           les health checks

  **+** Secrets chiffres : fly        **+** Deploiements zero-downtime
  secrets set DATABASE_URL=\...       avec rolling updates \-- jamais de
  JWT_SECRET=\... ENCRYPTION_KEY=\... downtime en production
  ----------------------------------- -----------------------------------

**8.2 Vercel \-- Next.js Frontend**

  ----------- -------------------------------------------------------------
  **ELEVE**   L\'isolation des sous-domaines par tenant est critique pour
              Academia Helm.

  ----------- -------------------------------------------------------------

  ----------------------------------- -----------------------------------
  **+** Wildcard subdomain isolation  **+** Edge Middleware pour
  par tenant (\*.academiahelm.com)    validation des sous-domaines et
                                      redirection tenant

  **+** Desactiver les preview        **+** IP allowlist pour les routes
  deployments en environnement de     d\'administration
  production                          (admin.academiahelm.com)

  **+** Audit regulier des variables  **+** Vercel Analytics active pour
  NEXT_PUBLIC\_ \-- aucun secret ne   detecter les anomalies de trafic
  doit etre expose cote client        
  ----------------------------------- -----------------------------------

**8.3 Neon PostgreSQL \-- Base de Donnees**

  -------------- -------------------------------------------------------------
  **CRITIQUE**   La base de donnees est la cible principale \-- sa
                 securisation est priorite absolue.

  -------------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // prisma/schema.prisma \-- Connection securisee via pgBouncer        |
|                                                                       |
| datasource db {                                                       |
|                                                                       |
| provider = \'postgresql\'                                             |
|                                                                       |
| url = env(\'DATABASE_URL\') // SSL obligatoire : ?sslmode=require     |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

  ------------------------ ----------------------------------------------
  **Mesure de securite**   **Detail d\'implementation**

  Connexion SSL            sslmode=require dans DATABASE_URL \-- jamais
                           de connexion non chiffree

  Utilisateur minimal      Un compte DB dedie par service \-- jamais
                           l\'utilisateur superadmin

  Moindre privilege        SELECT/INSERT/UPDATE/DELETE seulement \--
                           jamais DROP, ALTER, TRUNCATE

  Backups automatiques     Quotidiens avec test de restauration mensuel
                           \-- retention 30 jours

  Row-Level Security       RLS PostgreSQL active sur toutes les tables
                           critiques (eleves, finances, RH)

  Audit des connexions     Logging de toutes les connexions et requetes
                           sensibles
  ------------------------ ----------------------------------------------

+-----+----------------------------------------------------------------+
| **0 | **MONITORING, LOGGING & INCIDENT RESPONSE**                    |
| 9** |                                                                |
|     | *\"Vous ne pouvez pas defendre ce que vous ne voyez pas\"*     |
+-----+----------------------------------------------------------------+

**9.1 Audit Logging Middleware**

  ----------- -------------------------------------------------------------
  **ELEVE**   Toute action sur des donnees sensibles d\'Academia Helm doit
              etre tracee \-- sans les donnees elles-memes.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- AuditLogMiddleware sur toutes les routes sensibles      |
|                                                                       |
| \@Injectable()                                                        |
|                                                                       |
| export class AuditLogMiddleware implements NestMiddleware {           |
|                                                                       |
| use(req: Request, res: Response, next: NextFunction) {                |
|                                                                       |
| const log = {                                                         |
|                                                                       |
| timestamp : new Date().toISOString(),                                 |
|                                                                       |
| ip : req.ip,                                                          |
|                                                                       |
| method : req.method,                                                  |
|                                                                       |
| path : req.path,                                                      |
|                                                                       |
| userId : req\[\'user\'\]?.id,                                         |
|                                                                       |
| tenantId : req\[\'user\'\]?.tenantId,                                 |
|                                                                       |
| userAgent : req.headers\[\'user-agent\'\],                            |
|                                                                       |
| // JAMAIS les donnees elles-memes dans les logs                       |
|                                                                       |
| };                                                                    |
|                                                                       |
| // Envoyer vers : Logtail / Datadog / Sentry                          |
|                                                                       |
| auditService.log(log);                                                |
|                                                                       |
| next();                                                               |
|                                                                       |
| }                                                                     |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

**9.2 Alertes Automatiques**

  ---------------------- ------------------- ----------------------------
  **Evenement detecte**  **Seuil d\'alerte** **Action automatique**

  Echecs                 \> 5 en 1 minute /  Blocage IP temporaire 15 min
  d\'authentification    IP                  

  Tentative cross-tenant 1 seule tentative   Alerte immediate + audit
                                             log + blocage

  Volume de requetes API \> 1000 req/min     Rate limit automatique +
                                             alerte Slack

  Connexion depuis       Toute connexion     Email de confirmation requis
  nouveau pays           admin               

  Erreurs 500 en masse   \> 10 en 5 minutes  Notification Slack + SMS
                                             fondateurs

  Telechargement massif  \> 100              Suspension du compte +
                         fichiers/heure      investigation

  Modif donnees          Montant \> 1M FCFA  Validation manuelle requise
  financieres                                
  ---------------------- ------------------- ----------------------------

**9.3 Plan de Reponse aux Incidents**

  --------------------- -------------------------------------------------
  **Phase**             **Objectif et delai**

  Phase 1 \-- DETECTION Alerte automatique generee \< 5 minutes apres
                        l\'evenement

  Phase 2 \--           Isolation du composant compromis \< 15 minutes
  CONFINEMENT           

  Phase 3 \-- ANALYSE   Identification de la cause racine \< 2 heures

  Phase 4 \--           Correctif deploye en production \< 24 heures
  REMEDIATION           

  Phase 5 \--           Notification utilisateurs impactes \< 72 heures
  COMMUNICATION         (obligation legale RGPD/CEDEAO)

  Phase 6 \--           Rapport complet documente et partage \< 7 jours
  POST-MORTEM           
  --------------------- -------------------------------------------------

  ----------------------------------- -----------------------------------
  **+** Retention des logs : 90 jours **+** 1 an pour MediHelm (donnees
  minimum pour Academia Helm          medicales \-- obligation legale)

  **+** Logger TOUS les acces aux     **+** Logger les tentatives
  donnees sensibles \-- sans jamais   d\'acces cross-tenant avec IP,
  inclure les donnees                 timestamp et user
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **1 | **SECURITE IA \-- ORION, ATLAS & AGENTS**                      |
| 0** |                                                                |
|     | *Surface d\'attaque emergente \-- LLM Security est critique en |
|     | 2025*                                                          |
+-----+----------------------------------------------------------------+

Les modules IA de YEHI OR Tech (ORION dans Academia Helm, ATLAS, SARA)
constituent une surface d\'attaque nouvelle. La securisation des LLM est
un domaine emergent mais critique \-- particulierement la protection
contre les prompt injections.

**10.1 Protection Prompt Injection \-- ORION**

  ----------- -------------------------------------------------------------
  **ELEVE**   Un utilisateur malveillant pourrait tenter de manipuler ORION
              pour acceder a des donnees cross-tenant ou faire fuiter des
              informations systeme.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| // NestJS \-- Sanitization obligatoire avant envoi a l\'API IA        |
|                                                                       |
| function sanitizePromptInput(userInput: string): string {             |
|                                                                       |
| // Patterns de jailbreak connus                                       |
|                                                                       |
| const blocked = \[                                                    |
|                                                                       |
| \'ignore previous\', \'system:\', \'jailbreak\', \'DAN\',             |
|                                                                       |
| \'ignore instructions\', \'forget everything\', \'act as\'            |
|                                                                       |
| \];                                                                   |
|                                                                       |
| blocked.forEach(term =\> {                                            |
|                                                                       |
| if (userInput.toLowerCase().includes(term))                           |
|                                                                       |
| throw new BadRequestException(\'Input non autorise\');                |
|                                                                       |
| });                                                                   |
|                                                                       |
| return userInput.slice(0, 2000); // Limiter la taille du contexte     |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

  ------------------------- ---------------------------------------------
  **Regle de securite IA**  **Detail d\'implementation**

  Separation                Instructions systeme strictement separees du
  systeme/utilisateur       contexte utilisateur \-- jamais melanges

  Isolation tenant dans le  Ne jamais inclure de donnees d\'autres
  contexte                  tenants dans le contexte LLM

  Audit des interactions IA Logger toutes les requetes et reponses
                            ORION/ATLAS pour audit de securite

  Budget token par tenant   Limite mensuelle de tokens par tenant pour
                            prevenir les abus de couts

  Validation des outputs    Filtrer les reponses IA avant affichage \--
                            detecter les fuites de donnees systeme
  ------------------------- ---------------------------------------------

**10.2 Agents WhatsApp \-- Securite**

  ------------ -------------------------------------------------------------
  **MODERE**   Les agents WhatsApp de YEHI OR Tech sont exposes a des abus
               si mal configures. Validation stricte requise.

  ------------ -------------------------------------------------------------

  ----------------------------------- -----------------------------------
  **+** Validation du numero          **+** Rate limiting : maximum 50
  expediteur avant traitement de      messages/heure par numero
  chaque message entrant              

  **+** Blacklist automatique des     **+** Webhook secret token pour
  numeros identifies comme abusifs    validation des requetes WhatsApp
                                      Business API

  **+** Ne jamais exposer de donnees  **+** Audit log de toutes les
  clients dans les reponses           interactions agents
  automatisees                        
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **1 | **SECURITE CHAINE D\'APPROVISIONNEMENT**                       |
| 1** |                                                                |
|     | *npm en 2025 : des milliers de packages malveillants publies   |
|     | chaque mois*                                                   |
+-----+----------------------------------------------------------------+

**11.1 Audit des Dependances npm**

  ----------- -------------------------------------------------------------
  **ELEVE**   Le developpement rapide avec Cursor implique une integration
              frequente de nouvelles dependances \-- chacune est un vecteur
              de risque.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| \# Audit de securite des dependances npm                              |
|                                                                       |
| npm audit \--audit-level=high                                         |
|                                                                       |
| \# Outil avance : Snyk (recommande)                                   |
|                                                                       |
| npx snyk test                                                         |
|                                                                       |
| npx snyk monitor                                                      |
|                                                                       |
| \# En production \-- toujours utiliser npm ci (lockfile strict)       |
|                                                                       |
| npm ci \# Pas npm install \-- npm ci respecte package-lock.json       |
| exactement                                                            |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Audit npm automatique a       **+** Mise a jour des dependances
  chaque commit dans la pipeline      critiques dans les 48h apres alerte
  CI/CD                               CVE

  **+** Verifier les nouvelles        **+** GitHub Dependabot active pour
  dependances : etoiles GitHub, date  alertes automatiques de
  MAJ, mainteneur actif               vulnerabilites
  ----------------------------------- -----------------------------------

**11.2 Pipeline CI/CD Securisee**

  ----------- -------------------------------------------------------------
  **ELEVE**   Chaque merge sur main doit passer par ces verifications
              automatiques. Bloquer le merge si le scan echoue.

  ----------- -------------------------------------------------------------

+-----------------------------------------------------------------------+
| \# .github/workflows/security.yml                                     |
|                                                                       |
| \- name: Security Audit                                               |
|                                                                       |
| run: npm audit \--audit-level=high                                    |
|                                                                       |
| \- name: Secret Scanning                                              |
|                                                                       |
| uses: trufflesecurity/trufflehog@main                                 |
|                                                                       |
| with:                                                                 |
|                                                                       |
| path: ./                                                              |
|                                                                       |
| base: main                                                            |
|                                                                       |
| \- name: SAST Analysis                                                |
|                                                                       |
| uses: github/codeql-action/analyze@v3                                 |
|                                                                       |
| with:                                                                 |
|                                                                       |
| languages: javascript, typescript                                     |
+-----------------------------------------------------------------------+

  ----------------------------------- -----------------------------------
  **+** Bloquer le merge si le scan   **+** Scanner les secrets dans
  de securite echoue \-- regle non    chaque commit avec TruffleHog avant
  contournable                        push

  **+** Analyse statique du code      **+** npm ci obligatoire en CI/CD
  (SAST) via CodeQL ou SonarQube sur  \-- jamais npm install (ignore le
  chaque PR                           lockfile)
  ----------------------------------- -----------------------------------

+-----+----------------------------------------------------------------+
| **1 | **CHECKLIST MAITRE \-- DEPLOIEMENT SECURISE**                  |
| 2** |                                                                |
|     | *A completer et signer avant chaque deploiement en production. |
|     | Aucune exception.*                                             |
+-----+----------------------------------------------------------------+

  -------- ---------------------------------------------------- --------------
  **\#**   **Action de securite requise**                       **Priorite**

  **01**   Mots de passe hasches bcrypt/Argon2 avec salt rounds **CRITIQUE**
           \>= 12                                               

  **02**   JWT : expiration 15min, RS256, blacklist Redis       **CRITIQUE**
           operationnelle                                       

  **03**   TenantGuard active sur TOUTES les routes protegees   **CRITIQUE**
           de l\'API                                            

  **04**   ValidationPipe global avec whitelist: true active    **CRITIQUE**

  **05**   Variables d\'environnement dans Vercel/Fly secrets   **CRITIQUE**
           \-- jamais en dur                                    

  **06**   HTTPS force partout \-- TLS 1.3 minimum sur tous les **CRITIQUE**
           domaines                                             

  **07**   CORS configure avec whitelist explicite des origines **ELEVE**
           autorisees                                           

  **08**   Rate limiting : auth 5/min, API 100/min, public      **ELEVE**
           20/min                                               

  **09**   Helmet.js active avec CSP, HSTS, X-Frame-Options     **ELEVE**

  **10**   Uploads : validation MIME, magic bytes, taille max,  **ELEVE**
           renommage UUID                                       

  **11**   Cloudflare R2 : URLs signees 15min \-- pas d\'acces  **ELEVE**
           public direct                                        

  **12**   npm audit sans vulnerabilite HIGH ou CRITICAL        **ELEVE**

  **13**   Logs d\'audit actives sur toutes les routes          **ELEVE**
           sensibles                                            

  **14**   Backups DB Neon configures, testes et restauration   **ELEVE**
           validee                                              

  **15**   MFA active sur tous les comptes admin et super-admin **ELEVE**

  **16**   Prisma : aucune raw query non parametree (Prisma.sql **MODERE**
           obligatoire)                                         

  **17**   PostgreSQL RLS active pour isolation des tenants sur **MODERE**
           tables critiques                                     

  **18**   Headers HTTP verifies via securityheaders.com \--    **MODERE**
           score A minimum                                      

  **19**   Scan secrets dans le repo Git avec TruffleHog        **MODERE**

  **20**   Plan de reponse aux incidents documente, accessible  **MODERE**
           et teste                                             
  -------- ---------------------------------------------------- --------------

+-----+----------------------------------------------------------------+
| **1 | **MATRICE DES RISQUES \-- VUE D\'ENSEMBLE**                    |
| 3** |                                                                |
|     | *Vecteurs d\'attaque, risques concrets et contre-mesures cles* |
+-----+----------------------------------------------------------------+

  ------------------ ---------------------------- ------------------------
  **Vecteur          **Risque concret pour        **Contre-mesure
  d\'attaque**       Academia Helm**              principale**

  SQL Injection      Acces total a la DB \--      Prisma parametre +
                     fuite de toutes les donnees  ValidationPipe global
                     eleves, finances, RH         NestJS

  Broken Access      Un tenant accede aux donnees TenantGuard + RBAC + RLS
  Control            d\'une autre ecole           PostgreSQL

  XSS Stocke         Code malveillant persistant  DOMPurify + CSP strict +
                     injecte \-- exfiltration de  HttpOnly cookies
                     tokens                       

  CSRF               Actions non voulues          Anti-CSRF tokens +
                     declenchees depuis session   SameSite=Strict cookies
                     active d\'un utilisateur     

  Brute Force Auth   Compromission de comptes     Rate limiting + lockout
                     direction, comptable,        progressif + MFA
                     super-admin                  obligatoire

  JWT Abuse          Usurpation d\'identite       Expiration 15min +
                     longue duree sans detection  blacklist Redis + RS256

  File Upload Attack Execution de code            MIME check + magic
                     malveillant via fichier      bytes + scan AV + R2
                     televerse                    hors web root

  Secrets Leak       Cles API, JWT, DB exposees   Fly secrets + Vercel
                     dans le code ou les logs     env + TruffleHog CI/CD

  Supply Chain       Package npm compromis        npm audit CI +
  Attack             injecte dans la codebase     Dependabot + npm ci
                                                  lockfile

  Prompt Injection   Manipulation de ORION ou     Sanitization input +
  IA                 SARA pour fuite de donnees   separation systeme/user
                     cross-tenant                 context

  API Scraping       Extraction massive de        Rate limiting +
                     donnees eleves ou            User-Agent filtering +
                     financieres                  Cloudflare WAF

  Data Breach DB     Acces non autorise a Neon    SSL obligatoire +
                     PostgreSQL depuis            utilisateur minimal +
                     l\'exterieur                 RLS + chiffrement
  ------------------ ---------------------------- ------------------------

+-----------------------------------------------------------------------+
| **La securite d\'une plateforme n\'est pas un etat \-- c\'est un      |
| processus continu.**                                                  |
|                                                                       |
| *Chaque fonctionnalite ajoutee cree une nouvelle surface d\'attaque.* |
|                                                                       |
| *Chaque dependance externe est un vecteur de risque.*                 |
|                                                                       |
| *\"Appliquer ce guide n\'est pas un exercice academique.*             |
|                                                                       |
| *C\'est l\'acte de droiture d\'un batisseur qui respecte ceux qui lui |
| font confiance.\"*                                                    |
|                                                                       |
| **YEHI OR Tech \-- \"Que la lumiere soit\"**                          |
|                                                                       |
| Parakou, Benin \-- Senakpon Dawes Akpovi, CTO \-- Avril 2026          |
+-----------------------------------------------------------------------+
