Très bien. On attaque le **Module Communication** — et ici, il faut être ambitieux. Dans une école, une mauvaise communication coûte cher : parents frustrés, enseignants mal informés, paiements retardés, absences non suivies, documents oubliés, bulletins non consultés. Donc ce module doit être un **centre de commandement multicanal**, pas une simple boîte de messages.

# ACADEMIA HELM

## MODULE COMMUNICATION & NOTIFICATIONS

Le **Module Communication & Notifications** est le centre nerveux des échanges entre l’école, les parents, les élèves, les enseignants, l’administration et la direction.

Il ne doit pas être conçu comme un simple système d’envoi de messages.
Il doit être pensé comme une **plateforme de communication scolaire intelligente, traçable, multicanale et automatisée**.

Objectif : permettre à chaque établissement de communiquer rapidement, clairement et officiellement avec les bonnes personnes, au bon moment, via le bon canal.

---

# 1. Objectifs stratégiques

Le module doit permettre de :

```txt
centraliser toutes les communications scolaires
envoyer des messages individuels ou groupés
gérer les notifications internes
gérer les annonces officielles
gérer les campagnes de communication
automatiser les relances
notifier les parents, élèves et enseignants
suivre la lecture et la réception des messages
gérer les modèles de messages
connecter WhatsApp, email, SMS, portail web et notifications push
produire des rapports de communication
permettre à ORION de détecter les retards, oublis et anomalies de communication
```

La règle métier est simple :

```txt
Une communication scolaire non tracée est une communication fragile.
Une communication automatisée mais non contrôlée est un risque.
Une communication bien ciblée devient un levier de gestion.
```

---

# 2. Positionnement dans Academia Helm

Le module Communication est **transversal**.

Il interagit avec :

```txt
Module Élèves & Scolarité
Module Enseignants & RH
Module Examens, Notes & Bulletins
Module Finance & Scolarité
Module Présence & Discipline
Module Pédagogie
Module Bibliothèque virtuelle
Module Administration
Module Paramètres
Portail Parent/Élève
Portail Enseignant
Portail École
ORION
Sara AI
Atlas
Audit
```

Concrètement, presque tous les modules peuvent déclencher une communication :

```txt
absence élève
retard
paiement reçu
paiement en retard
note publiée
bulletin disponible
document manquant
devoir publié
annonce de direction
convocation parent
rappel enseignant
campagne de réinscription
```

---

# 3. Portée fonctionnelle du module

Le module couvre :

```txt
1. Tableau de bord communication
2. Messagerie interne
3. Annonces officielles
4. Notifications automatiques
5. Campagnes de communication
6. Modèles de messages
7. Communication parents
8. Communication enseignants
9. Communication élèves
10. Communication administrative
11. Canaux SMS, Email, WhatsApp, Push, Portail
12. Historique et traçabilité
13. Rapports & statistiques
14. Paramétrage communication
15. ORION Communication
```

---

# 4. Liste complète des onglets du module

## ONGLET 1 — Tableau de bord Communication

Objectif : donner une vue globale de toutes les communications.

Fonctionnalités :

```txt
messages envoyés
messages reçus
messages non lus
annonces actives
campagnes en cours
notifications échouées
taux de lecture
taux de livraison
alertes ORION
activité par canal
activité par utilisateur
activité par module source
```

Indicateurs clés :

```txt
nombre total de messages envoyés
nombre de messages urgents
nombre de messages non lus
nombre de campagnes actives
nombre de notifications échouées
taux moyen de lecture
taux moyen de livraison
familles non joignables
canaux en panne
communications critiques non confirmées
```

---

## ONGLET 2 — Messagerie interne

Objectif : permettre les échanges internes entre utilisateurs de la plateforme.

Fonctionnalités :

```txt
conversations individuelles
conversations de groupe
messages administration → enseignant
messages enseignant → administration
messages direction → personnel
pièces jointes
accusés de lecture
statut lu/non lu
recherche
archivage
modération si activée
restriction selon rôle
```

Cas d’usage :

```txt
un enseignant écrit à l’administration
la direction écrit à tous les enseignants
le secrétariat contacte un parent via le portail
un responsable pédagogique échange avec une équipe de classe
```

---

## ONGLET 3 — Annonces officielles

Objectif : publier des annonces institutionnelles.

Fonctionnalités :

```txt
création d’annonce
ciblage par audience
ciblage par niveau
ciblage par classe
ciblage par rôle
ciblage par portail
date de publication
date d’expiration
priorité
pièce jointe
confirmation de lecture
affichage portail
archivage
```

Exemples :

```txt
rentrée scolaire
réunion des parents
changement d’emploi du temps
fermeture exceptionnelle
rappel administratif
événement scolaire
```

---

## ONGLET 4 — Notifications automatiques

Objectif : gérer toutes les notifications générées automatiquement par les autres modules.

Sources possibles :

```txt
inscription validée
paiement reçu
paiement en retard
absence élève
retard élève
note publiée
bulletin disponible
document manquant
devoir publié
sanction disciplinaire
événement pédagogique
bibliothèque virtuelle mise à jour
convocation
changement de classe
mouvement scolaire
```

Fonctionnalités :

```txt
activation/désactivation par type
choix du canal
délai d’envoi
relance automatique
modèle associé
historique
statut de livraison
```

Exemple concret :

```txt
Si un élève est marqué absent à 08h15,
le système peut notifier automatiquement le parent à 08h20
par WhatsApp, SMS ou portail selon la configuration de l’école.
```

---

## ONGLET 5 — Campagnes de communication

Objectif : envoyer des messages planifiés ou massifs.

Fonctionnalités :

```txt
campagne SMS
campagne email
campagne WhatsApp
campagne portail
campagne multicanale
ciblage avancé
planification
segmentation
prévisualisation
test d’envoi
validation avant diffusion
suivi des livraisons
statistiques de campagne
```

Cas d’usage :

```txt
relance scolarité
réunion parents
rappel documents
campagne de réinscription
information rentrée
campagne pédagogique
communication d’urgence
```

Règle stricte :

```txt
Toute campagne massive doit passer par une prévisualisation et une validation.
```

---

## ONGLET 6 — Modèles de messages

Objectif : standardiser les communications.

Fonctionnalités :

```txt
modèles SMS
modèles email
modèles WhatsApp
modèles notification push
modèles annonce
variables dynamiques
version française
version anglaise
prévisualisation
catégorisation
validation
statut actif/inactif
```

Variables possibles :

```txt
nom élève
prénom élève
classe
niveau
nom parent
montant dû
date limite
nom enseignant
matière
note
lien portail
nom école
```

Exemple de modèle :

```txt
Bonjour {{parentName}},
Nous vous informons que {{studentName}} est absent(e) ce jour.
Merci de contacter l’administration si nécessaire.
{{schoolName}}
```

---

## ONGLET 7 — Communication Parents

Objectif : gérer les échanges avec les parents et responsables.

Fonctionnalités :

```txt
messages individuels aux parents
messages groupés par classe
messages par niveau
messages financiers
messages pédagogiques
messages disciplinaires
convocations
relances documents
relances paiement
historique par famille
suivi lecture portail parent
restrictions selon rôle
```

Ce volet doit être très propre, car les parents jugent souvent la qualité d’une école à travers la qualité de sa communication. C’est brutal, mais vrai.

---

## ONGLET 8 — Communication Enseignants

Objectif : centraliser les échanges avec les enseignants.

Fonctionnalités :

```txt
annonces direction
messages administration
notifications pédagogiques
rappels saisie notes
rappels présence
rappels cahier de textes
communication par département
communication par matière
communication par classe
documents pédagogiques
alertes RH si reliées
```

Exemples :

```txt
rappel de saisie des notes
notification de conseil de classe
information sur une réunion pédagogique
partage d’un document administratif
alerte sur retard de cahier de textes
```

---

## ONGLET 9 — Communication Élèves

Objectif : communiquer avec les élèves selon leur niveau et leur portail.

Fonctionnalités :

```txt
annonces élèves
rappels devoirs
rappels examens
notifications notes
notifications bibliothèque
informations vie scolaire
messages par classe
messages par niveau
messages par groupe
restrictions selon âge/niveau
visibilité parent si activée
```

Règle recommandée :

```txt
Pour les plus jeunes niveaux, la communication élève doit être visible ou relayée aux parents.
```

---

## ONGLET 10 — Communication Administrative

Objectif : gérer les communications officielles internes à l’établissement.

Fonctionnalités :

```txt
notes de service
circulaires internes
convocations
communications direction
communications secrétariat
communications comptabilité
communications vie scolaire
accusé de lecture obligatoire
archivage administratif
export PDF
traçabilité
```

Ce volet doit servir de registre officiel des communications internes.

---

## ONGLET 11 — Canaux & Connecteurs

Objectif : configurer les canaux d’envoi.

Canaux :

```txt
Email
SMS
WhatsApp
Notifications push
Notifications portail
Webhooks
API externe
```

Fonctionnalités :

```txt
configuration fournisseur email
configuration fournisseur SMS
configuration WhatsApp Business
configuration push
test de canal
statut du canal
quotas
coûts estimés
erreurs
fallback automatique
```

Exemple de fallback :

```txt
Si WhatsApp échoue, envoyer par SMS.
Si SMS échoue, afficher une alerte dans le portail.
```

---

## ONGLET 12 — Historique & Traçabilité

Objectif : conserver la preuve de toutes les communications.

Fonctionnalités :

```txt
journal des messages
statut envoyé
statut livré
statut lu
statut échoué
date d’envoi
canal utilisé
expéditeur
destinataire
module source
contenu envoyé
pièces jointes
erreurs
preuve de lecture
export
```

Règle métier :

```txt
Toute communication officielle doit être historisée.
```

---

## ONGLET 13 — Rapports & Analytique Communication

Objectif : piloter l’efficacité des communications.

Indicateurs :

```txt
messages envoyés
messages livrés
messages échoués
taux de lecture
taux de réponse
canal le plus utilisé
canal le plus fiable
communications par module
communications par classe
communications par niveau
campagnes performantes
relances efficaces
familles non joignables
enseignants non réactifs
alertes ORION
```

---

## ONGLET 14 — Paramétrage Communication

Objectif : configurer les règles globales du module.

Paramètres :

```txt
canaux autorisés
modèles obligatoires
validation avant campagne
limite d’envoi par jour
règles de priorité
heures autorisées d’envoi
politique de relance
langue par défaut
bilingue FR/EN
consentement communication
règles de confidentialité
archivage automatique
durée de conservation
seuils ORION
```

---

# 5. Architecture frontend

## Route principale

```txt
/communication
```

## Routes recommandées

```txt
/communication/dashboard
/communication/messages
/communication/announcements
/communication/automated-notifications
/communication/campaigns
/communication/templates
/communication/parents
/communication/teachers
/communication/students
/communication/administration
/communication/channels
/communication/history
/communication/reports
/communication/settings
```

## Composants principaux

```txt
CommunicationLayout
CommunicationSidebar
CommunicationDashboardPage
InternalMessagingPage
AnnouncementsPage
AutomatedNotificationsPage
CommunicationCampaignsPage
MessageTemplatesPage
ParentCommunicationPage
TeacherCommunicationPage
StudentCommunicationPage
AdministrativeCommunicationPage
CommunicationChannelsPage
CommunicationHistoryPage
CommunicationReportsPage
CommunicationSettingsPage
```

---

# 6. Architecture backend

## Services recommandés

```txt
CommunicationService
MessageService
AnnouncementService
NotificationService
CampaignService
MessageTemplateService
ParentCommunicationService
TeacherCommunicationService
StudentCommunicationService
AdministrativeCommunicationService
CommunicationChannelService
CommunicationDeliveryService
CommunicationReportService
CommunicationSettingsService
CommunicationOrionService
CommunicationAuditService
```

## Routes API recommandées

```http
GET    /api/communication/dashboard
GET    /api/communication/messages
POST   /api/communication/messages
GET    /api/communication/announcements
POST   /api/communication/announcements
PATCH  /api/communication/announcements/:id
GET    /api/communication/notifications
POST   /api/communication/notifications/send
GET    /api/communication/campaigns
POST   /api/communication/campaigns
POST   /api/communication/campaigns/:id/send
GET    /api/communication/templates
POST   /api/communication/templates
PATCH  /api/communication/templates/:id
GET    /api/communication/channels
PATCH  /api/communication/channels/:id
POST   /api/communication/channels/:id/test
GET    /api/communication/history
GET    /api/communication/reports
GET    /api/communication/settings
PATCH  /api/communication/settings
GET    /api/communication/orion-alerts
```

---

# 7. Modèles Prisma recommandés

## CommunicationMessage

```prisma
model CommunicationMessage {
  id            String @id @default(cuid())
  tenantId      String

  senderId      String?
  subject       String?
  body          String
  type          CommunicationMessageType
  priority      CommunicationPriority @default(NORMAL)

  sourceModule  String?
  sourceEntityId String?

  status        CommunicationStatus @default(DRAFT)

  scheduledAt   DateTime?
  sentAt        DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId])
  @@index([senderId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
}
```

## CommunicationRecipient

```prisma
model CommunicationRecipient {
  id            String @id @default(cuid())
  tenantId      String

  messageId     String
  recipientId   String?
  recipientType CommunicationRecipientType

  channel       CommunicationChannelType
  address       String?

  deliveryStatus CommunicationDeliveryStatus @default(PENDING)
  deliveredAt   DateTime?
  readAt        DateTime?
  failedAt      DateTime?
  errorMessage  String?

  createdAt     DateTime @default(now())

  @@index([tenantId])
  @@index([messageId])
  @@index([recipientId])
  @@index([deliveryStatus])
}
```

## CommunicationTemplate

```prisma
model CommunicationTemplate {
  id            String @id @default(cuid())
  tenantId      String

  name          String
  code          String
  category      CommunicationTemplateCategory
  channel       CommunicationChannelType

  subjectFr     String?
  bodyFr        String
  subjectEn     String?
  bodyEn        String?

  variables     Json?
  isActive      Boolean @default(true)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([category])
  @@index([channel])
}
```

## CommunicationCampaign

```prisma
model CommunicationCampaign {
  id            String @id @default(cuid())
  tenantId      String

  name          String
  description   String?
  channel       CommunicationChannelType
  audience      Json
  content       Json

  status        CampaignStatus @default(DRAFT)

  scheduledAt   DateTime?
  sentAt        DateTime?

  totalRecipients Int @default(0)
  deliveredCount  Int @default(0)
  failedCount     Int @default(0)
  readCount       Int @default(0)

  createdById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId])
  @@index([status])
  @@index([channel])
}
```

## CommunicationSettings

```prisma
model CommunicationSettings {
  id            String @id @default(cuid())
  tenantId      String @unique

  enabledChannels Json?
  sendingRules    Json?
  privacyRules    Json?
  retentionRules  Json?
  orionThresholds Json?
  automationRules Json?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

# 8. Enums Prisma recommandés

```prisma
enum CommunicationMessageType {
  INTERNAL
  ANNOUNCEMENT
  NOTIFICATION
  CAMPAIGN
  ADMINISTRATIVE
  PARENT
  TEACHER
  STUDENT
}

enum CommunicationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum CommunicationStatus {
  DRAFT
  SCHEDULED
  SENT
  PARTIAL
  FAILED
  ARCHIVED
}

enum CommunicationRecipientType {
  USER
  STUDENT
  PARENT
  TEACHER
  STAFF
  CLASS
  LEVEL
  GROUP
  ROLE
}

enum CommunicationChannelType {
  PORTAL
  EMAIL
  SMS
  WHATSAPP
  PUSH
  WEBHOOK
}

enum CommunicationDeliveryStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
  CANCELLED
}

enum CommunicationTemplateCategory {
  ACADEMIC
  FINANCE
  DISCIPLINE
  ADMINISTRATION
  PEDAGOGY
  EXAM
  ATTENDANCE
  GENERAL
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  SENT
  PARTIAL
  FAILED
  CANCELLED
}
```

---

# 9. ORION Communication

ORION doit détecter :

```txt
messages critiques non lus
campagnes échouées
taux de livraison faible
familles non joignables
enseignants non réactifs
notifications automatiques désactivées
canal SMS en échec
canal WhatsApp indisponible
email avec taux d’échec élevé
relances financières non envoyées
absences non notifiées
bulletins publiés sans notification
documents manquants non relancés
annonces officielles non lues
```

Exemple :

```txt
ORION Communication — Alerte familles non joignables

12 familles n’ont reçu aucune notification sur les 30 derniers jours.
Impact possible : rupture de communication école-parent.
Action recommandée : vérifier les contacts, activer un canal alternatif ou contacter les familles manuellement.
```

---

# 10. Sara AI dans le module Communication

Sara AI doit aider à :

```txt
rédiger des messages professionnels
reformuler un message
traduire FR/EN
adapter le ton selon le destinataire
générer une annonce officielle
générer une relance parent
générer une notification pédagogique
générer une campagne de réinscription
résumer une conversation
proposer une réponse rapide
détecter un message ambigu ou trop agressif
suggérer un canal adapté
```

Règle de sécurité :

```txt
Sara AI ne doit pas envoyer directement une communication sensible sans validation humaine.
```

---

# 11. Atlas dans le module Communication

Atlas peut servir à :

```txt
analyser les volumes de communication
identifier les classes les plus concernées
détecter les zones de faible joignabilité
cartographier les familles non atteintes
visualiser les tendances de communication
produire des analyses croisées avec finance, présence et scolarité
```

Exemples d’analyses croisées :

```txt
familles avec paiements en retard + messages non lus
élèves absents fréquemment + parents non joignables
classes avec faible taux de lecture des annonces
enseignants avec notifications pédagogiques non traitées
```

---

# 12. Sécurité & conformité

Règles indispensables :

```txt
RBAC strict
tenantId obligatoire
confidentialité des messages
accès limité selon rôle
audit complet
consentement communication si activé
masquage des données sensibles
validation obligatoire pour campagnes massives
journalisation des envois
pas d’envoi silencieux non tracé
protection contre le spam interne
archivage réglementé
```

## Permissions recommandées

```txt
COMMUNICATION_VIEW
COMMUNICATION_MESSAGES_SEND
COMMUNICATION_MESSAGES_MANAGE
COMMUNICATION_ANNOUNCEMENTS_MANAGE
COMMUNICATION_CAMPAIGNS_CREATE
COMMUNICATION_CAMPAIGNS_SEND
COMMUNICATION_TEMPLATES_MANAGE
COMMUNICATION_CHANNELS_MANAGE
COMMUNICATION_HISTORY_VIEW
COMMUNICATION_REPORTS_VIEW
COMMUNICATION_SETTINGS_MANAGE
COMMUNICATION_ORION_VIEW
COMMUNICATION_AUDIT_VIEW
```

---

# 13. Instructions Google Antigravity

## Mission

Implémenter le **Module Communication & Notifications** de Academia Helm.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
architecture multi-tenant
RBAC strict
communication multicanale
messagerie interne
annonces officielles
campagnes
notifications automatiques
modèles FR/EN
traçabilité complète
statistiques
ORION Communication
Sara AI pour assistance rédactionnelle
Atlas pour analytique avancée
audit complet
```

## À créer côté frontend

```txt
CommunicationLayout
CommunicationSidebar
CommunicationDashboardPage
InternalMessagingPage
AnnouncementsPage
AutomatedNotificationsPage
CommunicationCampaignsPage
MessageTemplatesPage
ParentCommunicationPage
TeacherCommunicationPage
StudentCommunicationPage
AdministrativeCommunicationPage
CommunicationChannelsPage
CommunicationHistoryPage
CommunicationReportsPage
CommunicationSettingsPage
```

## À créer côté backend

```txt
CommunicationService
MessageService
AnnouncementService
NotificationService
CampaignService
MessageTemplateService
ParentCommunicationService
TeacherCommunicationService
StudentCommunicationService
AdministrativeCommunicationService
CommunicationChannelService
CommunicationDeliveryService
CommunicationReportService
CommunicationSettingsService
CommunicationOrionService
CommunicationAuditService
```

## À créer côté base de données

```txt
CommunicationMessage
CommunicationRecipient
CommunicationTemplate
CommunicationCampaign
CommunicationSettings
Enums CommunicationMessageType, CommunicationPriority, CommunicationStatus,
CommunicationRecipientType, CommunicationChannelType, CommunicationDeliveryStatus,
CommunicationTemplateCategory, CampaignStatus
```

---

# 14. Résultat attendu

Google Antigravity doit produire un module permettant de :

```txt
envoyer des messages internes
publier des annonces officielles
gérer les notifications automatiques
créer des campagnes multicanales
gérer les modèles de messages FR/EN
communiquer avec les parents
communiquer avec les enseignants
communiquer avec les élèves
gérer les communications administratives
configurer les canaux email/SMS/WhatsApp/push/portail
suivre l’historique complet
produire des rapports
détecter les anomalies avec ORION
assister la rédaction avec Sara AI
analyser les tendances avec Atlas
auditer toutes les communications sensibles
```

---

# Conclusion

Le **Module Communication & Notifications** doit devenir l’un des piliers opérationnels de Academia Helm.

La règle d’or :

```txt
Informer vite, cibler juste, tracer proprement.
```

Avec ce module, Academia Helm ne se contente plus de gérer l’école : il fluidifie les relations entre l’établissement, les familles, les enseignants et les élèves.

La suite logique sera de traiter **onglet par onglet** ce module, en commençant par :

```txt
Onglet 1 — Tableau de bord Communication
```

---

Très bien. On démarre le **Module Communication & Notifications** avec l’onglet central : le **Tableau de bord Communication**.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 1 — TABLEAU DE BORD COMMUNICATION

Cet onglet est le **poste de supervision global** de toutes les communications de l’établissement.

Il ne doit pas être décoratif. Il doit être opérationnel, décisionnel et orienté action.

La logique est simple :

```txt
Voir vite.
Comprendre vite.
Agir vite.
Tracer proprement.
```

---

# 1. Objectif de l’onglet

L’onglet **Tableau de bord Communication** est la page de pilotage global du module Communication & Notifications.

Il permet à la direction, à l’administration et aux responsables autorisés de visualiser en temps réel l’état des communications de l’établissement.

Il doit répondre rapidement à des questions opérationnelles :

```txt
Combien de messages ont été envoyés aujourd’hui ?
Combien de notifications ont échoué ?
Quelles annonces officielles sont encore non lues ?
Quels parents ne reçoivent pas les messages ?
Quels canaux sont performants ?
Quelles campagnes sont en cours ?
Quels modules génèrent le plus de notifications ?
Quelles alertes ORION nécessitent une action immédiate ?
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/dashboard
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Messagerie interne
Annonces officielles
Notifications automatiques
Campagnes
Modèles de messages
Canaux & Connecteurs
Historique & Traçabilité
Rapports Communication
ORION Communication
Sara AI
Atlas
Audit
```

---

# 3. Principe général

Cet onglet n’est pas une page décorative avec quelques chiffres.
C’est un **centre de supervision des communications scolaires**.

Il doit permettre de voir :

```txt
ce qui a été envoyé
ce qui a été reçu
ce qui a été lu
ce qui a échoué
ce qui nécessite une relance
ce qui représente un risque de communication
```

## Règle métier

```txt
Toute donnée affichée dans le tableau de bord doit être filtrée par tenant,
par année scolaire active si nécessaire,
par rôle utilisateur
et par permissions.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Bandeau de synthèse
2. Cartes KPI
3. Activité récente
4. État des canaux
5. Annonces officielles actives
6. Notifications automatiques récentes
7. Campagnes en cours
8. Communications critiques
9. Familles/personnes non joignables
10. Répartition par canal
11. Répartition par module source
12. Tendances temporelles
13. Alertes ORION
14. Suggestions Sara AI
15. Analyse Atlas
16. Actions rapides
17. Audit des accès
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/dashboard
```

## 5.2 Page principale

```txt
app/(school)/communication/dashboard/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/dashboard/CommunicationDashboardPage.tsx
components/communication/dashboard/CommunicationDashboardHeader.tsx
components/communication/dashboard/CommunicationKpiCards.tsx
components/communication/dashboard/CommunicationActivityFeed.tsx
components/communication/dashboard/CommunicationChannelStatusPanel.tsx
components/communication/dashboard/ActiveAnnouncementsPanel.tsx
components/communication/dashboard/RecentAutomatedNotificationsPanel.tsx
components/communication/dashboard/RunningCampaignsPanel.tsx
components/communication/dashboard/CriticalCommunicationPanel.tsx
components/communication/dashboard/UnreachableContactsPanel.tsx
components/communication/dashboard/CommunicationChannelDistributionChart.tsx
components/communication/dashboard/CommunicationSourceModuleChart.tsx
components/communication/dashboard/CommunicationTrendChart.tsx
components/communication/dashboard/CommunicationOrionAlertsPanel.tsx
components/communication/dashboard/CommunicationSaraSuggestionsPanel.tsx
components/communication/dashboard/CommunicationAtlasInsightsPanel.tsx
components/communication/dashboard/CommunicationQuickActions.tsx
components/communication/dashboard/CommunicationDashboardAuditTimeline.tsx
```

---

# 6. Bandeau de synthèse

Le bandeau supérieur doit afficher :

```txt
nom de l’établissement
année scolaire active
période filtrée
état global communication
nombre d’alertes critiques
dernier rafraîchissement
bouton actualiser
bouton créer une communication
bouton lancer une campagne
bouton consulter ORION
```

## États globaux possibles

```txt
stable
attention
critique
canaux dégradés
forte activité
faible lecture
```

---

# 7. Cartes KPI

Cartes recommandées :

```txt
messages envoyés aujourd’hui
messages envoyés cette semaine
notifications automatiques
annonces actives
campagnes en cours
taux de livraison
taux de lecture
messages échoués
communications urgentes
familles non joignables
enseignants non réactifs
alertes ORION critiques
```

Chaque carte doit afficher :

```txt
valeur principale
évolution
comparaison période précédente
indicateur visuel
accès rapide au détail
```

---

# 8. Activité récente

Afficher les dernières actions :

```txt
message envoyé
annonce publiée
notification générée
campagne créée
campagne envoyée
message lu
message échoué
canal testé
modèle modifié
alerte ORION générée
```

Chaque ligne doit contenir :

```txt
type d’activité
utilisateur/source
destinataire ou audience
canal
statut
date/heure
lien vers détail
```

---

# 9. État des canaux

Canaux à afficher :

```txt
portail
email
SMS
WhatsApp
push
webhook/API
```

Pour chaque canal :

```txt
statut actif/inactif
état opérationnel
taux de succès
taux d’échec
quota restant
dernier test
dernière erreur
coût estimé si applicable
```

## Statuts possibles

```txt
opérationnel
dégradé
indisponible
non configuré
quota faible
en erreur
```

---

# 10. Annonces officielles actives

Afficher :

```txt
titre
audience
priorité
date publication
date expiration
taux de lecture
confirmations manquantes
statut
```

## Actions rapides

```txt
voir détail
relancer non-lecteurs
prolonger annonce
archiver
exporter preuve de lecture
```

---

# 11. Notifications automatiques récentes

Afficher les notifications générées par les modules :

```txt
absence
retard
paiement
note
bulletin
document
devoir
discipline
inscription
mouvement scolaire
```

Champs :

```txt
type
module source
destinataire
canal
statut
date
erreur éventuelle
```

