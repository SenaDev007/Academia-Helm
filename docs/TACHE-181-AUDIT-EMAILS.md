# Tâche 181 — Audit et alignement des envois d'e-mails (Cahier des charges §9)

**Objectif** : tout e-mail de l'application passe par le service central
`CentralEmailService.send()` (dossier `apps/api-server/src/school-email/`).
Règle de routage (précision promoteur 2026-11-24) :

| Type d'e-mail | Transporteur |
|---|---|
| Système Academia Helm (`category: system` — reset mdp, invitations, OTP, vérification d'adresse, facturation SaaS, marketing plateforme) | **Resend plateforme** (hors plafond, hors file) |
| Écoles tenantes (tous les modules) | **SMTP de l'école uniquement** (OAuth2 en phase 2) — sans configuration : erreur explicite « Configurez l'e-mail de votre école dans Paramètres, onglet E-mail », **aucun repli Resend** |

## Architecture de l'alignement

Le module Communication expose `EmailService.sendCategorized({ tenantId, category, module, to, … })`.
Depuis la tâche 181, son **étape de transport** délègue à
`CentralEmailService.deliverForCommunicationModule()` : les appelants
`sendCategorized` (porteurs du tenantId) sont donc alignés **automatiquement** —
avec conservation de l'EmailLog, du tracking open/click et des reply-to tokens.
Les appelants `sendEmail` bruts (sans contexte école) ont été convertis vers
`sendCategorized` lorsqu'un tenantId était disponible ; ceux qui restent sont
des envois système/plateforme par nature.

## Tableau récapitulatif (fichier × fonction × conversion)

### Module Pédagogie

| Fichier | Fonction | Ancien appel | Nouvel appel (tâche 181) |
|---|---|---|---|
| pedagogy/pedagogy-notification.service.ts | notifyTeacherSubmittedDocument, etc. | sendCategorized | sendCategorized → **bridge central → SMTP école** (auto) |
| pedagogy/pedagogical-space.service.ts | envois récapitulatifs enseignant (PDF) | sendCategorized | idem (auto) |
| pedagogy/services/pedagogical-notification.service.ts | sendEmail privé | **no-op** (simple log, aucun envoi réel) | inchangé — rien à convertir |

### Module Élève

| Fichier | Fonction | Ancien appel | Nouvel appel |
|---|---|---|---|
| students/services/admission-notification.service.ts | wrapper privé sendEmail | sendCategorized si category+tenantId | inchangé (déjà tracé) → bridge central (auto) |
| students/services/parent-account-notification.service.ts | envois comptes parents | sendCategorized | idem (auto) |
| students/student-transfer.service.ts | notifySchool (email école destinataire) | **sendEmail brut** | **converti** : sendCategorized (ADMINISTRATIF / transfert_ecole) |
| students/student-transfer.service.ts | sendParentEmail | **sendEmail brut** | **converti** : sendCategorized (ADMINISTRATIF / transfert_parent, tenantId remonté depuis Student) |

### Module Finance

| Fichier | Fonction | Ancien appel | Nouvel appel |
|---|---|---|---|
| finance/receipt-notification-finance.service.ts | reçus de paiement (PJ PDF) | sendCategorized | idem (auto) |
| finance/recovery-notification-finance.service.ts | relances de scolarité | sendCategorized | idem (auto) |
| finance/recovery-reminder-email.service.ts | rappels programmés | sendCategorized | idem (auto) |
| finance/compta-auto-export.service.ts | export comptable mensuel (PJ) | **sendEmail brut** | **converti** : sendCategorized (FINANCE / export_comptable_auto) |
| billing/services/* (invoice, fedapay, subscription-lifecycle, student-count-verifier) | facturation SaaS de la PLATEFORME | sendEmail | inchangé — e-mails système (émis par Academia Helm, pas par l'école) |

### Module Examen

| Fichier | Fonction | Ancien appel | Nouvel appel |
|---|---|---|---|
| modules/exams/distinctions/distinctions-notification.service.ts | publication résultats/distinctions | sendCategorized | idem (auto) |
| federis/federis-school-exams.service.ts | examens réseau Federis | sendCategorized | idem (auto) |

### Module Personnel RH

| Fichier | Fonction | Ancien appel | Nouvel appel |
|---|---|---|---|
| hr/recruitment-notification.service.ts | notifications recrutement | sendCategorized (+ fallback legacy documenté si jeté) | idem (auto) — le fallback sendEmail reste l'ultime repli non tracé |
| hr/services/staff-credential.service.ts | identifiants personnel | sendCategorized | idem (auto) |
| hr/services/staff-card.service.ts | cartes personnel | sendCategorized | idem (auto) |
| hr/services/test-questionnaire.service.ts | questionnaires | sendCategorized | idem (auto) |
| hr/services/recruitment-daily-summary.service.ts | résumé quotidien recruteur | sendCategorized (+ replyToOverride) | idem (auto) |
| hr/services/document-upload.service.ts | documents candidats | sendCategorized | idem (auto) |
| hr/leaves-prisma.service.ts | sendLeaveDecisionEmail (congés) | **sendEmail brut** | **converti** : sendCategorized (RECRUTEMENT / conge_*) |
| hr/attendance-prisma.service.ts | sendOvertimeDecisionEmail (heures sup) | **sendEmail brut** | **converti** : sendCategorized (RECRUTEMENT / heures_sup_*) |

### Module Communication / Paramètres

| Fichier | Fonction | Ancien appel | Nouvel appel |
|---|---|---|---|
| communication/services/email.service.ts | sendCategorized — étape transport | sendEmail (provider global) | **deliverForCommunicationModule()** (service central : system→Resend, école→SMTP + file + plafond) |
| communication/services/scheduled-email-dispatcher.service.ts | envois programmés | sendCategorized si category, sinon sendEmail legacy | inchangé — la voie catégorisée passe par le bridge ; la voie legacy (sans catégorie) est un repli documenté |
| settings/settings.controller.ts | invitation de signature (magic-link) | **sendEmail brut** | **converti** : sendCategorized (ADMINISTRATIF / invitation_signature) |

### E-mails système (restent sur Resend plateforme, par design)

| Fichier | Usage |
|---|---|
| auth/auth.service.ts | OTP de connexion (4 appels) |
| onboarding/services/otp.service.ts, onboarding/contract.controller.ts | OTP + contrats d'onboarding (avant configuration e-mail de l'école) |
| portal/services/portal-auth.service.ts | OTP portail parents |
| settings/services/bilingual-settings.service.ts | OTP activation bilingue → YEHI OR Tech |
| saisiemaster/saisiemaster-followup.service.ts | relances marketing plateforme (prospects sans tenant) |
| federis/federis-school-directory.service.ts, federis-fedapay.service.ts | prospection répertoire + identifiants Federis (entités plateforme) |
| school-email/central-email.service.ts | category `system` → sendEmail plateforme |
| communication/services/email.service.ts | voie sendEmail (config minimale sans service central) |
| web-app : api/contact, lib/admin/admin-auth-server, lib/auth/school-google-auth-server | formulaire contact public + resets de mot de passe (Resend SDK, e-mails plateforme) |

## Règle de lint (CDC §9.4)

`apps/api-server/.eslintrc.js` — `no-restricted-imports` (error) sur
`nodemailer` et `resend`, autorisés UNIQUEMENT dans :

1. `src/school-email/**` — le dossier du service central ;
2. `src/communication/services/email.service.ts` — transport plateforme
   historique des e-mails système (documenté ci-dessus).

Vérification programmatique effectuée : import `nodemailer`/`resend` ailleurs
→ **bloqué** ; fichier propre → passe. Le web-app conserve ses 3 fichiers
système (contact + 2 resets de mot de passe) documentés dans le tableau.

## Vérifications effectuées

- `tsc --noEmit` sur le module `src/school-email/` complet (harnais mini-client
  Prisma) : **0 erreur**.
- Tests unitaires logique pure (`scripts/test-school-email-181.ts`) : **41/41**
  (chiffrement AES-256-GCM, IV unique, clé différente → Expiré, classification
  4xx/5xx/auth, masquage des secrets dans les messages d'erreur, pied de page
  anti-XSS, normalisation destinataires, constantes de file, DTOs).
- Parse syntaxique des 12 fichiers back + 6 fichiers front : OK.
- Migration appliquée en production (3 tables, 9 index, `_prisma_migrations`).