---

# 12. Campagnes en cours

Afficher :

```txt
nom campagne
canal
audience
statut
progression
destinataires
livrés
lus
échoués
date planifiée
responsable
```

## Statuts

```txt
brouillon
planifiée
en cours
envoyée
partielle
échouée
annulée
```

---

# 13. Communications critiques

Le système doit isoler :

```txt
messages urgents non lus
annonces prioritaires non confirmées
notifications de discipline non livrées
absences non notifiées
relances financières non envoyées
bulletins publiés sans notification
documents critiques non relancés
```

Ces éléments doivent être affichés dans un panneau dédié avec priorité visuelle.

---

# 14. Familles/personnes non joignables

Afficher :

```txt
parents sans téléphone
parents sans email
parents dont les messages échouent
familles sans canal actif
élèves sans responsable joignable
enseignants sans canal actif
utilisateurs portail jamais connectés
```

## Actions rapides

```txt
ouvrir fiche famille
mettre à jour contact
envoyer via canal alternatif
créer tâche administrative
exporter la liste
```

---

# 15. Répartition par canal

Graphiques :

```txt
messages par canal
taux de succès par canal
taux d’échec par canal
taux de lecture par canal
coût estimé par canal
évolution par canal
```

Canaux :

```txt
portail
email
SMS
WhatsApp
push
webhook
```

---

# 16. Répartition par module source

Afficher les communications générées par :

```txt
Élèves & Scolarité
Finance
Examens
Notes & Bulletins
Présence & Discipline
Pédagogie
Bibliothèque
RH
Administration
Paramètres
```

Objectif : comprendre quels modules sollicitent le plus la communication.

---

# 17. Tendances temporelles

Graphiques recommandés :

```txt
messages par jour
notifications par semaine
taux de lecture mensuel
taux d’échec par période
évolution des campagnes
évolution des familles non joignables
pics d’activité
```

## Filtres

```txt
aujourd’hui
7 jours
30 jours
trimestre
année scolaire
période personnalisée
```

---

# 18. Alertes ORION

ORION doit afficher :

```txt
canal en panne
taux d’échec élevé
annonces non lues
familles non joignables
campagne critique échouée
notification automatique désactivée
relances non envoyées
messages urgents non lus
absence non notifiée
bulletin publié sans notification
document manquant non relancé
```

Chaque alerte doit contenir :

```txt
niveau
description
impact
recommandation
action rapide
statut de traitement
```

Exemple :

```txt
ORION Communication — Taux d’échec SMS élevé

Le canal SMS présente un taux d’échec supérieur au seuil défini.
Impact possible : certaines familles ne reçoivent pas les informations urgentes.
Action recommandée : tester le fournisseur SMS ou basculer temporairement vers WhatsApp/Portail.
```

---

# 19. Suggestions Sara AI

Sara AI peut proposer :

```txt
reformuler une annonce peu claire
générer une relance pour non-lecteurs
créer un message de suivi
suggérer un canal alternatif
proposer une campagne de rappel
traduire une communication FR/EN
résumer une tendance de communication
```

Règle :

```txt
Sara AI propose.
L’utilisateur valide avant toute diffusion.
```

---

# 20. Analyse Atlas

Atlas peut afficher :

```txt
carte des zones/familles non joignables si données disponibles
distribution des communications par classe
corrélation entre paiements en retard et messages non lus
corrélation entre absences répétées et parents non joignables
classes avec faible taux de lecture
modules avec surcharge de notifications
évolution stratégique de la communication
```

---

# 21. Actions rapides

Actions disponibles :

```txt
créer un message
publier une annonce
lancer une campagne
créer un modèle
tester un canal
relancer les non-lecteurs
exporter familles non joignables
consulter historique
ouvrir ORION
ouvrir rapports
```

---

# 22. Filtres globaux

Filtres :

```txt
année scolaire
période
canal
audience
module source
priorité
statut
niveau
classe
utilisateur
type de communication
```

---

# 23. Base de données — CommunicationDashboardSnapshot

```prisma
model CommunicationDashboardSnapshot {
  id              String @id @default(cuid())
  tenantId        String

  academicYearId  String?
  periodStart     DateTime?
  periodEnd       DateTime?

  metrics         Json
  channelStats    Json?
  sourceStats     Json?
  trendStats      Json?
  orionSummary    Json?
  atlasSummary    Json?

  generatedAt     DateTime @default(now())
  generatedById   String?

  @@index([tenantId])
  @@index([academicYearId])
  @@index([generatedAt])
}
```

---

# 24. Backend — Routes API

```http
GET /api/communication/dashboard
GET /api/communication/dashboard/kpis
GET /api/communication/dashboard/activity
GET /api/communication/dashboard/channels
GET /api/communication/dashboard/announcements
GET /api/communication/dashboard/notifications
GET /api/communication/dashboard/campaigns
GET /api/communication/dashboard/critical
GET /api/communication/dashboard/unreachable
GET /api/communication/dashboard/channel-distribution
GET /api/communication/dashboard/source-distribution
GET /api/communication/dashboard/trends
GET /api/communication/dashboard/orion-alerts
GET /api/communication/dashboard/sara-suggestions
GET /api/communication/dashboard/atlas-insights
POST /api/communication/dashboard/snapshot
```

---

# 25. Backend — Services

Services recommandés :

```txt
CommunicationDashboardService
CommunicationKpiService
CommunicationActivityService
CommunicationChannelHealthService
CommunicationAnnouncementDashboardService
CommunicationNotificationDashboardService
CommunicationCampaignDashboardService
CommunicationCriticalService
CommunicationUnreachableContactService
CommunicationTrendService
CommunicationDashboardOrionService
CommunicationDashboardSaraService
CommunicationDashboardAtlasService
CommunicationDashboardAuditService
```

---

# 26. Sécurité

## Permissions

```txt
COMMUNICATION_DASHBOARD_VIEW
COMMUNICATION_DASHBOARD_EXPORT
COMMUNICATION_DASHBOARD_ORION_VIEW
COMMUNICATION_DASHBOARD_ATLAS_VIEW
COMMUNICATION_DASHBOARD_SARA_VIEW
COMMUNICATION_QUICK_ACTIONS_USE
COMMUNICATION_CRITICAL_VIEW
COMMUNICATION_UNREACHABLE_VIEW
COMMUNICATION_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
filtrage selon rôle
masquage des données sensibles
pas d’accès aux contenus privés sans permission
audit des consultations sensibles
restriction des actions rapides
statistiques calculées uniquement sur les données autorisées
```

---

# 27. Audit

Auditer :

```txt
consultation tableau de bord
consultation communications critiques
consultation familles non joignables
export statistiques
accès ORION
accès Atlas
accès suggestions Sara
utilisation action rapide
génération snapshot
accès refusé
```

---

# 28. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 1 — Tableau de bord Communication** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
dashboard temps réel ou quasi temps réel
KPI fiables
filtrage global
ORION Communication
Sara AI en suggestion uniquement
Atlas pour insights analytiques
audit complet
actions rapides sécurisées
aucun accès non autorisé aux contenus sensibles
```

## À créer côté frontend

```txt
Page /communication/dashboard
CommunicationDashboardPage
CommunicationDashboardHeader
CommunicationKpiCards
CommunicationActivityFeed
CommunicationChannelStatusPanel
ActiveAnnouncementsPanel
RecentAutomatedNotificationsPanel
RunningCampaignsPanel
CriticalCommunicationPanel
UnreachableContactsPanel
CommunicationChannelDistributionChart
CommunicationSourceModuleChart
CommunicationTrendChart
CommunicationOrionAlertsPanel
CommunicationSaraSuggestionsPanel
CommunicationAtlasInsightsPanel
CommunicationQuickActions
CommunicationDashboardAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Agrégations KPI
Santé des canaux
Activité récente
Annonces actives
Notifications récentes
Campagnes en cours
Communications critiques
Familles non joignables
Répartitions par canal
Répartitions par module source
Tendances temporelles
ORION Communication
Sara AI Suggestions
Atlas Insights
Audit complet
```

## À créer côté BDD

```txt
CommunicationDashboardSnapshot
Relations avec CommunicationMessage, CommunicationRecipient, CommunicationCampaign,
CommunicationTemplate, CommunicationSettings, User, AcademicYear, AuditLog
```

---

# 29. Résultat attendu

Google Antigravity doit produire un tableau de bord permettant de :

```txt
visualiser les messages envoyés
suivre les notifications automatiques
contrôler les annonces officielles
suivre les campagnes
surveiller les canaux
identifier les communications critiques
détecter les familles non joignables
analyser la répartition par canal
analyser la répartition par module source
suivre les tendances temporelles
consulter les alertes ORION
recevoir les suggestions Sara AI
visualiser les insights Atlas
exécuter des actions rapides sécurisées
auditer les consultations sensibles
```

---

# Conclusion

L’onglet **Tableau de bord Communication** doit devenir le radar principal de la communication scolaire.

La règle d’or :

```txt
Si une information importante n’est pas reçue, ce n’est pas seulement un problème technique.
C’est un risque opérationnel.
```

Avec cet onglet, Academia Helm donne à l’école une capacité de supervision claire : voir les flux, repérer les blocages, agir vite et garder une trace fiable.

La suite logique :

```txt
Onglet 2 — Messagerie interne
```

---

Très bien. On passe à l’**Onglet 2 — Messagerie interne**. Ici, il faut éviter l’erreur classique : faire un “petit chat”. Non. Academia Helm doit proposer une **messagerie professionnelle scolaire**, traçable, sécurisée et reliée aux modules métiers.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 2 — MESSAGERIE INTERNE

---

# 1. Objectif de l’onglet

L’onglet **Messagerie interne** permet aux utilisateurs autorisés de communiquer directement à l’intérieur de la plateforme Academia Helm.

Il doit couvrir les échanges entre :

```txt
direction
administration
enseignants
personnel
vie scolaire
comptabilité
responsables pédagogiques
utilisateurs internes autorisés
```

Ce n’est pas un simple chat.
C’est une messagerie professionnelle scolaire, sécurisée, contextualisée, historisée et reliée aux modules métiers.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/messages
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Utilisateurs & rôles
Enseignants & RH
Élèves & Scolarité
Présence & Discipline
Examens & Notes
Finance
Pédagogie
Documents
Audit
ORION
Sara AI
```

---

# 3. Principe général

La messagerie interne doit permettre de gérer des échanges professionnels sans sortir de la plateforme.

Elle doit éviter que les communications importantes soient dispersées entre WhatsApp personnel, appels, papiers, emails non suivis et conversations informelles.

## Règle métier

```txt
Toute conversation interne liée à une décision scolaire, administrative,
pédagogique ou financière doit pouvoir être historisée et retrouvée.
```

Autrement dit : si une décision importante se perd dans un “vu” WhatsApp, c’est déjà trop tard. Academia Helm doit remettre de l’ordre.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Boîte de réception
2. Conversations
3. Nouveau message
4. Messages individuels
5. Messages de groupe
6. Filtres et recherche
7. Pièces jointes
8. Accusés de lecture
9. Messages liés à un module
10. Messages prioritaires
11. Archivage
12. Signalement/modération
13. Suggestions Sara AI
14. Alertes ORION
15. Paramètres personnels de messagerie
16. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/messages
```

## 5.2 Page principale

```txt
app/(school)/communication/messages/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/messages/InternalMessagingPage.tsx
components/communication/messages/MessagingInboxSidebar.tsx
components/communication/messages/ConversationList.tsx
components/communication/messages/ConversationThread.tsx
components/communication/messages/MessageComposer.tsx
components/communication/messages/NewMessageDialog.tsx
components/communication/messages/RecipientSelector.tsx
components/communication/messages/MessagePrioritySelector.tsx
components/communication/messages/MessageAttachmentUploader.tsx
components/communication/messages/MessageReadReceiptPanel.tsx
components/communication/messages/LinkedEntitySelector.tsx
components/communication/messages/MessageSearchBar.tsx
components/communication/messages/MessageFilters.tsx
components/communication/messages/MessageArchivePanel.tsx
components/communication/messages/MessageModerationPanel.tsx
components/communication/messages/MessageSaraAssistantPanel.tsx
components/communication/messages/MessageOrionAlertsPanel.tsx
components/communication/messages/MessagingSettingsPanel.tsx
components/communication/messages/MessagingAuditTimeline.tsx
```

---

# 6. Boîte de réception

La boîte de réception doit afficher :

```txt
conversations récentes
messages non lus
messages prioritaires
messages urgents
conversations archivées
messages envoyés
brouillons
messages liés à un module
messages avec pièces jointes
```

Chaque conversation doit afficher :

```txt
expéditeur
destinataires
dernier message
date
statut lu/non lu
priorité
module lié si applicable
nombre de messages
indicateur pièce jointe
```

---

# 7. Conversations

Une conversation doit pouvoir être :

```txt
individuelle
de groupe
liée à une classe
liée à un élève
liée à un enseignant
liée à une facture
liée à une absence
liée à un bulletin
liée à un document
liée à une demande administrative
```

Chaque conversation doit conserver :

```txt
participants
messages
pièces jointes
statuts de lecture
événements système
historique d’archivage
modération si applicable
```

---

# 8. Nouveau message

Le formulaire de nouveau message doit contenir :

```txt
destinataires
objet
contenu
priorité
canal interne
pièce jointe
lien métier optionnel
demande d’accusé de lecture
option brouillon
bouton envoyer
bouton programmer si autorisé
```

Le système doit empêcher l’envoi si :

```txt
aucun destinataire
contenu vide
destinataire non autorisé
pièce jointe invalide
utilisateur sans permission
message hors périmètre tenant
```

---

# 9. Destinataires

Types de destinataires :

```txt
utilisateur
rôle
département
équipe pédagogique
classe
niveau
personnel administratif
enseignants d’une classe
enseignants d’une matière
responsables pédagogiques
direction
comptabilité
vie scolaire
```

Le sélecteur doit respecter :

```txt
les permissions
le tenant
le périmètre utilisateur
les restrictions de rôle
les règles de confidentialité
```

---

# 10. Messages individuels

Cas d’usage :

```txt
direction vers enseignant
enseignant vers administration
comptabilité vers direction
vie scolaire vers responsable pédagogique
secrétariat vers enseignant
RH vers personnel
```

Fonctionnalités :

```txt
réponse
transfert si autorisé
archive
marquer comme lu/non lu
pièce jointe
accusé de lecture
lien vers module
```

---

# 11. Messages de groupe

Cas d’usage :

```txt
direction vers tous les enseignants
administration vers personnel
responsable pédagogique vers équipe de classe
comptabilité vers secrétariat
vie scolaire vers enseignants d’un niveau
```

Fonctionnalités :

```txt
groupe dynamique
groupe manuel
accusé de lecture par membre
liste des non-lecteurs
relance des non-lecteurs
restriction de réponse
mode annonce interne
```

---

# 12. Pièces jointes

Types autorisés :

```txt
PDF
DOCX
XLSX
images
documents pédagogiques
documents administratifs
```

Contrôles :

```txt
taille maximale
type MIME
antivirus si disponible
permission d’accès
lien sécurisé
expiration optionnelle
audit téléchargement
```

---

# 13. Accusés de lecture

Le système doit gérer :

```txt
message envoyé
message reçu
message lu
message non lu
accusé obligatoire
liste des lecteurs
liste des non-lecteurs
date/heure de lecture
relance
```

Pour les messages prioritaires, l’accusé de lecture peut être obligatoire.

---

# 14. Messages liés à un module

Un message peut être lié à :

```txt
élève
classe
enseignant
absence
retard
sanction
note
bulletin
facture
paiement
document
devoir
séance
événement
demande administrative
```

Exemple :

```txt
Un message concernant une absence doit pouvoir ouvrir directement la fiche d’absence concernée.
```

---

# 15. Priorités

Niveaux :

```txt
faible
normal
important
urgent
critique
```

Effets possibles :

```txt
badge visuel
notification renforcée
accusé obligatoire
relance automatique
alerte ORION si non lu
restriction de suppression
```

---

# 16. Recherche et filtres

## Filtres

```txt
non lus
envoyés
reçus
archivés
prioritaires
avec pièces jointes
par expéditeur
par destinataire
par rôle
par module lié
par période
par mot-clé
par statut de lecture
```

## Recherche

```txt
objet
contenu
nom expéditeur
nom destinataire
module source
référence métier
```

---

# 17. Archivage

Règles :

```txt
archivage personnel
archivage administratif
archivage automatique après délai
conservation selon politique
restauration si autorisée
suppression logique uniquement
pas de suppression définitive sans politique explicite
```

---

# 18. Signalement et modération

Fonctionnalités optionnelles :

```txt
signaler un message
masquer temporairement
examen par administrateur
verrouiller une conversation
limiter les réponses
consigner une décision
audit modération
```

Ce volet est utile pour les grands établissements.

---

# 19. Suggestions Sara AI

Sara AI peut aider à :

```txt
rédiger un message professionnel
reformuler un message
rendre le ton plus administratif
rendre le ton plus pédagogique
résumer une conversation
générer une réponse rapide
traduire FR/EN
détecter un ton inadapté
proposer un objet clair
raccourcir un message trop long
```

## Règle

```txt
Sara AI ne doit pas envoyer sans validation humaine.
```

---

# 20. Alertes ORION

ORION doit détecter :

```txt
message urgent non lu
conversation critique sans réponse
message signalé
pièce jointe non consultée
taux de non-lecture élevé
destinataire important non joignable
message administratif sans accusé
retard de réponse
communication liée à absence non traitée
communication financière non suivie
```

Exemple :

```txt
ORION Messagerie — Message urgent non lu

Un message prioritaire envoyé à l’équipe pédagogique n’a pas été lu par 5 destinataires après le délai défini.
Impact possible : retard dans le traitement d’une décision scolaire.
Action recommandée : relancer les non-lecteurs ou utiliser un canal alternatif.
```

---

# 21. Paramètres personnels

Chaque utilisateur peut configurer :

```txt
notifications internes
affichage conversations
signature
langue préférée
statut disponibilité
réponses rapides
préférences de lecture
mode compact
alertes prioritaires
```

---

# 22. Base de données — Conversation

```prisma
model InternalConversation {
  id              String @id @default(cuid())
  tenantId        String

  title           String?
  type            InternalConversationType @default(DIRECT)
  priority        CommunicationPriority @default(NORMAL)

  linkedEntityType String?
  linkedEntityId   String?

  isArchived      Boolean @default(false)
  isLocked        Boolean @default(false)

  createdById     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  messages        InternalMessage[]
  participants    InternalConversationParticipant[]

  @@index([tenantId])
  @@index([type])
  @@index([priority])
  @@index([linkedEntityType, linkedEntityId])
}
```

---

# 23. Base de données — Participants

```prisma
model InternalConversationParticipant {
  id              String @id @default(cuid())
  tenantId        String

  conversationId  String
  userId          String

  role            ConversationParticipantRole @default(MEMBER)
  isMuted         Boolean @default(false)
  isArchived      Boolean @default(false)

  lastReadAt      DateTime?
  joinedAt        DateTime @default(now())
  leftAt          DateTime?

  conversation    InternalConversation @relation(fields: [conversationId], references: [id])
  
  @@unique([conversationId, userId])
  @@index([tenantId])
  @@index([userId])
}
```

---

# 24. Base de données — Messages

```prisma
model InternalMessage {
  id              String @id @default(cuid())
  tenantId        String

  conversationId  String
  senderId        String?

  subject         String?
  body            String
  priority        CommunicationPriority @default(NORMAL)

  requiresAck     Boolean @default(false)
  isSystemMessage Boolean @default(false)
  isEdited        Boolean @default(false)
  editedAt        DateTime?

  deletedAt       DateTime?
  createdAt       DateTime @default(now())

  conversation    InternalConversation @relation(fields: [conversationId], references: [id])
  attachments     InternalMessageAttachment[]
  readReceipts    InternalMessageReadReceipt[]

  @@index([tenantId])
  @@index([conversationId])
  @@index([senderId])
  @@index([priority])
  @@index([createdAt])
}
```

---

# 25. Base de données — Pièces jointes

```prisma
model InternalMessageAttachment {
  id              String @id @default(cuid())
  tenantId        String

  messageId       String

  fileName        String
  fileUrl         String
  fileType        String?
  fileSize        Int?

  uploadedById    String?
  createdAt       DateTime @default(now())

  message         InternalMessage @relation(fields: [messageId], references: [id])

  @@index([tenantId])
  @@index([messageId])
}
```

---

# 26. Base de données — Accusés de lecture

```prisma
model InternalMessageReadReceipt {
  id              String @id @default(cuid())
  tenantId        String

  messageId       String
  userId          String

  readAt          DateTime?
  acknowledgedAt  DateTime?

  message         InternalMessage @relation(fields: [messageId], references: [id])

  @@unique([messageId, userId])
  @@index([tenantId])
  @@index([userId])
  @@index([readAt])
}
```

---

# 27. Enums

```prisma
enum InternalConversationType {
  DIRECT
  GROUP
  ROLE_BASED
  CLASS_BASED
  MODULE_LINKED
  ANNOUNCEMENT_THREAD
}

enum ConversationParticipantRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

---

# 28. Backend — Routes API

```http
GET    /api/communication/messages
POST   /api/communication/messages

GET    /api/communication/messages/conversations
POST   /api/communication/messages/conversations
GET    /api/communication/messages/conversations/:conversationId
PATCH  /api/communication/messages/conversations/:conversationId
POST   /api/communication/messages/conversations/:conversationId/archive
POST   /api/communication/messages/conversations/:conversationId/lock

GET    /api/communication/messages/conversations/:conversationId/messages
POST   /api/communication/messages/conversations/:conversationId/messages
PATCH  /api/communication/messages/:messageId
POST   /api/communication/messages/:messageId/read
POST   /api/communication/messages/:messageId/acknowledge
POST   /api/communication/messages/:messageId/archive
POST   /api/communication/messages/:messageId/report

POST   /api/communication/messages/:messageId/attachments
GET    /api/communication/messages/:messageId/read-receipts

GET    /api/communication/messages/search
GET    /api/communication/messages/orion-alerts
GET    /api/communication/messages/sara-suggestions
GET    /api/communication/messages/settings
PATCH  /api/communication/messages/settings
```

---

# 29. Backend — Services

Services recommandés :

```txt
InternalMessagingService
ConversationService
ConversationParticipantService
InternalMessageService
MessageAttachmentService
MessageReadReceiptService
MessageRecipientResolverService
MessageSearchService
MessageArchiveService
MessageModerationService
MessageLinkedEntityService
MessageSaraService
MessageOrionService
MessagingSettingsService
MessagingAuditService
```

---

# 30. Sécurité

## Permissions

```txt
COMMUNICATION_MESSAGES_VIEW
COMMUNICATION_MESSAGES_SEND
COMMUNICATION_MESSAGES_REPLY
COMMUNICATION_MESSAGES_GROUP_SEND
COMMUNICATION_MESSAGES_ARCHIVE
COMMUNICATION_MESSAGES_MODERATE
COMMUNICATION_MESSAGES_ATTACH_FILE
COMMUNICATION_MESSAGES_READ_RECEIPTS_VIEW
COMMUNICATION_MESSAGES_LINK_ENTITY
COMMUNICATION_MESSAGES_SARA_USE
COMMUNICATION_MESSAGES_ORION_VIEW
COMMUNICATION_MESSAGES_SETTINGS_MANAGE
COMMUNICATION_MESSAGES_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
accès conversation réservé aux participants
RBAC strict
vérification destinataires
pièces jointes sécurisées
pas de suppression physique par défaut
audit des messages sensibles
modération limitée aux rôles autorisés
filtrage des conversations selon utilisateur
```

---

# 31. Audit

Auditer :

```txt
création conversation
envoi message
lecture message prioritaire
accusé de lecture
ajout pièce jointe
téléchargement pièce jointe sensible
archivage
signalement
modération
verrouillage conversation
accès refusé
utilisation Sara AI
alerte ORION générée
```

---

# 32. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 2 — Messagerie interne** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
conversations sécurisées
participants contrôlés
accusés de lecture
pièces jointes sécurisées
lien avec modules métiers
Sara AI en assistance uniquement
ORION pour alertes de non-lecture et retard
audit complet
suppression logique uniquement
```

## À créer côté frontend

```txt
Page /communication/messages
InternalMessagingPage
MessagingInboxSidebar
ConversationList
ConversationThread
MessageComposer
NewMessageDialog
RecipientSelector
MessagePrioritySelector
MessageAttachmentUploader
MessageReadReceiptPanel
LinkedEntitySelector
MessageSearchBar
MessageFilters
MessageArchivePanel
MessageModerationPanel
MessageSaraAssistantPanel
MessageOrionAlertsPanel
MessagingSettingsPanel
MessagingAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion conversations
Gestion participants
Gestion messages
Gestion pièces jointes
Gestion accusés de lecture
Recherche
Archivage
Signalement/modération
Liaison aux modules métiers
ORION Messagerie
Sara AI Assistance
Audit complet
```

## À créer côté BDD

```txt
InternalConversation
InternalConversationParticipant
InternalMessage
InternalMessageAttachment
InternalMessageReadReceipt
Enums InternalConversationType, ConversationParticipantRole
Relations avec User, Tenant, AuditLog, modules métiers
```

---

# 33. Résultat attendu

Google Antigravity doit produire une messagerie interne permettant de :

```txt
créer des conversations individuelles
créer des conversations de groupe
envoyer des messages internes
joindre des fichiers
suivre les lectures
demander des accusés
relier un message à un module métier
rechercher dans les messages
archiver les conversations
signaler/modérer si autorisé
utiliser Sara AI pour rédiger ou reformuler
détecter les retards avec ORION
auditer les actions sensibles
```

---

# Conclusion

L’onglet **Messagerie interne** doit devenir l’espace officiel des échanges professionnels internes.

La règle d’or :

```txt
Les échanges informels peuvent exister.
Les décisions importantes doivent être tracées.
```

Avec cet onglet, Academia Helm évite la dispersion des communications et donne à l’établissement une mémoire opérationnelle fiable.

La suite logique :

```txt
Onglet 3 — Annonces officielles
```

---

Très bien. On poursuit avec l’**Onglet 3 — Annonces officielles**. Ici, l’enjeu est clair : une annonce officielle n’est pas un simple message. C’est une communication institutionnelle, ciblée, datée, visible, suivie et opposable en cas de besoin.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 3 — ANNONCES OFFICIELLES

---

# 1. Objectif de l’onglet

L’onglet **Annonces officielles** permet à l’établissement de publier des communications institutionnelles structurées, visibles, traçables et ciblées.

Il sert à diffuser des informations officielles vers :

```txt
les parents
les élèves
les enseignants
le personnel administratif
la direction
des classes
des niveaux
des groupes spécifiques
des portails ciblés
```

Cet onglet ne doit pas être confondu avec la messagerie interne.

Une annonce officielle est une communication institutionnelle publiée par l’école, avec :

```txt
une audience
une période de visibilité
une priorité
une traçabilité
un suivi de lecture
une éventuelle confirmation
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/announcements
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Utilisateurs & rôles
Élèves & Scolarité
Enseignants & RH
Classes & niveaux
Portail Parent/Élève
Portail Enseignant
Portail École
Notifications automatiques
Modèles de messages
Historique & Traçabilité
ORION Communication
Sara AI
Audit
```

---

# 3. Principe général

Une annonce officielle doit permettre à l’école de publier une information claire, datée, ciblée et vérifiable.

Elle peut être affichée :

```txt
dans le portail école
dans le portail enseignant
dans le portail parent/élève
dans le tableau de bord
dans les notifications internes
via email, SMS, WhatsApp ou push si l’école l’active
```

## Règle métier

```txt
Une annonce officielle importante doit pouvoir être suivie par taux de lecture,
confirmation de lecture et relance des non-lecteurs.
```

Une annonce non lue, c’est parfois juste un oubli. Une annonce critique non lue, c’est un risque opérationnel. Et les risques opérationnels aiment apparaître le lundi matin, avec un café renversé à côté.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Liste des annonces
2. Création d’annonce
3. Détail d’annonce
4. Ciblage d’audience
5. Priorité & visibilité
6. Publication & planification
7. Pièces jointes
8. Confirmation de lecture
9. Relance des non-lecteurs
10. Traduction FR/EN
11. Suggestions Sara AI
12. Alertes ORION
13. Archivage
14. Statistiques
15. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/announcements
```

## 5.2 Page principale

```txt
app/(school)/communication/announcements/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/announcements/AnnouncementsPage.tsx
components/communication/announcements/AnnouncementHeader.tsx
components/communication/announcements/AnnouncementList.tsx
components/communication/announcements/AnnouncementCard.tsx
components/communication/announcements/AnnouncementFilters.tsx
components/communication/announcements/AnnouncementSearchBar.tsx
components/communication/announcements/AnnouncementCreateDialog.tsx
components/communication/announcements/AnnouncementEditor.tsx
components/communication/announcements/AnnouncementAudienceSelector.tsx
components/communication/announcements/AnnouncementPrioritySelector.tsx
components/communication/announcements/AnnouncementVisibilitySettings.tsx
components/communication/announcements/AnnouncementSchedulePanel.tsx
components/communication/announcements/AnnouncementAttachmentUploader.tsx
components/communication/announcements/AnnouncementReadReceiptPanel.tsx
components/communication/announcements/AnnouncementNonReadersPanel.tsx
components/communication/announcements/AnnouncementStatsPanel.tsx
components/communication/announcements/AnnouncementSaraAssistantPanel.tsx
components/communication/announcements/AnnouncementOrionAlertsPanel.tsx
components/communication/announcements/AnnouncementArchivePanel.tsx
components/communication/announcements/AnnouncementAuditTimeline.tsx
```

---

# 6. Liste des annonces

La liste doit afficher :

```txt
titre
résumé
audience
priorité
statut
date de publication
date d’expiration
auteur
taux de lecture
confirmation requise ou non
nombre de non-lecteurs
canaux de diffusion
état ORION si anomalie
```

## Statuts possibles

```txt
brouillon
planifiée
publiée
expirée
archivée
annulée
```

## Filtres

```txt
statut
priorité
audience
portail
niveau
classe
auteur
période
confirmation requise
non lues
archivées
```

---

# 7. Création d’annonce

Le formulaire doit contenir :

```txt
titre
résumé court
contenu complet
catégorie
priorité
audience
portails concernés
date de publication
date d’expiration
pièces jointes
image d’illustration optionnelle
confirmation de lecture
canaux complémentaires
langue
version française
version anglaise
brouillon
prévisualisation
validation avant publication si activée
```

## Catégories recommandées

```txt
général
administratif
pédagogique
financier
discipline
examens
événement
urgence
bibliothèque
RH
vie scolaire
```

---

# 8. Ciblage d’audience

Le ciblage doit permettre de sélectionner :

```txt
tous les utilisateurs
tous les parents
tous les élèves
tous les enseignants
tout le personnel
une ou plusieurs classes
un ou plusieurs niveaux
un cycle
une série
un groupe pédagogique
un rôle
une équipe
des utilisateurs spécifiques
```

Le ciblage doit être dynamique.

Exemple :

```txt
Si l’annonce cible la classe CM2,
les nouveaux parents rattachés à CM2 doivent être inclus selon les règles de visibilité définies.
```

---

# 9. Priorité & visibilité

## Priorités

```txt
faible
normale
importante
urgente
critique
```

## Effets possibles

```txt
badge visuel
mise en avant dans le portail
notification automatique
confirmation obligatoire
relance automatique
alerte ORION si non lue
blocage de masquage avant lecture
```

## Visibilité

```txt
portail école
portail enseignant
portail parent/élève
tableau de bord
notification interne
email
SMS
WhatsApp
push
```

---

# 10. Publication & planification

Fonctionnalités :

```txt
publier immédiatement
programmer une publication
définir une date d’expiration
sauvegarder en brouillon
annuler une publication planifiée
dépublier si autorisé
republier une annonce expirée
dupliquer une annonce
```

## Règles

```txt
une annonce critique doit avoir une audience définie
une annonce avec expiration passée ne peut pas être publiée
une annonce officielle publiée ne doit pas être modifiée sans historisation
toute modification après publication doit être tracée
```

---

# 11. Pièces jointes

Types autorisés :

```txt
PDF
DOCX
XLSX
images
documents administratifs
documents pédagogiques
```

Contrôles :

```txt
taille maximale
type MIME
lien sécurisé
visibilité selon audience
expiration optionnelle
audit téléchargement
scan antivirus si disponible
```

---

# 12. Confirmation de lecture

Le système doit permettre :

```txt
confirmation simple
confirmation obligatoire
suivi des lecteurs
suivi des non-lecteurs
date/heure de lecture
date/heure de confirmation
relance manuelle
relance automatique
export preuve de lecture
```

Pour les annonces critiques, la confirmation peut être obligatoire.

---

# 13. Relance des non-lecteurs

Actions possibles :

```txt
relancer par notification portail
relancer par email
relancer par SMS
relancer par WhatsApp
créer une campagne de relance
exporter la liste
notifier un responsable administratif
```

## Règles

```txt
les relances doivent être historisées
le canal de relance doit respecter les préférences et règles de communication
ORION doit signaler les annonces importantes avec trop de non-lecteurs
```

---

# 14. Traduction FR/EN

Le système doit gérer :

```txt
contenu français
contenu anglais
titre français
titre anglais
résumé français
résumé anglais
prévisualisation par langue
affichage selon préférence utilisateur
fallback vers langue par défaut
```

Sara AI peut proposer une traduction, mais l’utilisateur doit valider avant publication.

---

# 15. Suggestions Sara AI

Sara AI peut aider à :

```txt
rédiger une annonce officielle
améliorer la clarté
rendre le ton plus institutionnel
raccourcir le texte
générer un résumé
proposer un titre
traduire FR/EN
générer une relance pour non-lecteurs
détecter une formulation ambiguë
adapter le message selon l’audience
```

## Règle

```txt
Sara AI assiste.
L’humain valide avant publication.
```

---

# 16. Alertes ORION

ORION doit détecter :

```txt
annonce critique non lue
taux de lecture faible
annonce sans audience
annonce expirée encore affichée
annonce planifiée sans contenu
annonce publiée sans confirmation alors que priorité critique
pièce jointe inaccessible
annonce bilingue incomplète
relance non effectuée
audience incohérente
canal complémentaire en échec
```

Chaque alerte doit contenir :

```txt
niveau
description
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Annonces — Taux de lecture faible

Une annonce importante publiée il y a 48h présente un taux de lecture inférieur au seuil défini.
Impact possible : information officielle non reçue par une partie des familles.
Action recommandée : relancer les non-lecteurs ou activer un canal complémentaire.
```

---

# 17. Archivage

Règles :

```txt
archivage manuel
archivage automatique après expiration
conservation selon politique
consultation des archives
restauration si autorisée
suppression logique uniquement
export PDF si autorisé
```

Une annonce archivée doit rester consultable selon les droits.

---

# 18. Statistiques

Indicateurs :

```txt
nombre d’annonces publiées
annonces actives
annonces expirées
taux moyen de lecture
taux moyen de confirmation
annonces par catégorie
annonces par audience
annonces par priorité
relances effectuées
non-lecteurs persistants
canaux les plus efficaces
```

---

# 19. Base de données — Announcement

```prisma
model Announcement {
  id              String @id @default(cuid())
  tenantId        String

  titleFr         String
  titleEn         String?
  summaryFr       String?
  summaryEn       String?
  bodyFr          String
  bodyEn          String?

  category        AnnouncementCategory @default(GENERAL)
  priority        CommunicationPriority @default(NORMAL)
  status          AnnouncementStatus @default(DRAFT)

  audience        Json
  visibility      Json?
  channels        Json?

  requiresAck     Boolean @default(false)

  publishedAt     DateTime?
  scheduledAt     DateTime?
  expiresAt       DateTime?
  archivedAt      DateTime?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  attachments     AnnouncementAttachment[]
  readReceipts    AnnouncementReadReceipt[]

  @@index([tenantId])
  @@index([category])
  @@index([priority])
  @@index([status])
  @@index([publishedAt])
  @@index([expiresAt])
}
```

---

# 20. Base de données — AnnouncementAttachment

```prisma
model AnnouncementAttachment {
  id              String @id @default(cuid())
  tenantId        String

  announcementId  String

  fileName        String
  fileUrl         String
  fileType        String?
  fileSize        Int?

  uploadedById    String?
  createdAt       DateTime @default(now())

  announcement    Announcement @relation(fields: [announcementId], references: [id])

  @@index([tenantId])
  @@index([announcementId])
}
```

---

# 21. Base de données — AnnouncementReadReceipt

```prisma
model AnnouncementReadReceipt {
  id              String @id @default(cuid())
  tenantId        String

  announcementId  String
  userId          String?

  recipientType   CommunicationRecipientType
  recipientId     String?

  readAt          DateTime?
  acknowledgedAt  DateTime?
  remindedAt      DateTime?

  announcement    Announcement @relation(fields: [announcementId], references: [id])

  @@unique([announcementId, recipientType, recipientId])
  @@index([tenantId])
  @@index([announcementId])
  @@index([recipientType, recipientId])
  @@index([readAt])
  @@index([acknowledgedAt])
}
```

---

# 22. Enums

```prisma
enum AnnouncementCategory {
  GENERAL
  ADMINISTRATIVE
  PEDAGOGICAL
  FINANCE
  DISCIPLINE
  EXAM
  EVENT
  EMERGENCY
  LIBRARY
  HR
  SCHOOL_LIFE
}

enum AnnouncementStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  EXPIRED
  ARCHIVED
  CANCELLED
}
```

---

# 23. Backend — Routes API

```http
GET    /api/communication/announcements
POST   /api/communication/announcements
GET    /api/communication/announcements/:announcementId
PATCH  /api/communication/announcements/:announcementId
POST   /api/communication/announcements/:announcementId/publish
POST   /api/communication/announcements/:announcementId/schedule
POST   /api/communication/announcements/:announcementId/cancel
POST   /api/communication/announcements/:announcementId/archive
POST   /api/communication/announcements/:announcementId/duplicate

POST   /api/communication/announcements/:announcementId/attachments
GET    /api/communication/announcements/:announcementId/read-receipts
POST   /api/communication/announcements/:announcementId/read
POST   /api/communication/announcements/:announcementId/acknowledge
POST   /api/communication/announcements/:announcementId/remind-non-readers

GET    /api/communication/announcements/:announcementId/stats
GET    /api/communication/announcements/orion-alerts
GET    /api/communication/announcements/sara-suggestions
```

---

# 24. Backend — Services

Services recommandés :

```txt
AnnouncementService
AnnouncementAudienceService
AnnouncementPublishingService
AnnouncementSchedulingService
AnnouncementAttachmentService
AnnouncementReadReceiptService
AnnouncementReminderService
AnnouncementStatsService
AnnouncementSaraService
AnnouncementOrionService
AnnouncementAuditService
```

---

# 25. Sécurité

## Permissions

```txt
COMMUNICATION_ANNOUNCEMENTS_VIEW
COMMUNICATION_ANNOUNCEMENTS_CREATE
COMMUNICATION_ANNOUNCEMENTS_UPDATE
COMMUNICATION_ANNOUNCEMENTS_PUBLISH
COMMUNICATION_ANNOUNCEMENTS_SCHEDULE
COMMUNICATION_ANNOUNCEMENTS_ARCHIVE
COMMUNICATION_ANNOUNCEMENTS_DELETE
COMMUNICATION_ANNOUNCEMENTS_ATTACH_FILE
COMMUNICATION_ANNOUNCEMENTS_READ_RECEIPTS_VIEW
COMMUNICATION_ANNOUNCEMENTS_REMIND
COMMUNICATION_ANNOUNCEMENTS_STATS_VIEW
COMMUNICATION_ANNOUNCEMENTS_SARA_USE
COMMUNICATION_ANNOUNCEMENTS_ORION_VIEW
COMMUNICATION_ANNOUNCEMENTS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
filtrage par audience
visibilité selon portail
modification post-publication historisée
pièces jointes sécurisées
pas de suppression physique par défaut
validation obligatoire pour annonce critique si configurée
audit complet
```

---

# 26. Audit

Auditer :

```txt
création annonce
modification annonce
publication
planification
annulation
archivage
duplication
ajout pièce jointe
lecture
confirmation
relance non-lecteurs
export preuve de lecture
utilisation Sara AI
alerte ORION
accès refusé
```

---

# 27. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 3 — Annonces officielles** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
annonces ciblées
publication immédiate ou planifiée
visibilité par portail
confirmation de lecture
relance des non-lecteurs
traduction FR/EN
pièces jointes sécurisées
ORION Communication
Sara AI en assistance uniquement
audit complet
suppression logique uniquement
```

## À créer côté frontend

```txt
Page /communication/announcements
AnnouncementsPage
AnnouncementHeader
AnnouncementList
AnnouncementCard
AnnouncementFilters
AnnouncementSearchBar
AnnouncementCreateDialog
AnnouncementEditor
AnnouncementAudienceSelector
AnnouncementPrioritySelector
AnnouncementVisibilitySettings
AnnouncementSchedulePanel
AnnouncementAttachmentUploader
AnnouncementReadReceiptPanel
AnnouncementNonReadersPanel
AnnouncementStatsPanel
AnnouncementSaraAssistantPanel
AnnouncementOrionAlertsPanel
AnnouncementArchivePanel
AnnouncementAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion annonces
Ciblage audience
Publication immédiate
Planification
Expiration
Archivage
Pièces jointes
Lecture et confirmation
Relance des non-lecteurs
Statistiques
ORION Annonces
Sara AI Assistance
Audit complet
```

## À créer côté BDD

```txt
Announcement
AnnouncementAttachment
AnnouncementReadReceipt
Enums AnnouncementCategory, AnnouncementStatus
Relations avec Tenant, User, CommunicationRecipientType, AuditLog
```

---

# 28. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer des annonces officielles
cibler précisément les audiences
publier immédiatement
programmer une publication
définir une expiration
afficher selon portail
ajouter des pièces jointes
gérer les versions FR/EN
suivre les lectures
exiger une confirmation
relancer les non-lecteurs
archiver les annonces
consulter les statistiques
recevoir les alertes ORION
utiliser Sara AI pour rédiger ou traduire
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Annonces officielles** donne à Academia Helm une capacité de communication institutionnelle propre, suivie et professionnelle.

La règle d’or :

```txt
Une annonce officielle doit être claire, ciblée, traçable et mesurable.
```

Avec cet onglet, l’établissement ne se contente plus de publier une information : il sait qui l’a reçue, qui l’a lue, qui l’a confirmée et qui doit être relancé.

La suite logique :

```txt
Onglet 4 — Notifications automatiques
```

---

Parfait. On passe à l’**Onglet 4 — Notifications automatiques**. Ici, on entre dans le moteur intelligent du module Communication. Ce n’est pas juste “envoyer une alerte quand quelque chose arrive”. C’est un **système de règles métier**, multicanal, contrôlé, traçable et capable de s’adapter aux réalités de chaque établissement.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 4 — NOTIFICATIONS AUTOMATIQUES

---

# 1. Objectif de l’onglet

L’onglet **Notifications automatiques** permet de configurer, superviser et historiser toutes les notifications générées automatiquement par les modules de Academia Helm.

Il ne s’agit pas seulement d’envoyer des alertes.
Il s’agit de créer un moteur de notification scolaire intelligent, fiable, paramétrable, multicanal et conforme aux règles de chaque établissement.

Objectif principal :

```txt
informer automatiquement les bonnes personnes
au bon moment
via le bon canal
avec le bon modèle
selon les règles définies par l’école
avec une traçabilité complète
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/automated-notifications
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Élèves & Scolarité
Présence & Discipline
Examens, Notes & Bulletins
Finance & Scolarité
Pédagogie
Bibliothèque virtuelle
Enseignants & RH
Administration
Portail Parent/Élève
Portail Enseignant
Modèles de messages
Canaux & Connecteurs
Historique & Traçabilité
ORION Communication
Sara AI
Audit
```

---

# 3. Principe général

Chaque module de Academia Helm peut déclencher une notification automatique selon des événements métiers.

Exemples :

```txt
élève absent
élève en retard
paiement reçu
paiement en retard
note publiée
bulletin disponible
devoir publié
document manquant
sanction disciplinaire
annonce critique
ressource pédagogique ajoutée
convocation
changement de classe
réinscription ouverte
```

## Règle métier

```txt
Une notification automatique ne doit jamais être un envoi aveugle.
Elle doit respecter les règles de déclenchement, les préférences de communication,
les permissions, le tenant, la langue, le canal et l’historique.
```

Autrement dit : automatiser, oui. Arroser tout le monde comme un tuyau percé, non.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord des notifications automatiques
2. Liste des règles de notification
3. Création d’une règle
4. Déclencheurs métiers
5. Conditions d’envoi
6. Destinataires
7. Canaux
8. Modèles de messages
9. Planification & délais
10. Relances automatiques
11. Journal des notifications
12. Notifications échouées
13. Tests de notification
14. Suggestions Sara AI
15. Alertes ORION
16. Paramètres avancés
17. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/automated-notifications
```

## 5.2 Page principale

```txt
app/(school)/communication/automated-notifications/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/automated-notifications/AutomatedNotificationsPage.tsx
components/communication/automated-notifications/AutomatedNotificationHeader.tsx
components/communication/automated-notifications/NotificationRuleList.tsx
components/communication/automated-notifications/NotificationRuleCard.tsx
components/communication/automated-notifications/NotificationRuleCreateDialog.tsx
components/communication/automated-notifications/NotificationRuleEditor.tsx
components/communication/automated-notifications/NotificationTriggerSelector.tsx
components/communication/automated-notifications/NotificationConditionBuilder.tsx
components/communication/automated-notifications/NotificationRecipientSelector.tsx
components/communication/automated-notifications/NotificationChannelSelector.tsx
components/communication/automated-notifications/NotificationTemplateSelector.tsx
components/communication/automated-notifications/NotificationDelaySettings.tsx
components/communication/automated-notifications/NotificationReminderSettings.tsx
components/communication/automated-notifications/NotificationDeliveryLog.tsx
components/communication/automated-notifications/FailedNotificationsPanel.tsx
components/communication/automated-notifications/NotificationTestPanel.tsx
components/communication/automated-notifications/NotificationSaraAssistantPanel.tsx
components/communication/automated-notifications/NotificationOrionAlertsPanel.tsx
components/communication/automated-notifications/NotificationAdvancedSettingsPanel.tsx
components/communication/automated-notifications/NotificationAuditTimeline.tsx
```

---

# 6. Tableau de bord des notifications automatiques

Le haut de page doit afficher :

```txt
notifications générées aujourd’hui
notifications générées cette semaine
notifications livrées
notifications lues
notifications échouées
règles actives
règles désactivées
relances automatiques en attente
canaux les plus utilisés
alertes ORION
```

## Cartes KPI recommandées

```txt
total notifications
taux de livraison
taux d’échec
taux de lecture
règles actives
règles critiques
notifications en file d’attente
notifications bloquées
familles non joignables
canaux dégradés
```

---

# 7. Liste des règles de notification

Chaque règle doit afficher :

```txt
nom
module source
événement déclencheur
statut actif/inactif
priorité
audience
canal principal
canal de secours
modèle associé
délai d’envoi
relance activée ou non
dernière exécution
taux de succès
anomalies ORION
```

## Statuts possibles

```txt
active
inactive
brouillon
en erreur
suspendue
obsolète
```

## Filtres

```txt
module source
événement
statut
priorité
canal
audience
langue
relance activée
règles en erreur
règles critiques
```

---

# 8. Création d’une règle

Le formulaire doit contenir :

```txt
nom de la règle
description
module source
événement déclencheur
conditions
destinataires
canal principal
canal secondaire
modèle de message
langue
priorité
délai avant envoi
fenêtre horaire d’envoi
relance automatique
limite de relance
statut
test avant activation
```

Le système doit empêcher l’activation si :

```txt
aucun déclencheur
aucun destinataire
aucun canal
aucun modèle
modèle incomplet
canal non configuré
règle incohérente
permission insuffisante
```

---

# 9. Déclencheurs métiers

## 9.1 Élèves & Scolarité

```txt
inscription validée
dossier incomplet
document manquant
changement de classe
transfert
réinscription ouverte
réinscription validée
radiation
mouvement scolaire
```

## 9.2 Présence & Discipline

```txt
absence
retard
sortie anticipée
sanction
avertissement
convocation disciplinaire
comportement signalé
```

## 9.3 Finance & Scolarité

```txt
paiement reçu
paiement échoué
paiement en retard
échéance proche
solde impayé
reçu disponible
facture générée
remise appliquée
relance scolarité
```

## 9.4 Examens, Notes & Bulletins

```txt
note publiée
moyenne calculée
bulletin disponible
bulletin modifié
conseil de classe planifié
appréciation manquante
saisie de notes en retard
examen programmé
```

## 9.5 Pédagogie

```txt
devoir publié
cahier de textes ajouté
ressource pédagogique ajoutée
activité planifiée
séance modifiée
progression non renseignée
```

## 9.6 Bibliothèque virtuelle

```txt
nouveau document disponible
ressource mise à jour
ressource recommandée
document retiré
catégorie ajoutée
```

## 9.7 Enseignants & RH

```txt
contrat expirant
absence enseignant
remplacement
rappel administratif
document RH manquant
réunion pédagogique
```

## 9.8 Administration

```txt
annonce officielle publiée
événement créé
convocation
document administratif disponible
rappel général
```

---

# 10. Conditions d’envoi

Le moteur doit permettre des conditions :

```txt
niveau scolaire
classe
cycle
statut élève
statut paiement
nombre de jours de retard
type d’absence
gravité disciplinaire
période scolaire
trimestre
séquence
langue préférée
canal disponible
rôle utilisateur
consentement communication
historique de lecture
non-réception précédente
```

Exemples :

```txt
envoyer uniquement si absence non justifiée
envoyer si paiement en retard de plus de 7 jours
envoyer si bulletin publié et validé
envoyer si parent possède WhatsApp actif
envoyer en anglais si préférence EN
```

---

# 11. Destinataires

Destinataires possibles :

```txt
parent principal
parents secondaires
élève
enseignant
professeur principal
direction
comptabilité
vie scolaire
administration
responsable pédagogique
classe
niveau
groupe
rôle
utilisateur spécifique
```

## Règles

```txt
respecter le tenant
respecter les permissions
éviter les doublons
gérer les responsables multiples
appliquer les préférences de langue
appliquer les canaux disponibles
vérifier les contacts valides
```

---

# 12. Canaux

Canaux possibles :

```txt
portail
email
SMS
WhatsApp
push
webhook/API
```

Pour chaque règle :

```txt
canal principal
canal secondaire
fallback automatique
délai avant fallback
priorité canal
coût estimé
statut canal
limite quotidienne
```

Exemple :

```txt
1. Envoyer par WhatsApp
2. Si échec après 10 minutes, envoyer par SMS
3. Si échec, créer une alerte portail et ORION
```

---

# 13. Modèles de messages

Chaque notification doit utiliser un modèle.

Types :

```txt
modèle SMS
modèle email
modèle WhatsApp
modèle portail
modèle push
```

Le modèle doit gérer :

```txt
version française
version anglaise
variables dynamiques
prévisualisation
validation
statut actif/inactif
```

Variables possibles :

```txt
{{schoolName}}
{{studentFirstName}}
{{studentLastName}}
{{className}}
{{parentName}}
{{amountDue}}
{{dueDate}}
{{paymentLink}}
{{subjectName}}
{{grade}}
{{teacherName}}
{{portalLink}}
{{eventDate}}
```

---

# 14. Planification & délais

Paramètres :

```txt
envoi immédiat
envoi différé
délai en minutes
délai en heures
délai en jours
fenêtre horaire autorisée
jours autorisés
éviter jours fériés
éviter heures nocturnes
regroupement de notifications
anti-spam
```

Exemples :

```txt
absence : notification après 10 minutes
paiement en retard : relance chaque 7 jours
bulletin : notification immédiate après publication
devoir : notification à 18h
document manquant : relance tous les 3 jours
```

---

# 15. Relances automatiques

Le système doit permettre :

```txt
relance si non lu
relance si non livré
relance si non confirmé
relance avant échéance
relance après échéance
relance par canal alternatif
limite du nombre de relances
délai entre relances
arrêt automatique après action
```

Exemples :

```txt
relancer un parent si une annonce critique n’est pas lue après 24h
relancer si paiement non effectué après 7 jours
relancer un enseignant si les notes ne sont pas saisies
relancer si un document obligatoire reste manquant
```

---

# 16. Journal des notifications

Le journal doit afficher :

```txt
notification
règle source
module source
événement
destinataire
canal
modèle
statut
date génération
date envoi
date livraison
date lecture
erreur éventuelle
tentative
fallback utilisé
lien vers entité métier
```

## Statuts

```txt
générée
en attente
envoyée
livrée
lue
échouée
annulée
bloquée
expirée
```

---

# 17. Notifications échouées

Afficher :

```txt
canal échoué
destinataire
raison
règle source
date
nombre de tentatives
fallback disponible
action recommandée
```

## Actions

```txt
réessayer
envoyer par canal alternatif
corriger contact
désactiver règle
ouvrir fiche destinataire
créer alerte administrative
```

---

# 18. Tests de notification

Avant activation d’une règle, permettre :

```txt
test avec données fictives
test avec un élève réel autorisé
prévisualisation FR/EN
test canal
test fallback
simulation de conditions
estimation du volume
estimation du coût
```

---

# 19. Suggestions Sara AI

Sara AI peut aider à :

```txt
rédiger un modèle de notification
raccourcir un SMS
reformuler en ton administratif
traduire FR/EN
proposer des variables
détecter un message ambigu
proposer une relance
améliorer la clarté
adapter selon parent/enseignant/élève
```

## Règle

```txt
Sara AI propose.
L’utilisateur valide avant activation.
```

---

# 20. Alertes ORION

ORION doit détecter :

```txt
règle critique désactivée
notification en échec massif
canal principal indisponible
fallback non configuré
taux d’échec élevé
taux de lecture faible
relances excessives
notifications dupliquées
modèle incomplet
règle sans destinataire
notification bloquée
famille non joignable
coût anormalement élevé
surcharge de notifications
```

Chaque alerte doit contenir :

```txt
niveau
module source
règle concernée
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Notifications — Règle critique désactivée

La règle “absence non justifiée” est désactivée alors qu’elle concerne la sécurité et le suivi des élèves.
Impact possible : les parents ne sont pas informés automatiquement des absences.
Action recommandée : réactiver la règle ou définir un canal alternatif.
```

---

# 21. Paramètres avancés

Paramètres :

```txt
activation globale des notifications automatiques
canaux autorisés
langue par défaut
bilingue FR/EN
règles anti-spam
limites quotidiennes
fenêtres horaires
politique de fallback
politique de relance
conservation des logs
seuils ORION
validation obligatoire pour règles critiques
mode simulation
mode maintenance
```

---

# 22. Base de données — AutomatedNotificationRule

```prisma
model AutomatedNotificationRule {
  id              String @id @default(cuid())
  tenantId        String

  name            String
  description     String?

  sourceModule    NotificationSourceModule
  triggerEvent    String

  conditions      Json?
  recipients      Json
  channels        Json
  fallbackRules   Json?
  templateId      String?

  priority        CommunicationPriority @default(NORMAL)
  status          NotificationRuleStatus @default(DRAFT)

  delayMinutes    Int?
  sendingWindow   Json?
  reminderRules   Json?

  isCritical      Boolean @default(false)
  isSystemRule    Boolean @default(false)

  lastRunAt       DateTime?
  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([sourceModule])
  @@index([status])
  @@index([priority])
}
```

---

# 23. Base de données — AutomatedNotificationLog

```prisma
model AutomatedNotificationLog {
  id              String @id @default(cuid())
  tenantId        String

  ruleId          String?
  sourceModule    NotificationSourceModule
  triggerEvent    String

  recipientType   CommunicationRecipientType
  recipientId     String?
  recipientAddress String?

  channel         CommunicationChannelType
  fallbackUsed    Boolean @default(false)

  templateId      String?
  payload         Json?
  linkedEntityType String?
  linkedEntityId   String?

  status          AutomatedNotificationStatus @default(PENDING)

  generatedAt     DateTime @default(now())
  scheduledAt     DateTime?
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?

  attemptCount    Int @default(0)
  errorCode       String?
  errorMessage    String?

  @@index([tenantId])
  @@index([ruleId])
  @@index([sourceModule])
  @@index([channel])
  @@index([status])
  @@index([generatedAt])
}
```

---

# 24. Base de données — AutomatedNotificationAttempt

```prisma
model AutomatedNotificationAttempt {
  id              String @id @default(cuid())
  tenantId        String

  notificationLogId String

  channel         CommunicationChannelType
  provider        String?
  status          AutomatedNotificationStatus

  attemptedAt     DateTime @default(now())
  responsePayload Json?
  errorCode       String?
  errorMessage    String?

  @@index([tenantId])
  @@index([notificationLogId])
  @@index([channel])
  @@index([status])
}
```

---

# 25. Enums

```prisma
enum NotificationSourceModule {
  STUDENTS
  ATTENDANCE_DISCIPLINE
  FINANCE
  EXAMS_GRADES_REPORTS
  PEDAGOGY
  VIRTUAL_LIBRARY
  TEACHERS_HR
  ADMINISTRATION
  COMMUNICATION
  SETTINGS
}

enum NotificationRuleStatus {
  DRAFT
  ACTIVE
  INACTIVE
  SUSPENDED
  ERROR
  OBSOLETE
}

enum AutomatedNotificationStatus {
  GENERATED
  PENDING
  SCHEDULED
  SENT
  DELIVERED
  READ
  FAILED
  CANCELLED
  BLOCKED
  EXPIRED
}
```

---

# 26. Backend — Routes API

```http
GET    /api/communication/automated-notifications
GET    /api/communication/automated-notifications/dashboard

GET    /api/communication/automated-notifications/rules
POST   /api/communication/automated-notifications/rules
GET    /api/communication/automated-notifications/rules/:ruleId
PATCH  /api/communication/automated-notifications/rules/:ruleId
POST   /api/communication/automated-notifications/rules/:ruleId/activate
POST   /api/communication/automated-notifications/rules/:ruleId/deactivate
POST   /api/communication/automated-notifications/rules/:ruleId/test
POST   /api/communication/automated-notifications/rules/:ruleId/duplicate

GET    /api/communication/automated-notifications/logs
GET    /api/communication/automated-notifications/logs/:logId
POST   /api/communication/automated-notifications/logs/:logId/retry
POST   /api/communication/automated-notifications/logs/:logId/send-fallback

GET    /api/communication/automated-notifications/failed
GET    /api/communication/automated-notifications/orion-alerts
GET    /api/communication/automated-notifications/sara-suggestions
GET    /api/communication/automated-notifications/settings
PATCH  /api/communication/automated-notifications/settings
```

---

# 27. Backend — Services

Services recommandés :

```txt
AutomatedNotificationService
NotificationRuleService
NotificationTriggerService
NotificationConditionService
NotificationRecipientResolverService
NotificationChannelRouterService
NotificationTemplateRendererService
NotificationFallbackService
NotificationReminderService
NotificationQueueService
NotificationDeliveryService
NotificationLogService
NotificationRetryService
NotificationTestService
NotificationSaraService
NotificationOrionService
NotificationAuditService
```

---

# 28. Sécurité

## Permissions

```txt
COMMUNICATION_NOTIFICATIONS_VIEW
COMMUNICATION_NOTIFICATIONS_RULES_VIEW
COMMUNICATION_NOTIFICATIONS_RULES_CREATE
COMMUNICATION_NOTIFICATIONS_RULES_UPDATE
COMMUNICATION_NOTIFICATIONS_RULES_ACTIVATE
COMMUNICATION_NOTIFICATIONS_RULES_DEACTIVATE
COMMUNICATION_NOTIFICATIONS_RULES_TEST
COMMUNICATION_NOTIFICATIONS_LOGS_VIEW
COMMUNICATION_NOTIFICATIONS_RETRY
COMMUNICATION_NOTIFICATIONS_SETTINGS_MANAGE
COMMUNICATION_NOTIFICATIONS_SARA_USE
COMMUNICATION_NOTIFICATIONS_ORION_VIEW
COMMUNICATION_NOTIFICATIONS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
validation des règles
validation des destinataires
respect des préférences de communication
respect de la langue
protection contre le spam
limitation des volumes
audit complet
pas d’envoi hors tenant
pas de notification sensible sans règle autorisée
```

---

# 29. Audit

Auditer :

```txt
création règle
modification règle
activation règle
désactivation règle
test règle
duplication règle
génération notification
envoi notification
échec notification
retry
fallback
modification paramètres
utilisation Sara AI
alerte ORION
accès aux logs
accès refusé
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 4 — Notifications automatiques** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
moteur de règles
déclencheurs métiers
conditions dynamiques
destinataires dynamiques
modèles FR/EN
canaux multicanaux
fallback
relances automatiques
logs complets
tests avant activation
ORION Communication
Sara AI en assistance uniquement
audit complet
```

## À créer côté frontend

```txt
Page /communication/automated-notifications
AutomatedNotificationsPage
AutomatedNotificationHeader
NotificationRuleList
NotificationRuleCard
NotificationRuleCreateDialog
NotificationRuleEditor
NotificationTriggerSelector
NotificationConditionBuilder
NotificationRecipientSelector
NotificationChannelSelector
NotificationTemplateSelector
NotificationDelaySettings
NotificationReminderSettings
NotificationDeliveryLog
FailedNotificationsPanel
NotificationTestPanel
NotificationSaraAssistantPanel
NotificationOrionAlertsPanel
NotificationAdvancedSettingsPanel
NotificationAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Moteur de règles
Déclencheurs métiers
Conditions dynamiques
Résolution des destinataires
Rendu des modèles
Routage multicanal
Fallback automatique
Relances automatiques
Journalisation complète
Retry
Tests
ORION Notifications
Sara AI Assistance
Audit complet
```

## À créer côté BDD

```txt
AutomatedNotificationRule
AutomatedNotificationLog
AutomatedNotificationAttempt
Enums NotificationSourceModule, NotificationRuleStatus, AutomatedNotificationStatus
Relations avec Tenant, User, CommunicationTemplate, AuditLog et modules métiers
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer des règles de notification automatique
associer des déclencheurs métiers
définir des conditions d’envoi
résoudre dynamiquement les destinataires
choisir les canaux
associer des modèles FR/EN
configurer les délais
configurer les relances
tester les règles
activer/désactiver les règles
suivre les logs
gérer les échecs
réessayer ou basculer en fallback
recevoir les alertes ORION
utiliser Sara AI pour améliorer les messages
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Notifications automatiques** est le moteur réactif de Academia Helm.

La règle d’or :

```txt
Une bonne notification n’est pas celle qui part vite.
C’est celle qui part au bon moment, à la bonne personne, avec le bon canal et une trace fiable.
```

Avec cet onglet, Academia Helm devient proactif : la plateforme ne se contente plus d’enregistrer les événements, elle déclenche les bonnes communications automatiquement, sans perdre le contrôle humain.

La suite logique :

```txt
Onglet 5 — Campagnes de communication
```

---

Très bien. On passe à l’**Onglet 5 — Campagnes de communication**. Ici, on change de niveau : une campagne n’est pas une annonce isolée ni une notification automatique. C’est une **opération de communication structurée**, avec objectif, audience, calendrier, canaux, relances et indicateurs de performance.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 5 — CAMPAGNES DE COMMUNICATION

---

# 1. Objectif de l’onglet

L’onglet **Campagnes de communication** permet à l’établissement de créer, planifier, diffuser, suivre et analyser des campagnes de communication ciblées auprès des familles, élèves, enseignants, personnels ou groupes spécifiques.

Contrairement aux notifications automatiques, une campagne est une communication :

```txt id="t4p4rk"
organisée
volontaire
planifiée
orientée objectif
mesurable
```

Exemples :

```txt id="2f8ynw"
campagne de rentrée scolaire
campagne de réinscription
campagne de paiement de scolarité
campagne d’information parents
campagne d’examen
campagne de sensibilisation
campagne pédagogique
campagne RH interne
campagne événementielle
campagne bilingue FR/EN
```

---

# 2. Positionnement dans le module

## Route frontend

```txt id="14k84d"
/communication/campaigns
```

## Module parent

```txt id="rg09rw"
Communication & Notifications
```

## Dépendances directes

```txt id="01u2gq"
Élèves & Scolarité
Finance & Scolarité
Examens, Notes & Bulletins
Pédagogie
Bibliothèque virtuelle
Enseignants & RH
Parents & Élèves
Portail Parent/Élève
Portail Enseignant
Modèles de messages
Canaux & Connecteurs
Historique & Traçabilité
ORION Communication
Sara AI
Audit
```

---

# 3. Principe général

Une campagne de communication doit permettre de gérer une action de communication complète :

```txt id="w11a2j"
1. objectif
2. audience
3. message
4. canaux
5. calendrier
6. relances
7. suivi
8. analyse
```

## Règle métier

```txt id="bq09qc"
Une campagne ne doit pas être un simple envoi groupé.
Elle doit être pilotée par objectifs, audience, canaux, indicateurs et résultats.
```

Envoyer un message à tout le monde, c’est facile. Obtenir que les bonnes personnes reçoivent, lisent et agissent, c’est là que Academia Helm doit faire la différence.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt id="zucd8c"
1. Tableau de bord des campagnes
2. Liste des campagnes
3. Création de campagne
4. Objectifs de campagne
5. Segmentation d’audience
6. Contenu & modèles
7. Canaux de diffusion
8. Planification
9. Relances
10. Tests & prévisualisation
11. Suivi des envois
12. Statistiques & performance
13. Campagnes échouées ou partielles
14. Suggestions Sara AI
15. Alertes ORION
16. Archivage
17. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt id="f7z0pa"
/communication/campaigns
```

## 5.2 Page principale

```txt id="s50ny4"
app/(school)/communication/campaigns/page.tsx
```

## 5.3 Composants recommandés

```txt id="dwhg62"
components/communication/campaigns/CommunicationCampaignsPage.tsx
components/communication/campaigns/CampaignDashboardCards.tsx
components/communication/campaigns/CampaignList.tsx
components/communication/campaigns/CampaignCard.tsx
components/communication/campaigns/CampaignFilters.tsx
components/communication/campaigns/CampaignSearchBar.tsx
components/communication/campaigns/CampaignCreateDialog.tsx
components/communication/campaigns/CampaignWizard.tsx
components/communication/campaigns/CampaignObjectiveStep.tsx
components/communication/campaigns/CampaignAudienceStep.tsx
components/communication/campaigns/CampaignContentStep.tsx
components/communication/campaigns/CampaignChannelsStep.tsx
components/communication/campaigns/CampaignScheduleStep.tsx
components/communication/campaigns/CampaignReminderStep.tsx
components/communication/campaigns/CampaignPreviewStep.tsx
components/communication/campaigns/CampaignDeliveryTracker.tsx
components/communication/campaigns/CampaignStatsPanel.tsx
components/communication/campaigns/CampaignFailedRecipientsPanel.tsx
components/communication/campaigns/CampaignSaraAssistantPanel.tsx
components/communication/campaigns/CampaignOrionAlertsPanel.tsx
components/communication/campaigns/CampaignArchivePanel.tsx
components/communication/campaigns/CampaignAuditTimeline.tsx
```

---

# 6. Tableau de bord des campagnes

Le tableau de bord doit afficher :

```txt id="6h6d5u"
campagnes actives
campagnes planifiées
campagnes terminées
campagnes en brouillon
campagnes échouées
destinataires atteints
taux de livraison
taux de lecture
taux de réponse si applicable
relances effectuées
alertes ORION
campagnes critiques
```

## KPI recommandés

```txt id="7ef2w9"
total campagnes
campagnes ce mois
taux moyen de livraison
taux moyen de lecture
taux moyen de confirmation
volume de destinataires
coût estimé par canal
canaux les plus performants
segments les plus réactifs
campagnes à risque
```

---

# 7. Liste des campagnes

Chaque campagne doit afficher :

```txt id="eh44a3"
nom
objectif
statut
priorité
audience
canaux
date de début
date de fin
progression
taux de livraison
taux de lecture
taux de confirmation
relances
responsable
anomalies ORION
```

## Statuts possibles

```txt id="1tnr4t"
brouillon
prête
planifiée
en cours
suspendue
terminée
partiellement échouée
échouée
archivée
```

## Filtres

```txt id="3hw9f8"
statut
objectif
priorité
audience
canal
période
responsable
campagne bilingue
confirmation requise
campagne en erreur
campagne critique
```

---

# 8. Création de campagne

La création doit idéalement se faire via un assistant en étapes.

## Étapes recommandées

```txt id="yx61wl"
1. Objectif
2. Audience
3. Contenu
4. Canaux
5. Planification
6. Relances
7. Prévisualisation
8. Validation
```

## Champs principaux

```txt id="22v8az"
nom de campagne
description
objectif
catégorie
priorité
audience
langue
contenu FR
contenu EN
modèle associé
canaux
calendrier
relances
confirmation de lecture
responsable
budget/cout estimé si applicable
statut
```

Le système doit empêcher le lancement si :

```txt id="lg58k3"
aucun objectif
aucune audience
aucun message
aucun canal
modèle invalide
audience vide
canal non configuré
date incohérente
permission insuffisante
```

---

# 9. Objectifs de campagne

Objectifs possibles :

```txt id="p02l8z"
information générale
rentrée scolaire
réinscription
paiement scolarité
relance impayés
examens
bulletins
événement
sensibilisation
discipline
pédagogie
bibliothèque virtuelle
réunion parents
convocation
RH interne
urgence
satisfaction/enquête
```

Chaque objectif peut proposer :

```txt id="s6grzr"
modèles recommandés
canaux recommandés
segments recommandés
indicateurs recommandés
règles de relance recommandées
```

---

# 10. Segmentation d’audience

Segments possibles :

```txt id="a6i0no"
tous les parents
tous les élèves
tous les enseignants
tout le personnel
une classe
plusieurs classes
un niveau
un cycle
une série
élèves inscrits
élèves réinscrits
élèves non réinscrits
parents avec impayés
parents à jour
élèves absents fréquents
élèves candidats à un examen
enseignants d’un niveau
enseignants d’une matière
groupe personnalisé
import manuel si autorisé
```

## Critères dynamiques

```txt id="x3ewqm"
niveau
classe
statut scolarité
statut paiement
montant impayé
échéance
présence
discipline
résultats scolaires
langue
canal disponible
portail actif
confirmation précédente
historique de communication
```

---

# 11. Contenu & modèles

La campagne doit pouvoir utiliser :

```txt id="2i9lrk"
contenu manuel
modèle existant
modèle généré par Sara AI
contenu bilingue FR/EN
variables dynamiques
pièces jointes
lien portail
lien de paiement
lien de formulaire
bouton d’action
```

## Variables possibles

```txt id="hdnzrr"
{{schoolName}}
{{studentFirstName}}
{{studentLastName}}
{{className}}
{{parentName}}
{{amountDue}}
{{dueDate}}
{{paymentLink}}
{{examName}}
{{eventDate}}
{{portalLink}}
{{teacherName}}
```

## Types de contenu

```txt id="txi95r"
message court
email long
annonce portail
SMS
WhatsApp
push
note interne
campagne avec pièce jointe
```

---

# 12. Canaux de diffusion

Canaux possibles :

```txt id="5e08e7"
portail
email
SMS
WhatsApp
push
notification interne
webhook/API
```

Pour chaque campagne :

```txt id="4c0w5s"
canal principal
canaux complémentaires
canal de secours
fallback
estimation coût
limite d’envoi
priorité canal
statut canal
test canal
```

## Règles

```txt id="k9m5p9"
respecter préférences utilisateurs
respecter contacts disponibles
éviter doublons
appliquer langue
gérer fallback
historiser chaque tentative
```

---

# 13. Planification

Fonctionnalités :

```txt id="8v67bg"
lancement immédiat
lancement programmé
envoi par lots
envoi progressif
fenêtre horaire
jours autorisés
éviter heures nocturnes
éviter jours fériés
date de fin
expiration
suspension
reprise
annulation
```

Cas utiles :

```txt id="tqbhsa"
envoyer aux parents à 18h
envoyer les relances scolarité chaque lundi
envoyer les campagnes de réinscription en plusieurs vagues
limiter les SMS par jour pour contrôler les coûts
```

---

# 14. Relances

Types de relances :

```txt id="q4d5h4"
relance si non livré
relance si non lu
relance si non confirmé
relance si paiement non effectué
relance avant échéance
relance après échéance
relance par canal alternatif
relance manuelle
relance automatique
```

## Paramètres

```txt id="fcnqun"
délai
nombre maximal
canal
message différent
arrêt après action
exclusion des destinataires déjà convertis
suivi des relances
```

---

# 15. Tests & prévisualisation

Avant lancement :

```txt id="pqg0fg"
prévisualiser FR
prévisualiser EN
prévisualiser par canal
prévisualiser avec données fictives
prévisualiser avec destinataire réel autorisé
tester variables
tester liens
tester pièces jointes
tester canal
simuler volume
estimer coût
détecter erreurs
```

---

# 16. Suivi des envois

Le suivi doit afficher :

```txt id="w00fz2"
total destinataires
en attente
envoyés
livrés
lus
confirmés
échoués
bloqués
désabonnés si applicable
relancés
convertis si objectif mesurable
```

Chaque destinataire doit avoir :

```txt id="bzz9h8"
statut
canal utilisé
date envoi
date livraison
date lecture
date confirmation
erreur éventuelle
nombre de tentatives
fallback utilisé
```

---

# 17. Statistiques & performance

Indicateurs :

```txt id="4pvd73"
taux de livraison
taux de lecture
taux de confirmation
taux d’échec
taux de réponse
taux de conversion
performance par canal
performance par segment
performance par langue
coût par canal
coût par destinataire
temps moyen de lecture
relances efficaces
destinataires non joignables
```

## Graphiques recommandés

```txt id="d3vk9q"
courbe d’envoi
entonnoir livraison/lecture/confirmation
performance par canal
performance par segment
carte des erreurs
coût par canal
```

---

# 18. Campagnes échouées ou partielles

Le système doit afficher :

```txt id="7r6vkj"
destinataires non atteints
canaux échoués
erreurs de modèle
contacts invalides
variables manquantes
pièces jointes inaccessibles
règles de permission bloquantes
campagne suspendue
coût dépassé
```

## Actions

```txt id="mjx07u"
réessayer
corriger contacts
changer canal
exclure destinataires
relancer partiellement
dupliquer campagne
archiver
notifier responsable
```

---

# 19. Suggestions Sara AI

Sara AI peut aider à :

```txt id="o9ovrp"
rédiger une campagne
proposer un objet email
raccourcir un SMS
générer une version WhatsApp
traduire FR/EN
adapter le ton
proposer des segments
proposer des relances
détecter les ambiguïtés
améliorer le taux de lecture
générer une synthèse de performance
```

## Règle

```txt id="d9joc3"
Sara AI ne lance jamais une campagne sans validation humaine.
```

---

# 20. Alertes ORION

ORION doit détecter :

```txt id="ajyr31"
campagne critique non lancée
campagne en échec massif
taux de lecture faible
taux de livraison faible
audience vide
segment incohérent
canal indisponible
fallback absent
coût anormal
relances excessives
contenu bilingue incomplet
variables manquantes
lien de paiement cassé
pièce jointe inaccessible
campagne planifiée sans validation
destinataires non joignables
```

Chaque alerte doit contenir :

```txt id="7slhbm"
niveau
campagne
impact
recommandation
action rapide
statut
```

Exemple :

```txt id="e57osg"
ORION Campagnes — Campagne à risque

La campagne “Réinscription 2026” est planifiée, mais 32 % des destinataires n’ont aucun canal valide.
Impact possible : une partie importante des familles ne recevra pas l’information.
Action recommandée : corriger les contacts ou activer un canal alternatif.
```

---

# 21. Archivage

Règles :

```txt id="l8uwfz"
archivage manuel
archivage automatique après fin
conservation selon politique
consultation historique
duplication depuis archive
export rapport
suppression logique uniquement
```

---

# 22. Base de données — CommunicationCampaign

```prisma id="0j3o7w"
model CommunicationCampaign {
  id              String @id @default(cuid())
  tenantId        String

  name            String
  description     String?

  objective       CampaignObjective
  category        String?
  priority        CommunicationPriority @default(NORMAL)
  status          CampaignStatus @default(DRAFT)

  audience        Json
  content         Json
  channels        Json
  schedule        Json?
  reminderRules   Json?
  trackingRules   Json?

  requiresAck     Boolean @default(false)
  isBilingual     Boolean @default(false)
  estimatedCost   Decimal? @db.Decimal(12, 2)

  startsAt        DateTime?
  endsAt          DateTime?
  launchedAt      DateTime?
  completedAt     DateTime?
  archivedAt      DateTime?

  createdById     String?
  updatedById     String?
  responsibleId   String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  recipients      CommunicationCampaignRecipient[]
  deliveries      CommunicationCampaignDelivery[]

  @@index([tenantId])
  @@index([objective])
  @@index([priority])
  @@index([status])
  @@index([startsAt])
}
```

---

# 23. Base de données — CommunicationCampaignRecipient

```prisma id="j82gox"
model CommunicationCampaignRecipient {
  id              String @id @default(cuid())
  tenantId        String

  campaignId      String

  recipientType   CommunicationRecipientType
  recipientId     String?
  userId          String?

  preferredLanguage String?
  availableChannels Json?
  metadata        Json?

  status          CampaignRecipientStatus @default(PENDING)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  campaign        CommunicationCampaign @relation(fields: [campaignId], references: [id])

  @@index([tenantId])
  @@index([campaignId])
  @@index([recipientType, recipientId])
  @@index([status])
}
```

---

# 24. Base de données — CommunicationCampaignDelivery

```prisma id="q09tus"
model CommunicationCampaignDelivery {
  id              String @id @default(cuid())
  tenantId        String

  campaignId      String
  recipientId     String?

  channel         CommunicationChannelType
  status          CampaignDeliveryStatus @default(PENDING)

  messagePayload  Json?
  provider        String?
  providerMessageId String?

  scheduledAt     DateTime?
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  acknowledgedAt  DateTime?
  failedAt        DateTime?

  attemptCount    Int @default(0)
  fallbackUsed    Boolean @default(false)

  errorCode       String?
  errorMessage    String?

  campaign        CommunicationCampaign @relation(fields: [campaignId], references: [id])

  @@index([tenantId])
  @@index([campaignId])
  @@index([recipientId])
  @@index([channel])
  @@index([status])
}
```

---

# 25. Enums

```prisma id="n6xgvq"
enum CampaignObjective {
  GENERAL_INFORMATION
  BACK_TO_SCHOOL
  RE_ENROLLMENT
  TUITION_PAYMENT
  PAYMENT_REMINDER
  EXAMS
  REPORT_CARDS
  EVENT
  AWARENESS
  DISCIPLINE
  PEDAGOGY
  VIRTUAL_LIBRARY
  PARENT_MEETING
  SUMMONS
  INTERNAL_HR
  EMERGENCY
  SURVEY
}

enum CampaignStatus {
  DRAFT
  READY
  SCHEDULED
  RUNNING
  SUSPENDED
  COMPLETED
  PARTIALLY_FAILED
  FAILED
  ARCHIVED
}

enum CampaignRecipientStatus {
  PENDING
  INCLUDED
  EXCLUDED
  SENT
  DELIVERED
  READ
  ACKNOWLEDGED
  FAILED
  CONVERTED
}

enum CampaignDeliveryStatus {
  PENDING
  SCHEDULED
  SENT
  DELIVERED
  READ
  ACKNOWLEDGED
  FAILED
  BLOCKED
  CANCELLED
}
```

---

# 26. Backend — Routes API

```http id="h22xv5"
GET    /api/communication/campaigns
GET    /api/communication/campaigns/dashboard
POST   /api/communication/campaigns
GET    /api/communication/campaigns/:campaignId
PATCH  /api/communication/campaigns/:campaignId
POST   /api/communication/campaigns/:campaignId/validate
POST   /api/communication/campaigns/:campaignId/launch
POST   /api/communication/campaigns/:campaignId/schedule
POST   /api/communication/campaigns/:campaignId/suspend
POST   /api/communication/campaigns/:campaignId/resume
POST   /api/communication/campaigns/:campaignId/cancel
POST   /api/communication/campaigns/:campaignId/archive
POST   /api/communication/campaigns/:campaignId/duplicate

GET    /api/communication/campaigns/:campaignId/recipients
POST   /api/communication/campaigns/:campaignId/recipients/refresh
GET    /api/communication/campaigns/:campaignId/deliveries
POST   /api/communication/campaigns/:campaignId/deliveries/retry-failed
POST   /api/communication/campaigns/:campaignId/reminders/send

GET    /api/communication/campaigns/:campaignId/stats
GET    /api/communication/campaigns/:campaignId/export
GET    /api/communication/campaigns/orion-alerts
GET    /api/communication/campaigns/sara-suggestions
```

---

# 27. Backend — Services

Services recommandés :

```txt id="t85yd4"
CommunicationCampaignService
CampaignDashboardService
CampaignAudienceService
CampaignSegmentationService
CampaignContentService
CampaignChannelService
CampaignSchedulerService
CampaignDeliveryService
CampaignReminderService
CampaignStatsService
CampaignRetryService
CampaignExportService
CampaignSaraService
CampaignOrionService
CampaignAuditService
```

---

# 28. Sécurité

## Permissions

```txt id="03pdaf"
COMMUNICATION_CAMPAIGNS_VIEW
COMMUNICATION_CAMPAIGNS_CREATE
COMMUNICATION_CAMPAIGNS_UPDATE
COMMUNICATION_CAMPAIGNS_VALIDATE
COMMUNICATION_CAMPAIGNS_LAUNCH
COMMUNICATION_CAMPAIGNS_SCHEDULE
COMMUNICATION_CAMPAIGNS_SUSPEND
COMMUNICATION_CAMPAIGNS_CANCEL
COMMUNICATION_CAMPAIGNS_ARCHIVE
COMMUNICATION_CAMPAIGNS_DUPLICATE
COMMUNICATION_CAMPAIGNS_STATS_VIEW
COMMUNICATION_CAMPAIGNS_EXPORT
COMMUNICATION_CAMPAIGNS_SARA_USE
COMMUNICATION_CAMPAIGNS_ORION_VIEW
COMMUNICATION_CAMPAIGNS_AUDIT_VIEW
```

## Contrôles

```txt id="ts8btu"
tenantId depuis session uniquement
RBAC strict
validation audience
validation contenu
validation canaux
respect préférences communication
respect langue
limitation des volumes
protection contre spam
audit complet
pas de campagne hors tenant
pas de lancement sans validation si configuré
```

---

# 29. Audit

Auditer :

```txt id="rby0g5"
création campagne
modification campagne
validation
lancement
planification
suspension
reprise
annulation
archivage
duplication
refresh audience
envoi
échec
retry
relance
export
utilisation Sara AI
alerte ORION
accès refusé
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 5 — Campagnes de communication** du **Module Communication & Notifications**.

## Stack

```txt id="k1xqnk"
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt id="4rwh2c"
multi-tenant strict
RBAC obligatoire
assistant de création en étapes
segmentation dynamique
contenu bilingue FR/EN
canaux multicanaux
planification
relances
suivi livraison/lecture/confirmation
statistiques
gestion échecs
ORION Communication
Sara AI en assistance uniquement
audit complet
```

## À créer côté frontend

```txt id="8c0kfs"
Page /communication/campaigns
CommunicationCampaignsPage
CampaignDashboardCards
CampaignList
CampaignCard
CampaignFilters
CampaignSearchBar
CampaignCreateDialog
CampaignWizard
CampaignObjectiveStep
CampaignAudienceStep
CampaignContentStep
CampaignChannelsStep
CampaignScheduleStep
CampaignReminderStep
CampaignPreviewStep
CampaignDeliveryTracker
CampaignStatsPanel
CampaignFailedRecipientsPanel
CampaignSaraAssistantPanel
CampaignOrionAlertsPanel
CampaignArchivePanel
CampaignAuditTimeline
```

## À créer côté backend

```txt id="bs4p1t"
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Segmentation dynamique
Génération des destinataires
Prévisualisation
Validation campagne
Planification
Lancement
Envoi multicanal
Suivi livraison/lecture/confirmation
Relances
Retry
Statistiques
Export
ORION Campagnes
Sara AI Assistance
Audit complet
```

## À créer côté BDD

```txt id="lxn6cf"
CommunicationCampaign
CommunicationCampaignRecipient
CommunicationCampaignDelivery
Enums CampaignObjective, CampaignStatus, CampaignRecipientStatus, CampaignDeliveryStatus
Relations avec Tenant, User, CommunicationTemplate, AuditLog et modules métiers
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt id="n0wbli"
créer une campagne
définir un objectif
segmenter une audience
rédiger un contenu FR/EN
choisir les canaux
planifier l’envoi
configurer les relances
prévisualiser
tester
valider
lancer
suivre les livraisons
suivre les lectures
suivre les confirmations
gérer les échecs
relancer
analyser la performance
exporter un rapport
archiver
recevoir les alertes ORION
utiliser Sara AI pour optimiser le contenu
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Campagnes de communication** transforme Academia Helm en véritable centre de pilotage de communication scolaire.

La règle d’or :

```txt id="xm3q3h"
Une campagne réussie n’est pas celle qui a été envoyée.
C’est celle qui a atteint la bonne cible et provoqué l’action attendue.
```

Avec cet onglet, l’établissement peut gérer ses campagnes de rentrée, de réinscription, de paiement, d’examen, d’événement et de sensibilisation avec un niveau professionnel.

La suite logique :

```txt id="vxcq6u"
Onglet 6 — Modèles de messages
```

---

Très bien. On attaque l’**Onglet 6 — Modèles de messages**. Cet onglet est stratégique, parce qu’il évite que chaque communication parte “au feeling”. Une école sérieuse doit communiquer avec des modèles propres, cohérents, validés, traduits et réutilisables.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 6 — MODÈLES DE MESSAGES

---

# 1. Objectif de l’onglet

L’onglet **Modèles de messages** permet de créer, organiser, valider, traduire, versionner et réutiliser des modèles de communication dans tout Academia Helm.

Ces modèles servent de base aux :

```txt
messages internes
annonces officielles
notifications automatiques
campagnes de communication
emails
SMS
WhatsApp
notifications push
messages portail
relances
convocations
communications administratives, financières, pédagogiques et disciplinaires
```

L’objectif est simple : éviter les messages improvisés, incohérents ou mal formulés.

Academia Helm doit permettre aux écoles de communiquer avec professionnalisme, cohérence et rapidité.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/templates
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Messages internes
Annonces officielles
Notifications automatiques
Campagnes de communication
Finance & Scolarité
Examens, Notes & Bulletins
Présence & Discipline
Élèves & Scolarité
Enseignants & RH
Portail Parent/Élève
Portail Enseignant
Sara AI
ORION Communication
Audit
```

---

# 3. Principe général

Un modèle de message est une structure réutilisable contenant :

```txt
un titre
un objet
un contenu
une catégorie
un canal
une langue
des variables dynamiques
des règles de validation
une version
un statut
une traçabilité
```

## Règle métier

```txt
Un modèle utilisé par une notification automatique ou une campagne active
ne doit pas être modifié brutalement sans versionnement.
```

Modifier un modèle critique sans versioning, c’est comme changer une recette de médicament sans prévenir la pharmacie. Techniquement possible, opérationnellement dangereux.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord des modèles
2. Liste des modèles
3. Création de modèle
4. Catégories de modèles
5. Modèles par canal
6. Modèles bilingues FR/EN
7. Variables dynamiques
8. Prévisualisation
9. Validation
10. Versioning
11. Modèles système
12. Modèles personnalisés école
13. Suggestions Sara AI
14. Alertes ORION
15. Archivage
16. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/templates
```

## 5.2 Page principale

```txt
app/(school)/communication/templates/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/templates/MessageTemplatesPage.tsx
components/communication/templates/TemplateDashboardCards.tsx
components/communication/templates/TemplateList.tsx
components/communication/templates/TemplateCard.tsx
components/communication/templates/TemplateFilters.tsx
components/communication/templates/TemplateSearchBar.tsx
components/communication/templates/TemplateCreateDialog.tsx
components/communication/templates/TemplateEditor.tsx
components/communication/templates/TemplateCategorySelector.tsx
components/communication/templates/TemplateChannelSelector.tsx
components/communication/templates/TemplateLanguageTabs.tsx
components/communication/templates/TemplateVariablePicker.tsx
components/communication/templates/TemplatePreviewPanel.tsx
components/communication/templates/TemplateValidationPanel.tsx
components/communication/templates/TemplateVersionHistory.tsx
components/communication/templates/SystemTemplatesPanel.tsx
components/communication/templates/SchoolTemplatesPanel.tsx
components/communication/templates/TemplateSaraAssistantPanel.tsx
components/communication/templates/TemplateOrionAlertsPanel.tsx
components/communication/templates/TemplateArchivePanel.tsx
components/communication/templates/TemplateAuditTimeline.tsx
```

---

# 6. Tableau de bord des modèles

Le tableau de bord doit afficher :

```txt
nombre total de modèles
modèles actifs
modèles brouillons
modèles archivés
modèles système
modèles personnalisés
modèles bilingues
modèles incomplets
modèles utilisés par notifications
modèles utilisés par campagnes
alertes ORION
```

## KPI recommandés

```txt
total modèles
modèles actifs
modèles à valider
modèles avec variables invalides
modèles sans version anglaise
modèles les plus utilisés
modèles jamais utilisés
modèles en conflit
modèles critiques
```

---

# 7. Liste des modèles

Chaque modèle doit afficher :

```txt
nom
catégorie
canal
langue
statut
type
version
dernière modification
auteur
nombre d’utilisations
modules liés
état de validation
anomalie ORION éventuelle
```

## Statuts possibles

```txt
brouillon
actif
à valider
validé
obsolète
archivé
```

## Types

```txt
système
école
personnalisé
généré par Sara AI
importé
```

## Filtres

```txt
catégorie
canal
langue
statut
type
utilisé/non utilisé
module lié
bilingue
variables invalides
modèles archivés
```

---

# 8. Création de modèle

Le formulaire doit contenir :

```txt
nom du modèle
description
catégorie
canal
module cible
type de communication
langue principale
version française
version anglaise
objet/titre
contenu court
contenu long
variables dynamiques
pièces jointes autorisées ou non
bouton d’action
lien dynamique
statut
validation requise
responsable
```

Le système doit empêcher l’activation si :

```txt
nom vide
canal absent
contenu absent
variables invalides
version FR absente
version EN requise mais absente
modèle SMS trop long selon configuration
modèle WhatsApp non conforme
objet email manquant
permission insuffisante
```

---

# 9. Catégories de modèles

Catégories recommandées :

```txt
général
administratif
financier
scolarité
présence
discipline
examens
notes
bulletins
pédagogie
bibliothèque
événement
réunion
convocation
relance
urgence
RH
inscription
réinscription
paiement
portail
```

Chaque catégorie peut avoir :

```txt
variables recommandées
canaux recommandés
ton recommandé
validation obligatoire ou non
priorité par défaut
```

---

# 10. Modèles par canal

## 10.1 Portail

```txt
titre
résumé
contenu
bouton d’action
niveau de priorité
confirmation de lecture possible
```

## 10.2 Email

```txt
objet
pré-header
corps HTML/texte
signature
pièces jointes
bouton d’action
```

## 10.3 SMS

```txt
message court
compteur de caractères
variables limitées
lien court
coût estimé
```

## 10.4 WhatsApp

```txt
message structuré
variables
bouton/lien si autorisé
conformité au fournisseur
prévisualisation mobile
```

## 10.5 Push

```txt
titre court
corps court
lien d’ouverture
priorité
expiration
```

## 10.6 Notification interne

```txt
titre
contenu
module cible
lien interne
niveau d’importance
```

---

# 11. Modèles bilingues FR/EN

Le système doit gérer :

```txt
titre FR
titre EN
objet FR
objet EN
contenu FR
contenu EN
variables communes
prévisualisation par langue
langue par défaut
fallback si traduction absente
```

## Règles

```txt
si l’école active le bilingue, les modèles critiques doivent avoir FR et EN
les variables doivent être identiques entre les versions
Sara AI peut proposer la traduction
validation humaine obligatoire avant activation
```

---

# 12. Variables dynamiques

Les variables permettent de personnaliser automatiquement les messages.

## Variables globales

```txt
{{schoolName}}
{{schoolAddress}}
{{schoolPhone}}
{{schoolEmail}}
{{portalLink}}
{{currentDate}}
{{academicYear}}
```

## Variables élèves

```txt
{{studentFirstName}}
{{studentLastName}}
{{studentFullName}}
{{studentMatricule}}
{{className}}
{{levelName}}
{{cycleName}}
```

## Variables parents

```txt
{{parentName}}
{{parentPhone}}
{{parentEmail}}
```

## Variables finance

```txt
{{amountDue}}
{{amountPaid}}
{{balance}}
{{dueDate}}
{{paymentLink}}
{{receiptNumber}}
```

## Variables examens

```txt
{{examName}}
{{subjectName}}
{{grade}}
{{average}}
{{rank}}
{{reportCardLink}}
```

## Variables pédagogie

```txt
{{teacherName}}
{{homeworkTitle}}
{{lessonTitle}}
{{resourceTitle}}
{{submissionDeadline}}
```

## Variables présence/discipline

```txt
{{absenceDate}}
{{delayTime}}
{{disciplineReason}}
{{summonsDate}}
```

## Contrôles

```txt
variable inconnue interdite
variable non disponible pour le module signalée
variable sensible protégée
prévisualisation obligatoire
fallback si valeur absente
```

---

# 13. Prévisualisation

La prévisualisation doit permettre :

```txt
aperçu portail
aperçu email
aperçu SMS
aperçu WhatsApp
aperçu push
aperçu FR
aperçu EN
aperçu avec données fictives
aperçu avec données réelles autorisées
détection des variables manquantes
estimation longueur SMS
estimation coût
rendu mobile
```

---

# 14. Validation

Le workflow de validation peut inclure :

```txt
brouillon
soumission à validation
validation direction
validation administration
validation communication
rejet avec commentaire
activation
archivage
```

## Règles

```txt
les modèles critiques peuvent exiger une validation
les modèles financiers peuvent exiger validation comptabilité/direction
les modèles disciplinaires peuvent exiger validation direction
les modèles système ne sont pas supprimables
les modèles actifs utilisés doivent être versionnés avant modification majeure
```

---

# 15. Versioning

Chaque modification importante doit créer une version.

## Données de version

```txt
numéro de version
auteur
date
motif
changements
statut
modèle parent
modèle précédent
```

## Fonctionnalités

```txt
consulter historique
comparer versions
restaurer une version
dupliquer une version
marquer une version obsolète
empêcher modification directe d’une version utilisée
```

---

# 16. Modèles système

Les modèles système sont fournis par Academia Helm.

Exemples :

```txt
absence non justifiée
retard élève
paiement reçu
paiement en retard
reçu disponible
bulletin publié
note publiée
devoir publié
annonce importante
convocation parent
réinscription ouverte
document manquant
```

## Règles

```txt
non supprimables
duplicables
personnalisables par école via copie
mis à jour par la plateforme
protégés contre modification directe si nécessaire
```

---

# 17. Modèles personnalisés école

Chaque établissement peut créer ses propres modèles.

Fonctionnalités :

```txt
créer
modifier
dupliquer
traduire
archiver
activer/désactiver
associer à un module
associer à une règle de notification
associer à une campagne
```

---

# 18. Suggestions Sara AI

Sara AI peut aider à :

```txt
rédiger un modèle
améliorer le ton
rendre le message plus professionnel
raccourcir un SMS
générer une version email
générer une version WhatsApp
traduire FR/EN
proposer des variables
détecter les incohérences
proposer un objet email
adapter le message à une audience
reformuler un message sensible
```

## Règle

```txt
Sara AI assiste.
L’humain valide avant activation.
```

---

# 19. Alertes ORION

ORION doit détecter :

```txt
modèle actif incomplet
variable inconnue
variable indisponible
modèle critique sans validation
modèle bilingue incomplet
SMS trop long
objet email manquant
modèle utilisé par règle inactive
modèle jamais utilisé
modèle obsolète encore utilisé
conflit entre versions
modèle système modifié incorrectement
traduction incohérente
contenu potentiellement ambigu
```

Chaque alerte doit contenir :

```txt
niveau
modèle
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Modèles — Variable invalide

Le modèle “Relance paiement” utilise la variable {{studentBalance}},
mais cette variable n’existe pas dans le dictionnaire officiel.
Impact possible : échec de rendu du message au moment de l’envoi.
Action recommandée : remplacer par {{balance}} ou créer une variable autorisée.
```

---

# 20. Archivage

Règles :

```txt
archivage manuel
archivage automatique si obsolète
modèle archivé non sélectionnable
conservation historique
restauration si autorisée
suppression logique uniquement
```

---

# 21. Base de données — CommunicationTemplate

```prisma
model CommunicationTemplate {
  id              String @id @default(cuid())
  tenantId        String?

  name            String
  description     String?

  category        CommunicationTemplateCategory
  channel         CommunicationChannelType
  targetModule    NotificationSourceModule?
  templateType    CommunicationTemplateType @default(SCHOOL)

  status          CommunicationTemplateStatus @default(DRAFT)
  priority        CommunicationPriority @default(NORMAL)

  titleFr         String?
  titleEn         String?
  subjectFr       String?
  subjectEn       String?
  bodyFr          String
  bodyEn          String?

  variables       Json?
  settings        Json?
  metadata        Json?

  isSystem        Boolean @default(false)
  isBilingual     Boolean @default(false)
  requiresApproval Boolean @default(false)

  currentVersion  Int @default(1)
  parentTemplateId String?

  approvedById    String?
  approvedAt      DateTime?
  archivedAt      DateTime?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  versions        CommunicationTemplateVersion[]

  @@index([tenantId])
  @@index([category])
  @@index([channel])
  @@index([status])
  @@index([templateType])
  @@index([isSystem])
}
```

---

# 22. Base de données — CommunicationTemplateVersion

```prisma
model CommunicationTemplateVersion {
  id              String @id @default(cuid())
  tenantId        String?

  templateId      String
  versionNumber   Int

  titleFr         String?
  titleEn         String?
  subjectFr       String?
  subjectEn       String?
  bodyFr          String
  bodyEn          String?

  variables       Json?
  settings        Json?
  changeReason    String?
  snapshot        Json?

  createdById     String?
  createdAt       DateTime @default(now())

  template        CommunicationTemplate @relation(fields: [templateId], references: [id])

  @@unique([templateId, versionNumber])
  @@index([tenantId])
  @@index([templateId])
}
```

---

# 23. Enums

```prisma
enum CommunicationTemplateCategory {
  GENERAL
  ADMINISTRATIVE
  FINANCE
  SCHOOLING
  ATTENDANCE
  DISCIPLINE
  EXAMS
  GRADES
  REPORT_CARDS
  PEDAGOGY
  LIBRARY
  EVENT
  MEETING
  SUMMONS
  REMINDER
  EMERGENCY
  HR
  ENROLLMENT
  RE_ENROLLMENT
  PAYMENT
  PORTAL
}

enum CommunicationTemplateType {
  SYSTEM
  SCHOOL
  CUSTOM
  SARA_GENERATED
  IMPORTED
}

enum CommunicationTemplateStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  ACTIVE
  OBSOLETE
  ARCHIVED
}
```

---

# 24. Backend — Routes API

```http
GET    /api/communication/templates
GET    /api/communication/templates/dashboard
POST   /api/communication/templates
GET    /api/communication/templates/:templateId
PATCH  /api/communication/templates/:templateId
POST   /api/communication/templates/:templateId/submit-approval
POST   /api/communication/templates/:templateId/approve
POST   /api/communication/templates/:templateId/reject
POST   /api/communication/templates/:templateId/activate
POST   /api/communication/templates/:templateId/archive
POST   /api/communication/templates/:templateId/duplicate
POST   /api/communication/templates/:templateId/preview
POST   /api/communication/templates/:templateId/validate

GET    /api/communication/templates/:templateId/versions
POST   /api/communication/templates/:templateId/versions
POST   /api/communication/templates/:templateId/versions/:versionId/restore

GET    /api/communication/templates/system
GET    /api/communication/templates/school
GET    /api/communication/templates/orion-alerts
GET    /api/communication/templates/sara-suggestions
```

---

# 25. Backend — Services

Services recommandés :

```txt
CommunicationTemplateService
TemplateDashboardService
TemplateValidationService
TemplateVariableService
TemplatePreviewService
TemplateVersionService
TemplateApprovalService
SystemTemplateService
SchoolTemplateService
TemplateUsageService
TemplateSaraService
TemplateOrionService
TemplateAuditService
```

---

# 26. Sécurité

## Permissions

```txt
COMMUNICATION_TEMPLATES_VIEW
COMMUNICATION_TEMPLATES_CREATE
COMMUNICATION_TEMPLATES_UPDATE
COMMUNICATION_TEMPLATES_APPROVE
COMMUNICATION_TEMPLATES_ACTIVATE
COMMUNICATION_TEMPLATES_ARCHIVE
COMMUNICATION_TEMPLATES_DUPLICATE
COMMUNICATION_TEMPLATES_PREVIEW
COMMUNICATION_TEMPLATES_VALIDATE
COMMUNICATION_TEMPLATES_VERSIONS_VIEW
COMMUNICATION_TEMPLATES_VERSIONS_RESTORE
COMMUNICATION_TEMPLATES_SYSTEM_VIEW
COMMUNICATION_TEMPLATES_SARA_USE
COMMUNICATION_TEMPLATES_ORION_VIEW
COMMUNICATION_TEMPLATES_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session pour modèles école
modèles système protégés
RBAC strict
validation des variables
validation des langues
validation par canal
versioning obligatoire si modèle utilisé
audit complet
suppression logique uniquement
```

---

# 27. Audit

Auditer :

```txt
création modèle
modification modèle
soumission validation
approbation
rejet
activation
archivage
duplication
prévisualisation
validation technique
création version
restauration version
utilisation Sara AI
alerte ORION
accès refusé
```

---

# 28. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 6 — Modèles de messages** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
modèles système plateforme
modèles personnalisés école
RBAC obligatoire
modèles par canal
bilingue FR/EN
variables dynamiques
prévisualisation
validation
versioning
Sara AI en assistance uniquement
ORION Communication
audit complet
```

## À créer côté frontend

```txt
Page /communication/templates
MessageTemplatesPage
TemplateDashboardCards
TemplateList
TemplateCard
TemplateFilters
TemplateSearchBar
TemplateCreateDialog
TemplateEditor
TemplateCategorySelector
TemplateChannelSelector
TemplateLanguageTabs
TemplateVariablePicker
TemplatePreviewPanel
TemplateValidationPanel
TemplateVersionHistory
SystemTemplatesPanel
SchoolTemplatesPanel
TemplateSaraAssistantPanel
TemplateOrionAlertsPanel
TemplateArchivePanel
TemplateAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion modèles système
Gestion modèles école
Validation variables
Prévisualisation
Workflow validation
Versioning
Archivage
Usage tracking
ORION Modèles
Sara AI Assistance
Audit complet
```

## À créer côté BDD

```txt
CommunicationTemplate
CommunicationTemplateVersion
Enums CommunicationTemplateCategory, CommunicationTemplateType, CommunicationTemplateStatus
Relations avec Tenant, User, AuditLog, NotificationRule, Campaign et Announcement si nécessaire
```

---

# 29. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer des modèles de messages
organiser les modèles par catégorie
gérer les modèles par canal
gérer les versions FR/EN
insérer des variables dynamiques
prévisualiser les rendus
valider techniquement les modèles
soumettre à validation
approuver ou rejeter
activer les modèles
versionner les modifications
restaurer une ancienne version
gérer les modèles système
gérer les modèles personnalisés école
archiver les modèles obsolètes
recevoir les alertes ORION
utiliser Sara AI pour améliorer ou traduire
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Modèles de messages** est la bibliothèque de langage professionnel de Academia Helm.

La règle d’or :

```txt
Un bon modèle réduit les erreurs, accélère la communication et protège l’image de l’établissement.
```

Avec cet onglet, l’école ne repart pas de zéro à chaque message. Elle capitalise sur des modèles fiables, adaptés, validés et réutilisables.

La suite logique :

```txt
Onglet 7 — Canaux & Connecteurs
```

---
Très bien. On passe à l’**Onglet 7 — Canaux & Connecteurs**. C’est un onglet critique : sans canaux fiables, les meilleurs messages restent coincés dans les tuyaux. Et un tuyau bouché, même avec une belle interface, reste un tuyau bouché.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 7 — CANAUX & CONNECTEURS

---

# 1. Objectif de l’onglet

L’onglet **Canaux & Connecteurs** permet à chaque établissement de configurer, sécuriser, tester, superviser et piloter les canaux utilisés pour envoyer les communications dans Academia Helm.

Cet onglet centralise les connexions vers :

```txt
le portail interne Academia Helm
l’email
le SMS
WhatsApp
les notifications push
les webhooks/API
les fournisseurs externes
les passerelles de messagerie
les services transactionnels
```

L’objectif est de garantir que les messages, annonces, campagnes et notifications automatiques disposent de canaux fiables, mesurables et contrôlés.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/channels-connectors
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Messages internes
Annonces officielles
Notifications automatiques
Campagnes de communication
Modèles de messages
Paramètres établissement
Utilisateurs & rôles
Portail Parent/Élève
Portail Enseignant
ORION Communication
Sara AI
Audit
Sécurité
Facturation/coûts si applicable
```

---

# 3. Principe général

Un **canal** est un moyen de diffusion.
Un **connecteur** est la configuration technique permettant d’utiliser ce canal.

Exemples :

```txt
canal : SMS
connecteur : fournisseur SMS configuré avec clé API

canal : Email
connecteur : SMTP, Resend, SendGrid, Mailgun ou autre fournisseur

canal : WhatsApp
connecteur : WhatsApp Business API via fournisseur

canal : Push
connecteur : Firebase Cloud Messaging ou équivalent

canal : Webhook
connecteur : endpoint externe sécurisé
```

## Règle métier

```txt
Aucune communication critique ne doit dépendre d’un canal non testé,
non surveillé ou sans fallback.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord des canaux
2. Liste des canaux disponibles
3. Configuration des connecteurs
4. Canal Portail
5. Canal Email
6. Canal SMS
7. Canal WhatsApp
8. Canal Push
9. Canal Webhook/API
10. Fallback & priorités
11. Tests de connecteurs
12. Santé des canaux
13. Coûts & quotas
14. Logs techniques
15. Sécurité des clés
16. Suggestions Sara AI
17. Alertes ORION
18. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/channels-connectors
```

## 5.2 Page principale

```txt
app/(school)/communication/channels-connectors/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/channels-connectors/ChannelsConnectorsPage.tsx
components/communication/channels-connectors/ChannelsDashboardCards.tsx
components/communication/channels-connectors/ChannelList.tsx
components/communication/channels-connectors/ChannelCard.tsx
components/communication/channels-connectors/ConnectorConfigPanel.tsx
components/communication/channels-connectors/PortalChannelSettings.tsx
components/communication/channels-connectors/EmailConnectorSettings.tsx
components/communication/channels-connectors/SmsConnectorSettings.tsx
components/communication/channels-connectors/WhatsAppConnectorSettings.tsx
components/communication/channels-connectors/PushConnectorSettings.tsx
components/communication/channels-connectors/WebhookConnectorSettings.tsx
components/communication/channels-connectors/ChannelFallbackSettings.tsx
components/communication/channels-connectors/ChannelPriorityManager.tsx
components/communication/channels-connectors/ConnectorTestPanel.tsx
components/communication/channels-connectors/ChannelHealthPanel.tsx
components/communication/channels-connectors/ChannelQuotaPanel.tsx
components/communication/channels-connectors/ChannelCostPanel.tsx
components/communication/channels-connectors/ConnectorLogsPanel.tsx
components/communication/channels-connectors/SecretKeyManager.tsx
components/communication/channels-connectors/ChannelSaraAssistantPanel.tsx
components/communication/channels-connectors/ChannelOrionAlertsPanel.tsx
components/communication/channels-connectors/ChannelAuditTimeline.tsx
```

---

# 6. Tableau de bord des canaux

Le tableau de bord doit afficher :

```txt
canaux actifs
canaux désactivés
connecteurs configurés
connecteurs non configurés
taux de livraison par canal
taux d’échec par canal
coût estimé
quotas restants
canaux en erreur
alertes ORION
dernier test effectué
disponibilité globale
```

## KPI recommandés

```txt
disponibilité email
disponibilité SMS
disponibilité WhatsApp
disponibilité push
disponibilité portail
messages envoyés aujourd’hui
échecs aujourd’hui
coût du mois
quota SMS restant
quota WhatsApp restant
webhooks échoués
```

---

# 7. Liste des canaux disponibles

Canaux standards :

```txt
Portail Academia Helm
Email
SMS
WhatsApp
Push mobile/web
Notification interne
Webhook/API
```

Chaque canal doit afficher :

```txt
nom
statut
connecteur associé
fournisseur
priorité
fallback
coût estimé
quota
taux de succès
dernière erreur
dernière vérification
niveau ORION
```

## Statuts possibles

```txt
actif
inactif
non configuré
en test
dégradé
en erreur
suspendu
```

---

# 8. Configuration des connecteurs

Chaque connecteur doit permettre :

```txt
choix du fournisseur
saisie sécurisée des identifiants
configuration API
configuration webhook retour
configuration expéditeur
limites d’envoi
règles de fallback
environnement test/production
test de connexion
activation/désactivation
rotation des clés
historique des modifications
```

## Règles

```txt
les secrets ne doivent jamais être exposés en clair
les clés API doivent être chiffrées
les tests doivent être historisés
un connecteur critique doit avoir un canal de secours
les erreurs fournisseur doivent être journalisées
```

---

# 9. Canal Portail

Le canal **Portail** est le canal natif de Academia Helm.

Il sert à afficher :

```txt
messages internes
annonces
notifications
alertes
campagnes
demandes d’action
confirmations de lecture
```

## Paramètres

```txt
activation portail école
activation portail enseignant
activation portail parent/élève
affichage badge non lu
priorité visuelle
expiration
confirmation de lecture
regroupement des notifications
son/alerte visuelle si applicable
```

## Avantage

```txt
faible coût
traçabilité forte
intégration native
fallback utile si les canaux externes échouent
```

---

# 10. Canal Email

Configuration possible :

```txt
SMTP
fournisseur transactionnel
domaine d’envoi
adresse expéditeur
nom expéditeur
adresse de réponse
signature
DKIM/SPF/DMARC
templates HTML
tracking ouverture si autorisé
tracking clic si autorisé
pièces jointes
limites quotidiennes
```

## Fournisseurs possibles

```txt
SMTP personnalisé
Resend
SendGrid
Mailgun
Amazon SES
Brevo
autre fournisseur
```

## Contrôles

```txt
validation email expéditeur
test DNS
test envoi
détection bounce
gestion désinscription si applicable
logs erreurs
```

---

# 11. Canal SMS

Configuration possible :

```txt
fournisseur SMS
clé API
sender ID
pays autorisés
coût par SMS
quota
limite quotidienne
encodage
longueur maximale
lien court
accusé de livraison
fallback
```

## Fournisseurs possibles

```txt
Twilio
Africa’s Talking
Vonage
Infobip
Orange SMS API
MTN API
Moov API
fournisseur local
```

## Contrôles

```txt
numéro valide
format international
coût estimé
quota suffisant
limitation anti-spam
journalisation livraison/échec
```

---

# 12. Canal WhatsApp

Configuration possible :

```txt
fournisseur WhatsApp Business API
numéro WhatsApp Business
identifiant compte
clé API
templates approuvés
webhooks de statut
bouton/lien
langues
limite d’envoi
fenêtre conversationnelle
fallback SMS ou portail
```

## Fournisseurs possibles

```txt
Meta WhatsApp Business API
Twilio WhatsApp
360dialog
Infobip
Vonage
fournisseur local compatible
```

## Contrôles

```txt
template approuvé
numéro destinataire valide
statut livraison
statut lecture si disponible
conformité fournisseur
logs webhook
coût estimé
```

---

# 13. Canal Push

Configuration possible :

```txt
push web
push mobile
Firebase Cloud Messaging
Apple Push Notification Service si application iOS
clés serveur
topics
groupes
expiration
priorité
deep link
image optionnelle
fallback portail
```

## Contrôles

```txt
token valide
utilisateur connecté
permission push accordée
statut livraison
token expiré
nettoyage automatique des tokens invalides
```

---

# 14. Canal Webhook/API

Le canal **Webhook/API** permet d’envoyer des événements vers des systèmes externes.

## Cas d’usage

```txt
synchronisation CRM
système comptable
plateforme externe
outil d’automatisation
connecteur tiers
reporting
intégration future
```

## Configuration

```txt
URL endpoint
méthode HTTP
headers
secret de signature
payload
événements déclencheurs
retry
timeout
journalisation
activation/désactivation
```

## Sécurité

```txt
signature HMAC
allowlist IP si possible
HTTPS obligatoire
rotation secret
masquage données sensibles
limitation des événements
```

---

# 15. Fallback & priorités

Le système doit permettre de définir une stratégie de fallback.

Exemples :

```txt
WhatsApp puis SMS puis Portail
Email puis Portail
Push puis Portail
SMS puis appel manuel signalé
Webhook puis retry puis alerte ORION
```

## Paramètres

```txt
canal principal
canal secondaire
délai avant fallback
nombre de tentatives
arrêt si livré
arrêt si lu
arrêt si confirmé
priorité par type de message
priorité par audience
priorité par coût
```

## Règle

```txt
Les communications critiques doivent avoir au moins un fallback configuré.
```

---

# 16. Tests de connecteurs

Chaque connecteur doit pouvoir être testé.

## Types de tests

```txt
test de connexion
test d’authentification
test d’envoi
test de livraison
test webhook retour
test fallback
test quota
test coût
test DNS pour email
test template WhatsApp
test push token
```

## Résultat du test

```txt
succès
échec
temps de réponse
code erreur
message fournisseur
recommandation
date
utilisateur ayant lancé le test
```

---

# 17. Santé des canaux

Le système doit surveiller :

```txt
disponibilité
latence
taux d’échec
taux de livraison
erreurs fournisseur
quota restant
coût anormal
webhooks non reçus
tokens invalides
templates WhatsApp rejetés
domaine email mal configuré
```

## Niveaux de santé

```txt
sain
attention
dégradé
critique
indisponible
```

---

# 18. Coûts & quotas

Le système doit permettre de suivre :

```txt
coût SMS
coût WhatsApp
coût email si fournisseur payant
coût push généralement nul
coût par campagne
coût par notification
coût par période
quota restant
seuil d’alerte
blocage si quota dépassé
estimation avant lancement
```

## Paramètres

```txt
devise
coût par unité
budget mensuel
seuil d’alerte
limite quotidienne
limite par campagne
approbation si coût élevé
```

---

# 19. Logs techniques

Les logs doivent afficher :

```txt
canal
connecteur
fournisseur
événement
payload masqué
statut
code réponse
message erreur
temps de réponse
tentative
date
utilisateur/action source
entité métier liée
```

## Types de logs

```txt
configuration
test
envoi
livraison
échec
webhook reçu
retry
fallback
quota
sécurité
```

---

# 20. Sécurité des clés

Exigences :

```txt
chiffrement des clés API
masquage dans l’interface
accès limité par permission
rotation des clés
révocation
audit accès
séparation test/production
aucune clé dans les logs
aucune clé côté client
stockage sécurisé côté serveur
```

## Règle

```txt
Une clé API ne doit jamais transiter vers le frontend en clair.
```

---

# 21. Suggestions Sara AI

Sara AI peut aider à :

```txt
recommander le meilleur canal selon l’audience
expliquer une erreur fournisseur
proposer une stratégie de fallback
optimiser un message selon canal
réduire un SMS trop long
adapter un message WhatsApp
générer un résumé d’incident
proposer des actions correctives
```

## Règle

```txt
Sara AI ne doit jamais afficher ni manipuler les clés secrètes.
```

---

# 22. Alertes ORION

ORION doit détecter :

```txt
connecteur non configuré
canal critique désactivé
canal en échec massif
taux d’échec élevé
quota faible
quota dépassé
coût anormal
fallback absent
clé expirée
webhook en échec
domaine email non vérifié
template WhatsApp rejeté
push tokens invalides en masse
latence fournisseur élevée
tentative d’accès non autorisée
```

Chaque alerte doit contenir :

```txt
niveau
canal
connecteur
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Canaux — Fallback absent

Le canal WhatsApp est utilisé pour des communications critiques,
mais aucun canal de secours n’est configuré.
Impact possible : les familles ne recevront pas les messages en cas d’échec WhatsApp.
Action recommandée : configurer SMS ou Portail comme fallback.
```

---

# 23. Base de données — CommunicationChannel

```prisma
model CommunicationChannel {
  id              String @id @default(cuid())
  tenantId        String

  channelType     CommunicationChannelType
  name            String
  description     String?

  status          CommunicationChannelStatus @default(NOT_CONFIGURED)
  priority        Int @default(1)

  isDefault       Boolean @default(false)
  isCritical      Boolean @default(false)

  settings        Json?
  fallbackRules   Json?
  quotaSettings   Json?
  costSettings    Json?

  lastHealthStatus ChannelHealthStatus?
  lastCheckedAt   DateTime?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  connectors      CommunicationConnector[]

  @@index([tenantId])
  @@index([channelType])
  @@index([status])
}
```

---

# 24. Base de données — CommunicationConnector

```prisma
model CommunicationConnector {
  id              String @id @default(cuid())
  tenantId        String

  channelId       String
  provider        String
  environment     ConnectorEnvironment @default(PRODUCTION)

  status          ConnectorStatus @default(INACTIVE)

  publicConfig    Json?
  encryptedSecrets Json?
  webhookConfig   Json?
  limits          Json?
  metadata        Json?

  lastTestAt      DateTime?
  lastSuccessAt   DateTime?
  lastFailureAt   DateTime?
  lastErrorCode   String?
  lastErrorMessage String?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  channel         CommunicationChannel @relation(fields: [channelId], references: [id])

  @@index([tenantId])
  @@index([channelId])
  @@index([provider])
  @@index([status])
}
```

---

# 25. Base de données — CommunicationConnectorLog

```prisma
model CommunicationConnectorLog {
  id              String @id @default(cuid())
  tenantId        String

  channelType     CommunicationChannelType
  connectorId     String?

  eventType       ConnectorLogEventType
  status          ConnectorLogStatus

  provider        String?
  requestPayload  Json?
  responsePayload Json?

  httpStatus      Int?
  errorCode       String?
  errorMessage    String?
  durationMs      Int?

  linkedEntityType String?
  linkedEntityId   String?

  createdById     String?
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([connectorId])
  @@index([channelType])
  @@index([eventType])
  @@index([status])
  @@index([createdAt])
}
```

---

# 26. Enums

```prisma
enum CommunicationChannelStatus {
  ACTIVE
  INACTIVE
  NOT_CONFIGURED
  TESTING
  DEGRADED
  ERROR
  SUSPENDED
}

enum ConnectorStatus {
  ACTIVE
  INACTIVE
  TESTING
  ERROR
  EXPIRED
  SUSPENDED
}

enum ConnectorEnvironment {
  TEST
  PRODUCTION
}

enum ChannelHealthStatus {
  HEALTHY
  WARNING
  DEGRADED
  CRITICAL
  UNAVAILABLE
}

enum ConnectorLogEventType {
  CONFIGURATION
  TEST
  SEND
  DELIVERY
  FAILURE
  WEBHOOK_RECEIVED
  RETRY
  FALLBACK
  QUOTA
  SECURITY
}

enum ConnectorLogStatus {
  SUCCESS
  FAILED
  PENDING
  BLOCKED
  WARNING
}
```

---

# 27. Backend — Routes API

```http
GET    /api/communication/channels-connectors
GET    /api/communication/channels-connectors/dashboard

GET    /api/communication/channels
POST   /api/communication/channels
GET    /api/communication/channels/:channelId
PATCH  /api/communication/channels/:channelId
POST   /api/communication/channels/:channelId/activate
POST   /api/communication/channels/:channelId/deactivate
POST   /api/communication/channels/:channelId/check-health

GET    /api/communication/connectors
POST   /api/communication/connectors
GET    /api/communication/connectors/:connectorId
PATCH  /api/communication/connectors/:connectorId
POST   /api/communication/connectors/:connectorId/test
POST   /api/communication/connectors/:connectorId/rotate-secret
POST   /api/communication/connectors/:connectorId/revoke
POST   /api/communication/connectors/:connectorId/activate
POST   /api/communication/connectors/:connectorId/deactivate

GET    /api/communication/connectors/logs
GET    /api/communication/channels-connectors/health
GET    /api/communication/channels-connectors/quotas
GET    /api/communication/channels-connectors/costs
GET    /api/communication/channels-connectors/orion-alerts
GET    /api/communication/channels-connectors/sara-suggestions
```

---

# 28. Backend — Services

Services recommandés :

```txt
CommunicationChannelService
CommunicationConnectorService
ChannelDashboardService
ConnectorSecretService
ConnectorEncryptionService
ConnectorTestService
ChannelHealthService
ChannelFallbackService
ChannelQuotaService
ChannelCostService
ConnectorLogService
EmailConnectorService
SmsConnectorService
WhatsAppConnectorService
PushConnectorService
WebhookConnectorService
ChannelSaraService
ChannelOrionService
ChannelAuditService
```

---

# 29. Sécurité

## Permissions

```txt
COMMUNICATION_CHANNELS_VIEW
COMMUNICATION_CHANNELS_CREATE
COMMUNICATION_CHANNELS_UPDATE
COMMUNICATION_CHANNELS_ACTIVATE
COMMUNICATION_CHANNELS_DEACTIVATE
COMMUNICATION_CHANNELS_HEALTH_VIEW
COMMUNICATION_CONNECTORS_VIEW
COMMUNICATION_CONNECTORS_CREATE
COMMUNICATION_CONNECTORS_UPDATE
COMMUNICATION_CONNECTORS_TEST
COMMUNICATION_CONNECTORS_SECRET_ROTATE
COMMUNICATION_CONNECTORS_REVOKE
COMMUNICATION_CONNECTORS_LOGS_VIEW
COMMUNICATION_CHANNELS_COSTS_VIEW
COMMUNICATION_CHANNELS_QUOTAS_VIEW
COMMUNICATION_CHANNELS_SARA_USE
COMMUNICATION_CHANNELS_ORION_VIEW
COMMUNICATION_CHANNELS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
secrets chiffrés
secrets jamais renvoyés au frontend
masquage des payloads sensibles
HTTPS obligatoire pour webhooks
validation des fournisseurs
audit complet
séparation test/production
rotation des clés
limitation des tests
```

---

# 30. Audit

Auditer :

```txt
création canal
modification canal
activation/désactivation canal
création connecteur
modification connecteur
test connecteur
activation/désactivation connecteur
rotation clé
révocation clé
consultation logs
modification fallback
modification quotas
modification coûts
alerte ORION
utilisation Sara AI
accès refusé
```

---

# 31. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 7 — Canaux & Connecteurs** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
canaux multicanaux
connecteurs configurables
secrets chiffrés
aucune clé côté frontend
tests de connecteurs
santé des canaux
quotas
coûts
fallback
logs techniques
ORION Communication
Sara AI sans accès aux secrets
audit complet
```

## À créer côté frontend

```txt
Page /communication/channels-connectors
ChannelsConnectorsPage
ChannelsDashboardCards
ChannelList
ChannelCard
ConnectorConfigPanel
PortalChannelSettings
EmailConnectorSettings
SmsConnectorSettings
WhatsAppConnectorSettings
PushConnectorSettings
WebhookConnectorSettings
ChannelFallbackSettings
ChannelPriorityManager
ConnectorTestPanel
ChannelHealthPanel
ChannelQuotaPanel
ChannelCostPanel
ConnectorLogsPanel
SecretKeyManager
ChannelSaraAssistantPanel
ChannelOrionAlertsPanel
ChannelAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion canaux
Gestion connecteurs
Chiffrement secrets
Tests connecteurs
Health checks
Fallback
Quotas
Coûts
Logs techniques
ORION Canaux
Sara AI Assistance sans secrets
Audit complet
```

## À créer côté BDD

```txt
CommunicationChannel
CommunicationConnector
CommunicationConnectorLog
Enums CommunicationChannelStatus, ConnectorStatus, ConnectorEnvironment,
ChannelHealthStatus, ConnectorLogEventType, ConnectorLogStatus
Relations avec Tenant, User, AuditLog, NotificationLog et CampaignDelivery si nécessaire
```

---

# 32. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
configurer les canaux de communication
ajouter des connecteurs externes
sécuriser les clés API
tester les connecteurs
activer/désactiver les canaux
surveiller la santé des canaux
gérer les quotas
suivre les coûts
définir les priorités
configurer les fallbacks
consulter les logs techniques
recevoir les alertes ORION
utiliser Sara AI pour analyser et recommander
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Canaux & Connecteurs** est l’infrastructure de diffusion du module Communication.

La règle d’or :

```txt
Un message important n’est fiable que si son canal de diffusion l’est aussi.
```

Avec cet onglet, Academia Helm donne aux établissements un contrôle professionnel sur leurs moyens de communication : configuration, sécurité, supervision, coûts, quotas, fallback et audit.

La suite logique :

```txt
Onglet 8 — Historique & Traçabilité
```

---

Très bien. On passe à l’**Onglet 8 — Historique & Traçabilité**. Celui-ci est capital : quand un parent dit *“je n’ai jamais reçu le message”*, l’école ne doit pas répondre au hasard. Elle doit pouvoir vérifier, preuve à l’appui.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 8 — HISTORIQUE & TRAÇABILITÉ

---

# 1. Objectif de l’onglet

L’onglet **Historique & Traçabilité** permet de centraliser, consulter, filtrer, auditer et exporter l’ensemble des événements liés aux communications dans Academia Helm.

Il répond à une question simple mais fondamentale :

```txt
Qui a envoyé quoi, à qui, quand, par quel canal, avec quel résultat, et depuis quelle source ?
```

Cet onglet doit permettre à l’établissement de retrouver rapidement :

```txt
un message envoyé
une annonce publiée
une notification automatique déclenchée
une campagne exécutée
une relance effectuée
un échec d’envoi
une confirmation de lecture
une action utilisateur
une anomalie ORION
une intervention Sara AI
une modification sensible
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/history-traceability
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Messages internes
Annonces officielles
Notifications automatiques
Campagnes de communication
Modèles de messages
Canaux & Connecteurs
Portail Parent/Élève
Portail Enseignant
Utilisateurs & rôles
Audit global
ORION Communication
Sara AI
Sécurité
Exports
```

---

# 3. Principe général

L’historique ne doit pas être un simple journal technique.

Il doit combiner :

```txt
traçabilité métier
traçabilité technique
traçabilité utilisateur
traçabilité de livraison
traçabilité de lecture
traçabilité d’échec
traçabilité d’audit
```

## Règle métier

```txt
Toute communication sensible doit laisser une trace exploitable, consultable et exportable.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord historique
2. Journal global des communications
3. Filtres avancés
4. Détail d’un événement
5. Historique par destinataire
6. Historique par élève
7. Historique par parent
8. Historique par enseignant
9. Historique par canal
10. Historique par module source
11. Suivi livraison/lecture
12. Échecs & tentatives
13. Traçabilité des campagnes
14. Traçabilité des notifications automatiques
15. Traçabilité Sara AI
16. Alertes ORION
17. Exports
18. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/history-traceability
```

## 5.2 Page principale

```txt
app/(school)/communication/history-traceability/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/history-traceability/CommunicationHistoryPage.tsx
components/communication/history-traceability/HistoryDashboardCards.tsx
components/communication/history-traceability/CommunicationTimeline.tsx
components/communication/history-traceability/CommunicationHistoryTable.tsx
components/communication/history-traceability/HistoryFilters.tsx
components/communication/history-traceability/HistorySearchBar.tsx
components/communication/history-traceability/HistoryEventDetailsDrawer.tsx
components/communication/history-traceability/RecipientHistoryPanel.tsx
components/communication/history-traceability/StudentCommunicationHistoryPanel.tsx
components/communication/history-traceability/ParentCommunicationHistoryPanel.tsx
components/communication/history-traceability/TeacherCommunicationHistoryPanel.tsx
components/communication/history-traceability/ChannelHistoryPanel.tsx
components/communication/history-traceability/SourceModuleHistoryPanel.tsx
components/communication/history-traceability/DeliveryTrackingPanel.tsx
components/communication/history-traceability/FailureAttemptsPanel.tsx
components/communication/history-traceability/CampaignTraceabilityPanel.tsx
components/communication/history-traceability/AutomaticNotificationTracePanel.tsx
components/communication/history-traceability/SaraTraceabilityPanel.tsx
components/communication/history-traceability/OrionHistoryAlertsPanel.tsx
components/communication/history-traceability/HistoryExportPanel.tsx
components/communication/history-traceability/HistoryAuditTimeline.tsx
```

---

# 6. Tableau de bord historique

Le tableau de bord doit afficher :

```txt
communications envoyées aujourd’hui
communications envoyées ce mois
communications livrées
communications lues
communications confirmées
communications échouées
relances effectuées
canaux les plus utilisés
modules les plus actifs
destinataires les plus sollicités
alertes ORION
incidents récents
```

## KPI recommandés

```txt
total événements
taux de livraison
taux de lecture
taux d’échec
taux de confirmation
délai moyen de livraison
nombre de retries
nombre de fallbacks
volume par canal
volume par module
événements critiques
```

---

# 7. Journal global des communications

Le journal global doit afficher chaque événement avec :

```txt
date/heure
type d’événement
source
module source
canal
expéditeur
destinataire
objet/titre
statut
priorité
campagne liée
notification liée
modèle utilisé
résultat
action possible
```

## Types d’événements

```txt
message interne envoyé
annonce publiée
notification automatique déclenchée
campagne lancée
campagne planifiée
campagne terminée
relance envoyée
email envoyé
SMS envoyé
WhatsApp envoyé
push envoyé
message portail publié
lecture confirmée
accusé de réception
échec d’envoi
retry
fallback
webhook reçu
modèle utilisé
Sara AI utilisée
alerte ORION générée
action administrative
```

---

# 8. Filtres avancés

Filtres nécessaires :

```txt
période
type d’événement
module source
canal
statut
priorité
expéditeur
destinataire
classe
niveau
cycle
élève
parent
enseignant
campagne
notification automatique
modèle
connecteur
fournisseur
erreur
ORION
Sara AI
confirmation requise
lu/non lu
livré/non livré
échec/retry/fallback
```

## Recherche libre

```txt
nom destinataire
matricule élève
téléphone
email
objet
contenu partiel autorisé
identifiant message
identifiant fournisseur
campagne
erreur
```

---

# 9. Détail d’un événement

Le détail d’un événement doit afficher :

```txt
identifiant interne
tenant
date
source
module source
type
canal
connecteur
fournisseur
expéditeur
destinataire
contenu ou résumé
modèle utilisé
variables rendues
statut
priorité
timestamps
tentative
fallback
coût estimé
erreur éventuelle
payload masqué
réponse fournisseur
lien entité métier
audit associé
```

## Actions possibles

```txt
consulter destinataire
consulter campagne
consulter notification
consulter modèle
relancer si autorisé
exporter
signaler anomalie
ouvrir audit
```

---

# 10. Historique par destinataire

Le système doit permettre de consulter l’historique complet d’un destinataire :

```txt
parent
élève
enseignant
personnel
utilisateur interne
groupe
```

Données affichées :

```txt
messages reçus
annonces vues
notifications reçues
campagnes reçues
lectures
confirmations
échecs
canaux utilisés
fréquence de sollicitation
préférences
dernier contact réussi
dernier échec
```

## Objectif

```txt
Éviter de sursolliciter un parent ou de perdre une trace importante.
```

---

# 11. Historique par élève

Pour un élève, afficher :

```txt
communications liées à sa scolarité
absences
retards
discipline
notes
examens
bulletins
paiements
documents
convocations
réunions
campagnes reçues par ses parents
confirmations parentales
historique des relances
```

Cet historique doit être accessible depuis la fiche élève si permission autorisée.

---

# 12. Historique par parent

Pour un parent, afficher :

```txt
enfants concernés
messages reçus
annonces reçues
notifications financières
notifications pédagogiques
convocations
confirmations
paiements liés
canaux valides
canaux échoués
dernier message lu
dernier message non lu
```

---

# 13. Historique par enseignant

Pour un enseignant, afficher :

```txt
messages internes reçus/envoyés
annonces reçues
notifications pédagogiques
notifications administratives
communications avec direction
communications liées aux classes
campagnes internes
confirmations
alertes
```

---

# 14. Historique par canal

Le système doit permettre d’analyser :

```txt
volume email
volume SMS
volume WhatsApp
volume push
volume portail
volume webhook
taux de succès par canal
taux d’échec
coût
latence
retries
fallbacks
```

## Objectif

```txt
Identifier les canaux les plus fiables et les plus coûteux.
```

---

# 15. Historique par module source

Modules sources possibles :

```txt
Élèves & Scolarité
Finance & Scolarité
Examens, Notes & Bulletins
Présence & Discipline
Pédagogie
Bibliothèque virtuelle
Enseignants & RH
Administration
Paramètres
Portail
Communication
ORION
Sara AI
```

Chaque module doit afficher :

```txt
événements générés
notifications automatiques
campagnes liées
taux de succès
anomalies
volumes
```

---

# 16. Suivi livraison/lecture

Le suivi doit afficher :

```txt
envoyé
livré
lu
confirmé
cliqué
répondu
échoué
expiré
bloqué
relancé
```

## Timestamps

```txt
createdAt
queuedAt
sentAt
deliveredAt
readAt
acknowledgedAt
clickedAt
failedAt
retriedAt
fallbackAt
```

---

# 17. Échecs & tentatives

Pour chaque échec :

```txt
canal
fournisseur
code erreur
message erreur
tentative
date
destinataire
cause probable
action recommandée
fallback utilisé
retry disponible
statut final
```

## Types d’échecs

```txt
contact invalide
canal indisponible
quota dépassé
clé expirée
template invalide
fournisseur indisponible
délai expiré
permission refusée
variable manquante
destinataire désactivé
```

---

# 18. Traçabilité des campagnes

Pour chaque campagne :

```txt
création
validation
planification
lancement
destinataires générés
messages envoyés
livraisons
lectures
confirmations
relances
retries
fallbacks
statistiques
archivage
export
```

---

# 19. Traçabilité des notifications automatiques

Pour chaque notification automatique :

```txt
règle déclencheuse
événement métier
module source
modèle utilisé
destinataire
canal
statut
condition évaluée
résultat
erreur éventuelle
```

Exemples :

```txt
absence élève
paiement reçu
paiement en retard
note publiée
bulletin disponible
devoir publié
document manquant
convocation
```

---

# 20. Traçabilité Sara AI

Toute intervention Sara AI doit être traçable :

```txt
suggestion de message
reformulation
traduction
résumé
recommandation
analyse d’erreur
aide à campagne
aide à modèle
```

Données à tracer :

```txt
utilisateur demandeur
contexte
type d’assistance
résultat accepté ou rejeté
date
module concerné
entité liée
```

## Règle

```txt
Sara AI ne doit pas produire une action critique sans validation humaine.
```

---

# 21. Alertes ORION

ORION doit détecter :

```txt
hausse anormale d’échecs
parent trop sollicité
campagne envoyée sans lecture significative
canal dégradé
notification critique non livrée
message urgent non lu
relances excessives
modèle générant trop d’échecs
fournisseur instable
absence de trace attendue
incohérence entre campagne et livraisons
tentative d’accès non autorisée
export massif suspect
```

Chaque alerte doit contenir :

```txt
niveau
événement
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Historique — Parent trop sollicité

Le parent de l’élève A. a reçu 14 communications en 48 heures.
Impact possible : fatigue informationnelle et baisse du taux de lecture.
Action recommandée : regrouper les communications non urgentes.
```

---

# 22. Exports

Formats possibles :

```txt
Excel
CSV
PDF
JSON si autorisé
```

Exports disponibles :

```txt
historique global
historique par campagne
historique par destinataire
historique par élève
historique par parent
historique par canal
historique des échecs
historique ORION
historique Sara AI
rapport de livraison
rapport d’audit
```

## Règles

```txt
export soumis à permission
export historisé
masquage des données sensibles selon rôle
limitation de volume
génération asynchrone si gros volume
expiration du lien de téléchargement
```

---

# 23. Base de données — CommunicationHistoryEvent

```prisma
model CommunicationHistoryEvent {
  id              String @id @default(cuid())
  tenantId        String

  eventType       CommunicationHistoryEventType
  sourceModule    NotificationSourceModule?
  sourceEntityType String?
  sourceEntityId   String?

  channel         CommunicationChannelType?
  connectorId     String?
  provider        String?

  senderType      CommunicationActorType?
  senderId        String?
  recipientType   CommunicationRecipientType?
  recipientId     String?
  recipientUserId String?

  title           String?
  summary         String?
  contentSnapshot Json?
  templateId      String?
  campaignId      String?
  notificationRuleId String?

  status          CommunicationHistoryStatus
  priority        CommunicationPriority @default(NORMAL)

  providerMessageId String?
  attemptCount    Int @default(0)
  fallbackUsed    Boolean @default(false)

  queuedAt        DateTime?
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  acknowledgedAt  DateTime?
  clickedAt       DateTime?
  failedAt        DateTime?
  retriedAt       DateTime?
  fallbackAt      DateTime?

  errorCode       String?
  errorMessage    String?
  technicalDetails Json?
  costEstimate    Decimal? @db.Decimal(12, 4)

  createdById     String?
  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([eventType])
  @@index([sourceModule])
  @@index([channel])
  @@index([status])
  @@index([recipientType, recipientId])
  @@index([campaignId])
  @@index([templateId])
  @@index([createdAt])
}
```

---

# 24. Base de données — CommunicationTraceLink

```prisma
model CommunicationTraceLink {
  id              String @id @default(cuid())
  tenantId        String

  historyEventId  String
  linkedEntityType String
  linkedEntityId   String
  relationType    String

  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([historyEventId])
  @@index([linkedEntityType, linkedEntityId])
}
```

---

# 25. Enums

```prisma
enum CommunicationHistoryEventType {
  INTERNAL_MESSAGE_SENT
  ANNOUNCEMENT_PUBLISHED
  AUTOMATIC_NOTIFICATION_TRIGGERED
  CAMPAIGN_CREATED
  CAMPAIGN_SCHEDULED
  CAMPAIGN_LAUNCHED
  CAMPAIGN_COMPLETED
  REMINDER_SENT
  EMAIL_SENT
  SMS_SENT
  WHATSAPP_SENT
  PUSH_SENT
  PORTAL_MESSAGE_PUBLISHED
  READ_CONFIRMED
  ACKNOWLEDGEMENT_RECEIVED
  SEND_FAILED
  RETRY_ATTEMPTED
  FALLBACK_USED
  WEBHOOK_RECEIVED
  TEMPLATE_USED
  SARA_AI_USED
  ORION_ALERT_GENERATED
  ADMIN_ACTION
}

enum CommunicationHistoryStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  ACKNOWLEDGED
  CLICKED
  REPLIED
  FAILED
  EXPIRED
  BLOCKED
  RETRIED
  FALLBACK
  CANCELLED
}
```

---

# 26. Backend — Routes API

```http
GET    /api/communication/history-traceability
GET    /api/communication/history-traceability/dashboard
GET    /api/communication/history-traceability/events
GET    /api/communication/history-traceability/events/:eventId

GET    /api/communication/history-traceability/recipient/:recipientType/:recipientId
GET    /api/communication/history-traceability/student/:studentId
GET    /api/communication/history-traceability/parent/:parentId
GET    /api/communication/history-traceability/teacher/:teacherId

GET    /api/communication/history-traceability/channel/:channelType
GET    /api/communication/history-traceability/source-module/:sourceModule
GET    /api/communication/history-traceability/campaign/:campaignId
GET    /api/communication/history-traceability/notification-rule/:ruleId
GET    /api/communication/history-traceability/failures
GET    /api/communication/history-traceability/orion-alerts
GET    /api/communication/history-traceability/sara-traces

POST   /api/communication/history-traceability/events/:eventId/retry
POST   /api/communication/history-traceability/export
```

---

# 27. Backend — Services

Services recommandés :

```txt
CommunicationHistoryService
CommunicationTraceabilityService
HistoryDashboardService
HistoryFilterService
HistoryEventDetailsService
RecipientHistoryService
StudentCommunicationHistoryService
ParentCommunicationHistoryService
TeacherCommunicationHistoryService
ChannelHistoryService
SourceModuleHistoryService
DeliveryTrackingHistoryService
FailureHistoryService
CampaignTraceabilityService
AutomaticNotificationTraceService
SaraTraceabilityService
OrionHistoryService
HistoryExportService
HistoryAuditService
```

---

# 28. Sécurité

## Permissions

```txt
COMMUNICATION_HISTORY_VIEW
COMMUNICATION_HISTORY_EVENT_VIEW
COMMUNICATION_HISTORY_RECIPIENT_VIEW
COMMUNICATION_HISTORY_STUDENT_VIEW
COMMUNICATION_HISTORY_PARENT_VIEW
COMMUNICATION_HISTORY_TEACHER_VIEW
COMMUNICATION_HISTORY_CHANNEL_VIEW
COMMUNICATION_HISTORY_SOURCE_MODULE_VIEW
COMMUNICATION_HISTORY_FAILURES_VIEW
COMMUNICATION_HISTORY_RETRY
COMMUNICATION_HISTORY_EXPORT
COMMUNICATION_HISTORY_SARA_VIEW
COMMUNICATION_HISTORY_ORION_VIEW
COMMUNICATION_HISTORY_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
masquage données sensibles selon rôle
pas de payload complet pour rôles non autorisés
export contrôlé
logs immuables autant que possible
retry soumis à permission
audit complet des consultations sensibles
```

---

# 29. Audit

Auditer :

```txt
consultation historique global
consultation événement
consultation historique élève
consultation historique parent
consultation historique enseignant
consultation historique campagne
consultation historique échecs
export
retry
accès refusé
consultation Sara AI
consultation ORION
filtre sensible utilisé
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 8 — Historique & Traçabilité** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
historique métier + technique
traçabilité livraison/lecture/confirmation
recherche avancée
filtres puissants
export contrôlé
retry autorisé selon permission
masquage données sensibles
ORION Communication
Sara AI traçable
audit complet
```

## À créer côté frontend

```txt
Page /communication/history-traceability
CommunicationHistoryPage
HistoryDashboardCards
CommunicationTimeline
CommunicationHistoryTable
HistoryFilters
HistorySearchBar
HistoryEventDetailsDrawer
RecipientHistoryPanel
StudentCommunicationHistoryPanel
ParentCommunicationHistoryPanel
TeacherCommunicationHistoryPanel
ChannelHistoryPanel
SourceModuleHistoryPanel
DeliveryTrackingPanel
FailureAttemptsPanel
CampaignTraceabilityPanel
AutomaticNotificationTracePanel
SaraTraceabilityPanel
OrionHistoryAlertsPanel
HistoryExportPanel
HistoryAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Journal global
Filtres avancés
Historique par destinataire
Historique par élève
Historique par parent
Historique par enseignant
Historique par canal
Historique par module source
Suivi livraison/lecture/confirmation
Gestion échecs/retry/fallback
Traçabilité campagnes
Traçabilité notifications automatiques
Traçabilité Sara AI
ORION Historique
Exports
Audit complet
```

## À créer côté BDD

```txt
CommunicationHistoryEvent
CommunicationTraceLink
Enums CommunicationHistoryEventType, CommunicationHistoryStatus
Relations avec Tenant, User, Campaign, Template, NotificationRule, Student, Parent, Teacher si nécessaire
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
consulter l’historique global
filtrer les communications
rechercher un événement
voir le détail d’un message
suivre livraison/lecture/confirmation
retracer une campagne
retracer une notification automatique
retracer les échecs
relancer un envoi si autorisé
consulter l’historique d’un élève
consulter l’historique d’un parent
consulter l’historique d’un enseignant
analyser les canaux
analyser les modules sources
exporter les rapports
voir les alertes ORION
tracer les interventions Sara AI
auditer les consultations sensibles
```

---

# Conclusion

L’onglet **Historique & Traçabilité** est la mémoire opérationnelle du module Communication.

La règle d’or :

```txt
Ce qui n’est pas traçable devient difficile à prouver, difficile à corriger et difficile à améliorer.
```

Avec cet onglet, Academia Helm permet à l’établissement de passer d’une communication approximative à une communication gouvernée, vérifiable et pilotable.

La suite logique :

```txt
Onglet 9 — Préférences & Consentements
```

---

Parfait. On passe à l’**Onglet 9 — Préférences & Consentements**. Cet onglet est très important, parce qu’une bonne communication scolaire ne consiste pas seulement à envoyer des messages. Il faut aussi respecter **qui veut recevoir quoi, par quel canal, dans quelle langue, à quelle fréquence, et avec quelle autorisation**.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 9 — PRÉFÉRENCES & CONSENTEMENTS

---

# 1. Objectif de l’onglet

L’onglet **Préférences & Consentements** permet de gérer les choix de communication des utilisateurs et les autorisations liées à la réception des messages.

Il répond à une exigence essentielle :

```txt
communiquer efficacement sans imposer, spammer ou violer les préférences déclarées.
```

Cet onglet permet à l’établissement de gérer :

```txt
les préférences de canal
les préférences de langue
les préférences de fréquence
les consentements parentaux
les autorisations de notification
les refus de communication non critique
les exceptions pour messages obligatoires
l’historique des changements
la conformité interne
les alertes ORION
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/preferences-consents
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Élèves & Scolarité
Parents/Tuteurs
Portail Parent/Élève
Portail Enseignant
Messages internes
Annonces officielles
Notifications automatiques
Campagnes de communication
Canaux & Connecteurs
Historique & Traçabilité
Paramètres établissement
Utilisateurs & rôles
ORION Communication
Sara AI
Audit
```

---

# 3. Principe général

Chaque destinataire peut avoir des préférences de communication.

Ces préférences doivent influencer :

```txt
le canal utilisé
la langue du message
la fréquence d’envoi
les types de messages autorisés
les messages non autorisés
les notifications push
les communications marketing ou non essentielles
les rappels
les confirmations de lecture
```

## Règle métier

```txt
Les communications critiques ou légalement nécessaires peuvent contourner certaines préférences,
mais doivent être clairement classées et tracées.
```

Autrement dit : un parent peut refuser les campagnes non essentielles, mais il ne doit pas pouvoir bloquer une alerte urgente de sécurité. La liberté de préférence ne doit pas devenir un trou noir opérationnel.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord préférences
2. Liste des profils de communication
3. Préférences par parent
4. Préférences par élève
5. Préférences par enseignant
6. Préférences par canal
7. Préférences par type de message
8. Consentements parentaux
9. Gestion des refus
10. Exceptions messages critiques
11. Langues & bilingue
12. Fréquence & plages horaires
13. Historique des changements
14. Synchronisation portail
15. Alertes ORION
16. Suggestions Sara AI
17. Exports
18. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/preferences-consents
```

## 5.2 Page principale

```txt
app/(school)/communication/preferences-consents/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/preferences-consents/PreferencesConsentsPage.tsx
components/communication/preferences-consents/PreferencesDashboardCards.tsx
components/communication/preferences-consents/CommunicationProfileList.tsx
components/communication/preferences-consents/CommunicationProfileCard.tsx
components/communication/preferences-consents/PreferenceFilters.tsx
components/communication/preferences-consents/PreferenceSearchBar.tsx
components/communication/preferences-consents/ParentPreferencesPanel.tsx
components/communication/preferences-consents/StudentPreferencesPanel.tsx
components/communication/preferences-consents/TeacherPreferencesPanel.tsx
components/communication/preferences-consents/ChannelPreferencesPanel.tsx
components/communication/preferences-consents/MessageTypePreferencesPanel.tsx
components/communication/preferences-consents/ParentalConsentPanel.tsx
components/communication/preferences-consents/OptOutManagementPanel.tsx
components/communication/preferences-consents/CriticalMessageExceptionsPanel.tsx
components/communication/preferences-consents/LanguagePreferencePanel.tsx
components/communication/preferences-consents/FrequencyQuietHoursPanel.tsx
components/communication/preferences-consents/PreferenceHistoryTimeline.tsx
components/communication/preferences-consents/PortalSyncStatusPanel.tsx
components/communication/preferences-consents/PreferenceOrionAlertsPanel.tsx
components/communication/preferences-consents/PreferenceSaraAssistantPanel.tsx
components/communication/preferences-consents/PreferenceExportPanel.tsx
components/communication/preferences-consents/PreferenceAuditTimeline.tsx
```

---

# 6. Tableau de bord préférences

Le tableau de bord doit afficher :

```txt
profils de communication actifs
profils incomplets
parents sans canal valide
élèves sans contact parent valide
enseignants sans préférence configurée
consentements en attente
consentements expirés
refus actifs
préférences bilingues
notifications push autorisées
notifications push refusées
alertes ORION
```

## KPI recommandés

```txt
taux de profils complets
taux de consentements validés
taux de refus non critiques
nombre de contacts non joignables
canaux préférés dominants
langues préférées
taux de préférences modifiées ce mois
exceptions critiques utilisées
```

---

# 7. Profils de communication

Un profil de communication représente les préférences d’un destinataire.

## Types de profils

```txt
parent
élève
enseignant
personnel administratif
direction
groupe
classe
établissement
```

Chaque profil doit contenir :

```txt
identité
rôle
contacts
canal principal
canal secondaire
langue préférée
types de messages acceptés
types de messages refusés
horaires préférés
consentements
statut
dernière mise à jour
source de mise à jour
```

## Statuts possibles

```txt
complet
incomplet
à vérifier
non joignable
refus partiel
refus total non critique
bloqué
archivé
```

---

# 8. Préférences par parent

Pour chaque parent/tuteur, gérer :

```txt
canal principal
canal secondaire
email autorisé
SMS autorisé
WhatsApp autorisé
push autorisé
portail autorisé
langue préférée
enfants concernés
types de messages acceptés
types de messages refusés
plage horaire préférée
consentements signés
historique de validation
```

## Types de messages parentaux

```txt
administratif
financier
pédagogique
absence
retard
discipline
examen
bulletin
convocation
événement
urgence
campagne générale
```

## Règle

```txt
Un parent ne doit pas pouvoir refuser les communications critiques liées à la sécurité,
à l’urgence ou aux obligations scolaires essentielles.
```

---

# 9. Préférences par élève

Pour les élèves, les préférences doivent dépendre de :

```txt
l’âge
le niveau
le statut du compte
les règles de l’établissement
l’autorisation parentale
le type de portail utilisé
```

Données possibles :

```txt
accès portail élève
notifications pédagogiques
devoirs
ressources
notes si autorisé
messages enseignant
langue préférée
push autorisé si compte actif
restrictions parentales
```

## Règle

```txt
Pour les élèves mineurs, certaines préférences doivent être validées ou encadrées
par le parent/tuteur ou l’établissement.
```

---

# 10. Préférences par enseignant

Pour les enseignants, gérer :

```txt
canal principal
canal secondaire
email professionnel
notifications internes
notifications pédagogiques
notifications administratives
notifications RH
notifications classe
notifications urgence
horaires de réception
fréquence des résumés
langue préférée
```

Exemples :

```txt
recevoir les annonces générales par portail
recevoir les urgences par SMS
recevoir les notifications pédagogiques par email
recevoir un résumé quotidien plutôt que plusieurs notifications
```

---

# 11. Préférences par canal

Canaux gérés :

```txt
portail
email
SMS
WhatsApp
push
notification interne
webhook/API si profil technique
```

Pour chaque canal :

```txt
autorisé
refusé
préféré
secondaire
indisponible
non vérifié
en erreur
```

Données :

```txt
valeur du contact
statut de vérification
dernière réussite
dernier échec
nombre d’échecs
consentement lié
date de modification
```

---

# 12. Préférences par type de message

Types de messages :

```txt
urgence
sécurité
administratif
financier
pédagogique
examens
bulletins
présence
discipline
bibliothèque
événement
réunion
campagne
marketing/communication non essentielle
rappel
système
```

Chaque type doit pouvoir définir :

```txt
canal préféré
canal fallback
autorisation
fréquence
niveau de criticité
possibilité de refus
confirmation requise
```

## Classification

```txt
critique non refusable
important avec fallback
normal configurable
optionnel refusable
```

---

# 13. Consentements parentaux

Le système doit gérer les consentements liés à :

```txt
réception de communications numériques
utilisation WhatsApp
réception SMS
notifications push
communication avec l’élève via portail
diffusion de documents
réception de bulletins numériques
confirmations électroniques
participation à événements
autorisations spécifiques école
```

Chaque consentement doit contenir :

```txt
type
parent/tuteur
élève concerné
statut
date de demande
date de validation
date d’expiration
preuve
canal de validation
utilisateur ayant enregistré
commentaire
```

## Statuts

```txt
en attente
accepté
refusé
expiré
révoqué
remplacé
```

---

# 14. Gestion des refus

Le système doit gérer :

```txt
refus email
refus SMS
refus WhatsApp
refus push
refus campagne
refus communication optionnelle
refus temporaire
refus par type de message
```

## Règles

```txt
refus total uniquement pour messages non critiques
refus critique interdit sauf politique établissement spécifique
refus historisé
possibilité de réactivation
confirmation nécessaire
impact visible avant validation
```

---

# 15. Exceptions messages critiques

Messages critiques possibles :

```txt
urgence sanitaire
sécurité
fermeture exceptionnelle
absence grave
incident disciplinaire sérieux
convocation urgente
paiement bloquant si politique école
information administrative obligatoire
événement majeur
```

## Règles

```txt
peuvent ignorer certaines préférences
doivent être tracés
doivent afficher la justification
doivent être limités
doivent générer une alerte si usage excessif
```

---

# 16. Langues & bilingue

Le système doit gérer :

```txt
langue préférée FR
langue préférée EN
langue automatique selon portail
fallback FR
fallback EN
modèles bilingues
absence de traduction
préférence par type de message
```

## Règles

```txt
si le destinataire préfère EN et que le modèle EN existe, envoyer EN
si EN absent, utiliser FR avec trace fallback
si école bilingue, modèles critiques FR/EN recommandés
Sara AI peut suggérer traduction, validation humaine requise
```

---

# 17. Fréquence & plages horaires

Paramètres :

```txt
réception immédiate
résumé quotidien
résumé hebdomadaire
pas de notifications non urgentes le soir
pas de notifications non urgentes le week-end
plages horaires autorisées
fuseau horaire
limitation du nombre de messages par jour
regroupement des messages non critiques
```

## Règles

```txt
les urgences peuvent contourner les plages horaires
les messages non critiques doivent respecter les préférences
les campagnes doivent vérifier la fréquence avant envoi
```

---

# 18. Synchronisation portail

Les utilisateurs doivent pouvoir gérer certaines préférences depuis :

```txt
portail parent/élève
portail enseignant
portail école selon rôle
```

## Synchronisations

```txt
modification canal préféré
modification langue
activation/désactivation push
consentement
refus optionnel
plage horaire
confirmation
```

Chaque modification portail doit être :

```txt
validée
historisée
visible côté administration
auditée
```

---

# 19. Historique des changements

Chaque changement doit tracer :

```txt
ancien état
nouvel état
utilisateur
source
date
justification
canal
profil concerné
impact potentiel
```

## Sources possibles

```txt
administration
parent via portail
enseignant via portail
import
API
Sara AI suggestion acceptée
ORION correction
système
```

---

# 20. Suggestions Sara AI

Sara AI peut aider à :

```txt
détecter un profil incomplet
recommander un canal alternatif
proposer une stratégie de réduction de sollicitations
expliquer l’impact d’un refus
reformuler une demande de consentement
traduire une demande de consentement
suggérer des regroupements de messages
analyser les préférences conflictuelles
```

## Règle

```txt
Sara AI ne modifie jamais une préférence ou un consentement sans validation humaine.
```

---

# 21. Alertes ORION

ORION doit détecter :

```txt
parent sans canal valide
élève sans contact parent
consentement expiré
consentement manquant
refus incompatible avec message critique
canal préféré en échec
trop de communications malgré préférence faible
usage excessif d’exception critique
conflit entre parent et établissement
préférence bilingue sans modèle traduit
push activé sans token valide
SMS autorisé sans numéro valide
WhatsApp autorisé sans numéro valide
profil non joignable
```

Chaque alerte doit contenir :

```txt
niveau
profil
problème
impact
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Préférences — Canal préféré invalide

Le parent de l’élève A. préfère recevoir les communications par WhatsApp,
mais aucun numéro WhatsApp valide n’est enregistré.
Impact possible : échec des communications importantes.
Action recommandée : vérifier le contact ou définir SMS/Portail comme canal secondaire.
```

---

# 22. Exports

Formats possibles :

```txt
Excel
CSV
PDF
```

Exports disponibles :

```txt
profils de communication
préférences par parent
préférences par élève
préférences par enseignant
consentements
refus
profils incomplets
profils non joignables
alertes ORION
historique des changements
```

## Règles

```txt
export soumis à permission
données sensibles masquées selon rôle
export historisé
limitation de volume
expiration du lien
```

---

# 23. Base de données — CommunicationPreferenceProfile

```prisma
model CommunicationPreferenceProfile {
  id              String @id @default(cuid())
  tenantId        String

  ownerType       CommunicationPreferenceOwnerType
  ownerId         String
  userId          String?

  status          CommunicationPreferenceProfileStatus @default(INCOMPLETE)

  preferredLanguage CommunicationLanguage @default(FR)
  fallbackLanguage  CommunicationLanguage?

  primaryChannel  CommunicationChannelType?
  secondaryChannel CommunicationChannelType?

  quietHours      Json?
  frequencyRules  Json?
  messageTypeRules Json?
  channelRules    Json?
  metadata        Json?

  lastUpdatedSource PreferenceUpdateSource?
  lastVerifiedAt  DateTime?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  consents        CommunicationConsent[]
  changes         CommunicationPreferenceChange[]

  @@unique([tenantId, ownerType, ownerId])
  @@index([tenantId])
  @@index([ownerType, ownerId])
  @@index([status])
}
```

---

# 24. Base de données — CommunicationConsent

```prisma
model CommunicationConsent {
  id              String @id @default(cuid())
  tenantId        String

  profileId       String
  consentType     CommunicationConsentType
  status          CommunicationConsentStatus @default(PENDING)

  studentId       String?
  parentId        String?

  requestedAt     DateTime @default(now())
  acceptedAt      DateTime?
  refusedAt       DateTime?
  revokedAt       DateTime?
  expiresAt       DateTime?

  proof           Json?
  validationChannel CommunicationChannelType?
  comment         String?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile         CommunicationPreferenceProfile @relation(fields: [profileId], references: [id])

  @@index([tenantId])
  @@index([profileId])
  @@index([consentType])
  @@index([status])
  @@index([studentId])
  @@index([parentId])
}
```

---

# 25. Base de données — CommunicationPreferenceChange

```prisma
model CommunicationPreferenceChange {
  id              String @id @default(cuid())
  tenantId        String

  profileId       String
  changeType      CommunicationPreferenceChangeType
  source          PreferenceUpdateSource

  previousValue   Json?
  newValue        Json?
  reason          String?

  createdById     String?
  createdAt       DateTime @default(now())

  profile         CommunicationPreferenceProfile @relation(fields: [profileId], references: [id])

  @@index([tenantId])
  @@index([profileId])
  @@index([changeType])
  @@index([source])
  @@index([createdAt])
}
```

---

# 26. Enums

```prisma
enum CommunicationPreferenceOwnerType {
  PARENT
  STUDENT
  TEACHER
  STAFF
  ADMIN
  GROUP
  CLASS
  SCHOOL
}

enum CommunicationPreferenceProfileStatus {
  COMPLETE
  INCOMPLETE
  TO_VERIFY
  UNREACHABLE
  PARTIAL_OPT_OUT
  NON_CRITICAL_OPT_OUT
  BLOCKED
  ARCHIVED
}

enum CommunicationLanguage {
  FR
  EN
}

enum PreferenceUpdateSource {
  ADMIN
  PARENT_PORTAL
  STUDENT_PORTAL
  TEACHER_PORTAL
  IMPORT
  API
  SYSTEM
  SARA_AI_ACCEPTED
  ORION_CORRECTION
}

enum CommunicationConsentType {
  DIGITAL_COMMUNICATION
  EMAIL
  SMS
  WHATSAPP
  PUSH
  STUDENT_PORTAL_COMMUNICATION
  DIGITAL_REPORT_CARD
  ELECTRONIC_CONFIRMATION
  EVENT_PARTICIPATION
  SPECIFIC_SCHOOL_AUTHORIZATION
}

enum CommunicationConsentStatus {
  PENDING
  ACCEPTED
  REFUSED
  EXPIRED
  REVOKED
  REPLACED
}

enum CommunicationPreferenceChangeType {
  CHANNEL_UPDATED
  LANGUAGE_UPDATED
  FREQUENCY_UPDATED
  QUIET_HOURS_UPDATED
  MESSAGE_TYPE_RULE_UPDATED
  CONSENT_CREATED
  CONSENT_ACCEPTED
  CONSENT_REFUSED
  CONSENT_REVOKED
  OPT_OUT_CREATED
  OPT_OUT_REMOVED
  CRITICAL_EXCEPTION_USED
  PROFILE_VERIFIED
  PROFILE_MARKED_UNREACHABLE
}
```

---

# 27. Backend — Routes API

```http
GET    /api/communication/preferences-consents
GET    /api/communication/preferences-consents/dashboard

GET    /api/communication/preference-profiles
POST   /api/communication/preference-profiles
GET    /api/communication/preference-profiles/:profileId
PATCH  /api/communication/preference-profiles/:profileId
POST   /api/communication/preference-profiles/:profileId/verify
POST   /api/communication/preference-profiles/:profileId/mark-unreachable

GET    /api/communication/preferences-consents/parent/:parentId
GET    /api/communication/preferences-consents/student/:studentId
GET    /api/communication/preferences-consents/teacher/:teacherId

GET    /api/communication/consents
POST   /api/communication/consents
PATCH  /api/communication/consents/:consentId
POST   /api/communication/consents/:consentId/accept
POST   /api/communication/consents/:consentId/refuse
POST   /api/communication/consents/:consentId/revoke

GET    /api/communication/preferences-consents/changes
GET    /api/communication/preferences-consents/orion-alerts
GET    /api/communication/preferences-consents/sara-suggestions

POST   /api/communication/preferences-consents/export
```

---

# 28. Backend — Services

Services recommandés :

```txt
CommunicationPreferenceService
CommunicationPreferenceProfileService
CommunicationConsentService
PreferenceDashboardService
ParentPreferenceService
StudentPreferenceService
TeacherPreferenceService
ChannelPreferenceService
MessageTypePreferenceService
OptOutService
CriticalMessageExceptionService
PreferenceHistoryService
PortalPreferenceSyncService
PreferenceSaraService
PreferenceOrionService
PreferenceExportService
PreferenceAuditService
```

---

# 29. Sécurité

## Permissions

```txt
COMMUNICATION_PREFERENCES_VIEW
COMMUNICATION_PREFERENCES_CREATE
COMMUNICATION_PREFERENCES_UPDATE
COMMUNICATION_PREFERENCES_VERIFY
COMMUNICATION_PREFERENCES_MARK_UNREACHABLE
COMMUNICATION_CONSENTS_VIEW
COMMUNICATION_CONSENTS_CREATE
COMMUNICATION_CONSENTS_UPDATE
COMMUNICATION_CONSENTS_ACCEPT
COMMUNICATION_CONSENTS_REFUSE
COMMUNICATION_CONSENTS_REVOKE
COMMUNICATION_PREFERENCES_CHANGES_VIEW
COMMUNICATION_PREFERENCES_EXPORT
COMMUNICATION_PREFERENCES_SARA_USE
COMMUNICATION_PREFERENCES_ORION_VIEW
COMMUNICATION_PREFERENCES_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
accès parent limité à ses propres enfants
accès enseignant limité selon politique école
consentements sensibles protégés
historique non modifiable
export contrôlé
audit complet
validation humaine des suggestions Sara AI
exceptions critiques tracées
```

---

# 30. Audit

Auditer :

```txt
création profil
modification profil
vérification profil
profil marqué non joignable
création consentement
acceptation consentement
refus consentement
révocation consentement
modification langue
modification canal
modification fréquence
création refus
suppression refus
usage exception critique
synchronisation portail
export
consultation sensible
alerte ORION
suggestion Sara AI acceptée
accès refusé
```

---

# 31. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 9 — Préférences & Consentements** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
préférences par profil
préférences par canal
préférences par type de message
consentements parentaux
gestion des refus
exceptions critiques
bilingue FR/EN
synchronisation portail
historique complet
ORION Communication
Sara AI sans modification directe
exports contrôlés
audit complet
```

## À créer côté frontend

```txt
Page /communication/preferences-consents
PreferencesConsentsPage
PreferencesDashboardCards
CommunicationProfileList
CommunicationProfileCard
PreferenceFilters
PreferenceSearchBar
ParentPreferencesPanel
StudentPreferencesPanel
TeacherPreferencesPanel
ChannelPreferencesPanel
MessageTypePreferencesPanel
ParentalConsentPanel
OptOutManagementPanel
CriticalMessageExceptionsPanel
LanguagePreferencePanel
FrequencyQuietHoursPanel
PreferenceHistoryTimeline
PortalSyncStatusPanel
PreferenceOrionAlertsPanel
PreferenceSaraAssistantPanel
PreferenceExportPanel
PreferenceAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Profils de communication
Préférences parent
Préférences élève
Préférences enseignant
Préférences canal
Préférences type de message
Consentements parentaux
Gestion des refus
Exceptions critiques
Synchronisation portail
Historique changements
ORION Préférences
Sara AI Assistance sans modification directe
Exports
Audit complet
```

## À créer côté BDD

```txt
CommunicationPreferenceProfile
CommunicationConsent
CommunicationPreferenceChange
Enums CommunicationPreferenceOwnerType, CommunicationPreferenceProfileStatus,
CommunicationLanguage, PreferenceUpdateSource, CommunicationConsentType,
CommunicationConsentStatus, CommunicationPreferenceChangeType
Relations avec Tenant, User, Student, Parent, Teacher, AuditLog si nécessaire
```

---

# 32. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
gérer les profils de communication
gérer les préférences parentales
gérer les préférences élèves
gérer les préférences enseignants
définir les canaux préférés
définir les langues préférées
définir les fréquences de réception
gérer les consentements
gérer les refus
gérer les exceptions critiques
synchroniser avec les portails
historiser les changements
détecter les anomalies ORION
utiliser Sara AI comme assistant
exporter les données autorisées
auditer toutes les actions sensibles
```

---

# Conclusion

L’onglet **Préférences & Consentements** apporte une couche de gouvernance indispensable à la communication scolaire.

La règle d’or :

```txt
Une communication efficace respecte les préférences, mais ne sacrifie jamais les messages critiques.
```

Avec cet onglet, Academia Helm évite le spam, renforce la confiance des familles et donne à l’établissement une maîtrise professionnelle de ses communications.

La suite logique :

```txt
Onglet 10 — Statistiques & Performance
```

---

Très bien. On termine proprement avec l’**Onglet 10 — Statistiques & Performance**. C’est l’onglet qui transforme la communication en pilotage stratégique. Sans statistiques, on communique “au feeling”. Avec cet onglet, Academia Helm donne à l’établissement un tableau de bord de commandement.

# MODULE COMMUNICATION & NOTIFICATIONS

## ONGLET 10 — STATISTIQUES & PERFORMANCE

---

# 1. Objectif de l’onglet

L’onglet **Statistiques & Performance** permet de mesurer, analyser, comparer et optimiser l’efficacité globale des communications de l’établissement.

Il ne s’agit pas seulement de compter les messages envoyés. L’objectif est de savoir :

```txt
quels messages atteignent réellement les destinataires
quels canaux fonctionnent le mieux
quels types de communications sont ignorés
quelles campagnes génèrent de l’engagement
quels parents/enseignants/élèves sont difficiles à joindre
quels coûts sont générés par les canaux payants
quelles anomalies doivent être corrigées
quelles décisions l’établissement doit prendre pour améliorer sa communication
```

Cet onglet transforme la communication scolaire en pilotage mesurable.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/communication/statistics-performance
```

## Module parent

```txt
Communication & Notifications
```

## Dépendances directes

```txt
Messages internes
Annonces officielles
Notifications automatiques
Campagnes de communication
Modèles de messages
Canaux & Connecteurs
Historique & Traçabilité
Préférences & Consentements
Portail Parent/Élève
Portail Enseignant
ORION Communication
Sara AI
Audit
Exports
```

---

# 3. Principe général

L’onglet doit agréger les données issues de tous les sous-systèmes de communication afin de produire des indicateurs fiables.

## Sources de données

```txt
messages internes
annonces
notifications automatiques
campagnes
logs d’envoi
confirmations de lecture
accusés de réception
échecs
retries
fallbacks
préférences
consentements
coûts
alertes ORION
interventions Sara AI
```

## Règle métier

```txt
Une statistique n’a de valeur que si elle peut être reliée à une source traçable.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord global
2. Statistiques d’envoi
3. Statistiques de livraison
4. Statistiques de lecture
5. Statistiques d’engagement
6. Performance par canal
7. Performance par type de message
8. Performance par audience
9. Performance par campagne
10. Performance par module source
11. Analyse des échecs
12. Analyse des coûts
13. Analyse des préférences
14. Tendances temporelles
15. Comparaisons périodes
16. Recommandations Sara AI
17. Alertes ORION
18. Rapports & exports
19. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/communication/statistics-performance
```

## 5.2 Page principale

```txt
app/(school)/communication/statistics-performance/page.tsx
```

## 5.3 Composants recommandés

```txt
components/communication/statistics-performance/CommunicationStatisticsPage.tsx
components/communication/statistics-performance/StatisticsDashboardCards.tsx
components/communication/statistics-performance/StatisticsDateRangePicker.tsx
components/communication/statistics-performance/StatisticsFilterBar.tsx
components/communication/statistics-performance/SendingStatsPanel.tsx
components/communication/statistics-performance/DeliveryStatsPanel.tsx
components/communication/statistics-performance/ReadStatsPanel.tsx
components/communication/statistics-performance/EngagementStatsPanel.tsx
components/communication/statistics-performance/ChannelPerformanceChart.tsx
components/communication/statistics-performance/MessageTypePerformanceChart.tsx
components/communication/statistics-performance/AudiencePerformancePanel.tsx
components/communication/statistics-performance/CampaignPerformanceTable.tsx
components/communication/statistics-performance/SourceModulePerformancePanel.tsx
components/communication/statistics-performance/FailureAnalysisPanel.tsx
components/communication/statistics-performance/CostAnalysisPanel.tsx
components/communication/statistics-performance/PreferenceImpactPanel.tsx
components/communication/statistics-performance/CommunicationTrendChart.tsx
components/communication/statistics-performance/PeriodComparisonPanel.tsx
components/communication/statistics-performance/SaraPerformanceInsightsPanel.tsx
components/communication/statistics-performance/OrionPerformanceAlertsPanel.tsx
components/communication/statistics-performance/StatisticsReportExportPanel.tsx
components/communication/statistics-performance/StatisticsAuditTimeline.tsx
```

---

# 6. Tableau de bord global

Le tableau de bord doit afficher :

```txt
total communications envoyées
total communications livrées
total communications lues
total communications confirmées
total communications échouées
taux de livraison
taux de lecture
taux d’échec
taux de confirmation
taux d’engagement
coût total estimé
canal le plus performant
canal le plus coûteux
type de message le plus lu
audience la plus réactive
audience la moins joignable
alertes ORION actives
```

## KPI recommandés

```txt
volume total
volume par jour
volume par canal
volume par audience
délai moyen de livraison
délai moyen de lecture
nombre de retries
nombre de fallbacks
coût moyen par message
coût par message livré
coût par message lu
taux de messages critiques non lus
```

---

# 7. Statistiques d’envoi

Mesurer :

```txt
messages créés
messages planifiés
messages envoyés
messages annulés
messages en file d’attente
messages automatiques déclenchés
messages manuels
messages générés depuis campagne
messages générés depuis module source
```

## Axes d’analyse

```txt
période
canal
audience
type de message
module source
utilisateur expéditeur
classe
niveau
cycle
```

---

# 8. Statistiques de livraison

Mesurer :

```txt
envoyés
livrés
non livrés
bloqués
expirés
en attente
retries
fallbacks
livraisons après fallback
```

## Indicateurs

```txt
taux de livraison global
taux de livraison par canal
taux de livraison par fournisseur
délai moyen de livraison
taux de fallback réussi
taux de retry réussi
taux de livraison des messages critiques
```

---

# 9. Statistiques de lecture

Mesurer :

```txt
messages lus
messages non lus
confirmations de lecture
accusés de réception
délai moyen avant lecture
lecture par canal
lecture par audience
lecture par type de message
lecture par langue
lecture par heure d’envoi
```

## Indicateurs

```txt
taux de lecture global
taux de lecture par canal
taux de lecture parent
taux de lecture enseignant
taux de lecture élève
taux de lecture des annonces
taux de lecture des urgences
taux de lecture des bulletins
taux de lecture des campagnes
```

---

# 10. Statistiques d’engagement

L’engagement mesure les actions après réception.

## Actions possibles

```txt
lecture
confirmation
clic
réponse
téléchargement
ouverture document
consultation bulletin
paiement après notification
justification absence
présence à réunion
validation consentement
action portail
```

## Indicateurs

```txt
taux d’engagement
taux de clic
taux de réponse
taux de confirmation
taux d’action réalisée
délai moyen d’action
conversion campagne
conversion notification financière
conversion notification pédagogique
```

---

# 11. Performance par canal

Canaux analysés :

```txt
portail
email
SMS
WhatsApp
push
notification interne
webhook/API
```

Pour chaque canal :

```txt
volume envoyé
volume livré
volume lu
volume confirmé
taux de succès
taux d’échec
coût
délai moyen
retries
fallbacks
incidents
tendance
```

## Objectif

```txt
Identifier les canaux réellement utiles, pas seulement les canaux populaires.
```

---

# 12. Performance par type de message

Types analysés :

```txt
urgence
sécurité
administratif
financier
pédagogique
examens
bulletins
présence
discipline
bibliothèque
événement
réunion
campagne
rappel
système
```

Pour chaque type :

```txt
volume
taux de livraison
taux de lecture
taux d’engagement
taux d’échec
canal dominant
audience dominante
coût
tendance
```

---

# 13. Performance par audience

Audiences analysées :

```txt
parents
élèves
enseignants
personnel
direction
classes
groupes
niveaux
cycles
```

Indicateurs :

```txt
taux de joignabilité
taux de lecture
taux de confirmation
taux d’échec
taux d’engagement
canaux préférés
heures efficaces
langues efficaces
profils non joignables
audiences sursollicitées
```

---

# 14. Performance par campagne

Pour chaque campagne :

```txt
nom
objectif
audience
période
canal
messages envoyés
livrés
lus
confirmés
cliqués
réponses
conversions
échecs
coût
ROI opérationnel
score de performance
recommandations
```

## Score de performance possible

```txt
excellent
bon
moyen
faible
critique
```

---

# 15. Performance par module source

Modules sources :

```txt
Élèves & Scolarité
Finance & Scolarité
Examens, Notes & Bulletins
Présence & Discipline
Pédagogie
Bibliothèque virtuelle
Enseignants & RH
Administration
Paramètres
Portail
Communication
ORION
Sara AI
```

Pour chaque module :

```txt
volume généré
taux de livraison
taux de lecture
taux d’échec
impact
anomalies
coût
tendance
```

---

# 16. Analyse des échecs

Analyser :

```txt
erreurs par canal
erreurs par fournisseur
erreurs par audience
erreurs par type de message
erreurs par module
erreurs par période
erreurs récurrentes
erreurs critiques
```

## Causes possibles

```txt
numéro invalide
email invalide
WhatsApp non disponible
push token expiré
consentement manquant
canal refusé
quota dépassé
fournisseur indisponible
template rejeté
variable manquante
préférence incompatible
contact non vérifié
```

## Indicateurs

```txt
top erreurs
taux d’échec critique
coût des échecs
fallbacks réussis
fallbacks échoués
profils à corriger
```

---

# 17. Analyse des coûts

Coûts à suivre :

```txt
SMS
WhatsApp
email transactionnel
push
webhooks
fournisseur externe
coût par campagne
coût par canal
coût par audience
coût par message livré
coût par message lu
coût par action réalisée
```

## Indicateurs

```txt
coût total période
coût moyen par message
coût par canal
coût par campagne
coût par notification automatique
coût évitable
budget consommé
seuils dépassés
projection mensuelle
```

---

# 18. Analyse des préférences

Mesurer l’impact des préférences sur la performance :

```txt
canal préféré vs canal réellement performant
langue préférée vs taux de lecture
plages horaires vs taux de lecture
refus non critiques
consentements manquants
profils incomplets
profils non joignables
préférences conflictuelles
impact des fallbacks
```

## Objectif

```txt
Aider l’établissement à ajuster ses politiques de communication.
```

---

# 19. Tendances temporelles

Afficher les tendances :

```txt
par jour
par semaine
par mois
par trimestre
par année scolaire
par période personnalisée
```

## Courbes recommandées

```txt
volume envoyé
taux de livraison
taux de lecture
taux d’échec
coût
engagement
messages critiques non lus
évolution des canaux
évolution des préférences
```

---

# 20. Comparaisons de périodes

Permettre de comparer :

```txt
semaine actuelle vs semaine précédente
mois actuel vs mois précédent
trimestre actuel vs trimestre précédent
année scolaire actuelle vs précédente
campagne A vs campagne B
canal A vs canal B
niveau A vs niveau B
classe A vs classe B
```

## Indicateurs comparés

```txt
volume
livraison
lecture
engagement
coût
échecs
confirmations
délais
```

---

# 21. Recommandations Sara AI

Sara AI peut produire :

```txt
résumé de performance
diagnostic des canaux
recommandations d’optimisation
détection d’audience peu réactive
suggestion de meilleur horaire
suggestion de canal alternatif
analyse d’une campagne faible
analyse des coûts excessifs
proposition de regroupement de messages
recommandation bilingue FR/EN
résumé exécutif pour direction
```

## Règle

```txt
Sara AI doit s’appuyer sur des données agrégées et ne doit pas exposer inutilement des données personnelles.
```

---

# 22. Alertes ORION

ORION doit détecter :

```txt
chute du taux de livraison
chute du taux de lecture
hausse du taux d’échec
coût anormal
canal sous-performant
campagne inefficace
messages critiques non lus
audience non joignable
parent sursollicité
fournisseur instable
hausse des fallbacks
consentements bloquant trop d’envois
préférences réduisant fortement la performance
anomalie statistique
export massif suspect
```

Chaque alerte doit contenir :

```txt
niveau
indicateur concerné
période
impact
cause probable
recommandation
action rapide
statut
```

Exemple :

```txt
ORION Performance — Chute du taux de lecture

Le taux de lecture des messages parents est passé de 78 % à 42 % cette semaine.
Cause probable : envoi massif hors plage horaire habituelle.
Action recommandée : privilégier les créneaux 18h-20h ou activer un résumé quotidien.
```

---

# 23. Rapports & exports

Formats possibles :

```txt
Excel
CSV
PDF
JSON si autorisé
```

Rapports disponibles :

```txt
rapport global communication
rapport performance canaux
rapport campagnes
rapport audiences
rapport coûts
rapport échecs
rapport engagement
rapport ORION
rapport Sara AI
rapport direction
rapport année scolaire
```

## Règles

```txt
export soumis à permission
données agrégées par défaut
données nominatives uniquement si permission
export historisé
expiration du lien
génération asynchrone si gros volume
```

---

# 24. Base de données — CommunicationMetricSnapshot

```prisma
model CommunicationMetricSnapshot {
  id              String @id @default(cuid())
  tenantId        String

  periodType      CommunicationMetricPeriodType
  periodStart     DateTime
  periodEnd       DateTime

  scopeType       CommunicationMetricScopeType
  scopeValue      String?

  totalCreated    Int @default(0)
  totalQueued     Int @default(0)
  totalSent       Int @default(0)
  totalDelivered  Int @default(0)
  totalRead       Int @default(0)
  totalAcknowledged Int @default(0)
  totalClicked    Int @default(0)
  totalReplied    Int @default(0)
  totalFailed     Int @default(0)
  totalRetried    Int @default(0)
  totalFallbacks  Int @default(0)

  deliveryRate    Decimal? @db.Decimal(8, 4)
  readRate        Decimal? @db.Decimal(8, 4)
  engagementRate  Decimal? @db.Decimal(8, 4)
  failureRate     Decimal? @db.Decimal(8, 4)

  avgDeliveryDelayMs Int?
  avgReadDelayMs     Int?
  avgActionDelayMs   Int?

  totalCost       Decimal? @db.Decimal(12, 4)
  avgCostPerMessage Decimal? @db.Decimal(12, 4)

  metadata        Json?

  generatedAt     DateTime @default(now())

  @@index([tenantId])
  @@index([periodType])
  @@index([periodStart, periodEnd])
  @@index([scopeType, scopeValue])
}
```

---

# 25. Base de données — CommunicationPerformanceInsight

```prisma
model CommunicationPerformanceInsight {
  id              String @id @default(cuid())
  tenantId        String

  insightType     CommunicationPerformanceInsightType
  severity        OrionSeverityLevel?

  title           String
  description     String
  metricKey       String?
  metricValue     Decimal? @db.Decimal(12, 4)
  periodStart     DateTime?
  periodEnd       DateTime?

  scopeType       CommunicationMetricScopeType?
  scopeValue      String?

  recommendation  String?
  actionPayload   Json?
  source          CommunicationInsightSource @default(SYSTEM)

  status          CommunicationInsightStatus @default(OPEN)

  createdAt       DateTime @default(now())
  resolvedAt      DateTime?
  resolvedById    String?

  @@index([tenantId])
  @@index([insightType])
  @@index([severity])
  @@index([status])
  @@index([createdAt])
}
```

---

# 26. Enums

```prisma
enum CommunicationMetricPeriodType {
  DAY
  WEEK
  MONTH
  TERM
  SCHOOL_YEAR
  CUSTOM
}

enum CommunicationMetricScopeType {
  GLOBAL
  CHANNEL
  MESSAGE_TYPE
  AUDIENCE
  CAMPAIGN
  SOURCE_MODULE
  CLASS
  LEVEL
  CYCLE
  PROVIDER
  LANGUAGE
}

enum CommunicationPerformanceInsightType {
  DELIVERY_DROP
  READ_DROP
  FAILURE_SPIKE
  COST_SPIKE
  CHANNEL_UNDERPERFORMING
  CAMPAIGN_UNDERPERFORMING
  CRITICAL_MESSAGES_UNREAD
  AUDIENCE_UNREACHABLE
  OVER_SOLICITATION
  PROVIDER_INSTABILITY
  FALLBACK_SPIKE
  CONSENT_BLOCKING
  PREFERENCE_CONFLICT
  STATISTICAL_ANOMALY
}

enum CommunicationInsightSource {
  SYSTEM
  ORION
  SARA_AI
}

enum CommunicationInsightStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  DISMISSED
}
```

---

# 27. Backend — Routes API

```http
GET    /api/communication/statistics-performance
GET    /api/communication/statistics-performance/dashboard

GET    /api/communication/statistics-performance/sending
GET    /api/communication/statistics-performance/delivery
GET    /api/communication/statistics-performance/read
GET    /api/communication/statistics-performance/engagement

GET    /api/communication/statistics-performance/channels
GET    /api/communication/statistics-performance/message-types
GET    /api/communication/statistics-performance/audiences
GET    /api/communication/statistics-performance/campaigns
GET    /api/communication/statistics-performance/source-modules
GET    /api/communication/statistics-performance/failures
GET    /api/communication/statistics-performance/costs
GET    /api/communication/statistics-performance/preferences-impact
GET    /api/communication/statistics-performance/trends
GET    /api/communication/statistics-performance/compare

GET    /api/communication/statistics-performance/orion-alerts
GET    /api/communication/statistics-performance/sara-insights

POST   /api/communication/statistics-performance/generate-snapshot
POST   /api/communication/statistics-performance/export
```

---

# 28. Backend — Services

Services recommandés :

```txt
CommunicationStatisticsService
CommunicationMetricSnapshotService
StatisticsDashboardService
SendingStatisticsService
DeliveryStatisticsService
ReadStatisticsService
EngagementStatisticsService
ChannelPerformanceService
MessageTypePerformanceService
AudiencePerformanceService
CampaignPerformanceService
SourceModulePerformanceService
FailureAnalysisService
CostAnalysisService
PreferenceImpactAnalysisService
CommunicationTrendService
PeriodComparisonService
PerformanceInsightService
PerformanceSaraService
PerformanceOrionService
StatisticsExportService
StatisticsAuditService
```

---

# 29. Sécurité

## Permissions

```txt
COMMUNICATION_STATISTICS_VIEW
COMMUNICATION_STATISTICS_DASHBOARD_VIEW
COMMUNICATION_STATISTICS_CHANNELS_VIEW
COMMUNICATION_STATISTICS_AUDIENCES_VIEW
COMMUNICATION_STATISTICS_CAMPAIGNS_VIEW
COMMUNICATION_STATISTICS_COSTS_VIEW
COMMUNICATION_STATISTICS_FAILURES_VIEW
COMMUNICATION_STATISTICS_PREFERENCES_VIEW
COMMUNICATION_STATISTICS_COMPARE
COMMUNICATION_STATISTICS_EXPORT
COMMUNICATION_STATISTICS_SARA_USE
COMMUNICATION_STATISTICS_ORION_VIEW
COMMUNICATION_STATISTICS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
statistiques agrégées par défaut
données nominatives uniquement avec permission
export contrôlé
audit des consultations sensibles
limitation des requêtes lourdes
cache ou snapshots pour performance
pas d’exposition excessive des données personnelles
```

---

# 30. Audit

Auditer :

```txt
consultation tableau de bord
consultation statistiques globales
consultation statistiques audience
consultation statistiques campagne
consultation statistiques coûts
consultation statistiques échecs
comparaison de périodes
génération snapshot
export
consultation données nominatives
utilisation Sara AI
alerte ORION
accès refusé
```

---

# 31. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 10 — Statistiques & Performance** du **Module Communication & Notifications**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
statistiques agrégées
données nominatives protégées
dashboards performants
filtres par période
analyse par canal
analyse par audience
analyse par campagne
analyse par module source
analyse coûts
analyse échecs
recommandations Sara AI
alertes ORION
exports contrôlés
audit complet
```

## À créer côté frontend

```txt
Page /communication/statistics-performance
CommunicationStatisticsPage
StatisticsDashboardCards
StatisticsDateRangePicker
StatisticsFilterBar
SendingStatsPanel
DeliveryStatsPanel
ReadStatsPanel
EngagementStatsPanel
ChannelPerformanceChart
MessageTypePerformanceChart
AudiencePerformancePanel
CampaignPerformanceTable
SourceModulePerformancePanel
FailureAnalysisPanel
CostAnalysisPanel
PreferenceImpactPanel
CommunicationTrendChart
PeriodComparisonPanel
SaraPerformanceInsightsPanel
OrionPerformanceAlertsPanel
StatisticsReportExportPanel
StatisticsAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Agrégation statistiques
Snapshots de métriques
Statistiques d’envoi
Statistiques de livraison
Statistiques de lecture
Statistiques d’engagement
Performance par canal
Performance par type de message
Performance par audience
Performance par campagne
Performance par module source
Analyse des échecs
Analyse des coûts
Analyse impact préférences
Tendances temporelles
Comparaisons de périodes
ORION Performance
Sara AI Insights
Exports
Audit complet
```

## À créer côté BDD

```txt
CommunicationMetricSnapshot
CommunicationPerformanceInsight
Enums CommunicationMetricPeriodType, CommunicationMetricScopeType,
CommunicationPerformanceInsightType, CommunicationInsightSource,
CommunicationInsightStatus
Relations avec Tenant, User, Campaign, CommunicationHistoryEvent, AuditLog si nécessaire
```

---

# 32. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
mesurer les communications envoyées
mesurer les livraisons
mesurer les lectures
mesurer l’engagement
analyser les canaux
analyser les audiences
analyser les campagnes
analyser les modules sources
analyser les échecs
analyser les coûts
mesurer l’impact des préférences
visualiser les tendances
comparer les périodes
recevoir des recommandations Sara AI
recevoir des alertes ORION
exporter les rapports
auditer les consultations sensibles
```

---

# Conclusion

L’onglet **Statistiques & Performance** est le centre analytique du module Communication.

La règle d’or :

```txt
Ce qui se mesure s’améliore. Ce qui ne se mesure pas se subit.
```

Avec cet onglet, Academia Helm permet à l’établissement de passer d’une communication administrative classique à une communication intelligente, mesurable, optimisée et gouvernée.

---

