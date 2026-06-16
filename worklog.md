---
Task ID: 1
Agent: Main Agent
Task: Implémenter la persistance des chats SARA avec expiration automatique après 30 jours

Work Log:
- Analysé le projet : 3 widgets de chat (SaraWidget, SupportChatWidget, InAppSaraGuide) stockaient les messages uniquement en useState (éphémère, perdus au rechargement)
- Créé `/apps/web-app/src/lib/sara/chat-storage.ts` — utilitaire de persistance avec localStorage et expiration 30 jours
- Mis à jour `SaraWidget.tsx` : chargement des messages sauvegardés + sauvegarde automatique via useEffect
- Mis à jour `SupportChatWidget.tsx` : même logique + helpers de sérialisation/désérialisation pour les objets Date
- Mis à jour `InAppSaraGuide.tsx` : même logique avec préservation du message d'accueil contextuel
- Vérifié la compilation TypeScript : aucune erreur liée aux modifications

Stage Summary:
- Fichier créé : `src/lib/sara/chat-storage.ts` (utilitaire complet de persistance)
- 3 composants modifiés pour utiliser la persistance
- Les conversations sont maintenant sauvegardées dans localStorage et persistent entre les rechargements
- Les conversations plus vieilles que 30 jours sont automatiquement supprimées au chargement
- Chaque widget a sa propre clé de stockage : `sara_chat:sara-widget`, `sara_chat:support-chat`, `sara_chat:inapp-guide`

---
Task ID: 2
Agent: Main Agent
Task: IARH — Wiring up "lettre de demande d'emploi" (required) in /jobs application flow + Sarah auto-tracking + Co-pilot RH enhancements

Work Log:
- Investigation approfondie via subagent Explore : localisé les 4 sous-onglets IARH dans IaWorkspace.tsx (parse/matching/fraud/copilot), le contrôleur IA (ia-prisma.controller.ts), le service IA (ia-prisma.service.ts), le formulaire public /jobs (CareersContent.tsx), le contrôleur de recrutement (recruitment.controller.ts) et le service applyJob (recruitment.service.ts)
- Constaté que les tâches 1, 2, 3, 4, 5 étaient déjà fonctionnelles : SSE streaming opérationnel, image réelle Sarah (/images/SarahAI.png) déjà en place, persona "Assistante RH" déjà configurée, analyse CV via GLM-5.1 vision active, matching XAI opérationnel, détection fraude par anomalies active, boutons retour des pages détail RH naviguent déjà vers le bon onglet parent
- Backend (recruitment.controller.ts) : ajouté `applicationLetter` au FileFieldsInterceptor (maxCount: 1) + mis à jour la signature du handler `applyJob`
- Backend (recruitment.service.ts applyJob) :
  * Ajouté `hasApplicationLetter` + `applicationLetterName` + `applicationLetterPath` + `applicationLetterFile`
  * Upload du fichier dans `candidate-docs/${tenantId}/pending/application-letter`
  * Création d'un CandidateDocument avec `documentType: 'APPLICATION_LETTER'`
  * Enrichi le profil candidat envoyé à l'IA avec la mention des 2 lettres (lettre de demande d'emploi + lettre de motivation)
  * Mis à jour le prompt IA HDIE pour scorer les 2 lettres distinctement
  * Mis à jour la signature de `generateHeuristicScores` pour accepter les 2 lettres + avoir des bonus distincts (lettre demande +25, lettre motivation +15)
  * Mise à jour des 4 callsites de `generateHeuristicScores` (applyJob x3 + createApplication x1) pour la nouvelle signature
- Frontend (CareersContent.tsx) :
  * L'état `applicationLetterFile` était déjà déclaré mais jamais utilisé — wiring complet effectué
  * `canProceed()` step 5 exige maintenant `cvFile && applicationLetterFile`
  * Ajouté un bloc UI "Lettre de demande d'emploi *" (required) avec upload
  * Renommé l'ancien bloc "Lettre de motivation" en mentionnant "(optionnel)"
  * Ajouté un 4e bloc "Lettre de recommandation académique (optionnel)" dans la grille 2x2
  * Submit FormData inclut `applicationLetter` en plus de cv/coverLetter/recommendationLetter
  * Bouton submit désactivé si `!cvFile || !applicationLetterFile` avec label "CV + lettre de demande requis"
  * `resetForm()` efface aussi `applicationLetterFile`
  * Notice de processing + message de succès mentionnent explicitement Sarah et l'analyse automatique
- Backend (ia-prisma.service.ts) — Enhancement du Co-pilot RH (Sarah) :
  * Ajouté 2 méthodes privées : `getTopCandidatesForCopilot(tenantId, limit)` (récupère le top N candidats par score global avec détail des sous-scores et matchDetail) et `getAnomalySummaryForCopilot(tenantId)` (résumé anomalies par sévérité + top 3)
  * Les 2 méthodes copilotChatStream + copilotChat chargent maintenant ces données en parallèle avec les KPIs existants
  * Le system prompt de Sarah inclut désormais une section "SUIVI ET ANALYSE AUTOMATIQUE DES CANDIDATURES" qui :
    - Décrit sa mission première (traquer/récupérer/analyzer les 4 types de documents : CV obligatoire, lettre de demande obligatoire, lettre de motivation optionnelle, recommandation optionnelle)
    - Liste le TOP 3 candidats par score global avec détail des sous-scores et matchDetail
    - Affiche un résumé des anomalies détectées (total + par sévérité + top 3 anomalies)
    - Oriente Sarah vers les onglets IARH appropriés selon les questions
  * Mise à jour appliquée à la fois sur la version streaming (copilotChatStream) ET la version non-streaming (copilotChat)
- Frontend (IaWorkspace.tsx) — Co-pilot RH presets enrichis :
  * Ajouté "Dernières analyses auto" (prompt détaillé demandant top 3 + scores matching)
  * Ajouté "Anomalies détectées" (prompt sur les risques de fraude)
  * Renommé "Quels sont les meilleurs candidats ?" en "Meilleurs candidats" (plus court pour le scroll horizontal)

Stage Summary:
- 5 fichiers modifiés (api-server: ia-prisma.service.ts, recruitment.controller.ts, recruitment.service.ts ; web-app: IaWorkspace.tsx, CareersContent.tsx)
- +238 lignes, -34 lignes
- Le portail /jobs accepte maintenant 4 documents : CV (requis), lettre de demande d'emploi (requis), lettre de motivation (optionnel), lettre de recommandation académique (optionnel)
- Le backend applyJob analyse automatiquement via GLM-5.1 : score CV, score lettre, score matching, score global, matchDetail, risks, riskDetail — stockés dans HrApplication + HrAiReport
- Sarah (Co-pilot RH) a maintenant accès en temps réel au TOP 3 candidats et au résumé des anomalies — elle peut répondre précisément quand on lui demande les dernières candidatures analysées
- Sarah mentionne explicitement les 4 types de documents et leur caractère obligatoire/optionnel dans son system prompt
- SSE streaming, image Sarah réelle et persona "Assistante RH" déjà en place — confirmés fonctionnels

---
Task ID: 3
Agent: Main Agent
Task: Fix Détection fraude ID display + restore contract sign/edit/preview features + fix "expiré" bug on unsigned contracts

Work Log:
- Investigated the IARH "Détection fraude" sub-tab issue: identified that ia-prisma.service.ts detectFraud() was appending the raw candidate UUID in parentheses when grouping by email/phone duplicates (`${c.firstName} ${c.lastName} (${c.id})`). The UI showed "Aurore Akpovi (uuid)" instead of "Aurore Akpovi".
- Investigated the contract issues: identified that the contract detail page (apps/web-app/src/app/app/hr/contracts/[id]/page.tsx) had LOST three features that were present in commit c9e301da:
  * ContractEditModal (edit dates/salary/payment mode) — imports & button removed
  * ContractDocumentEditor (edit articles of the contract) — imports & button removed
  * In-app PDF preview iframe — entire section removed
- Investigated the "expiré" bug: identified that the backend ContractsPrismaService.createContract() was auto-expiring ALL existing ACTIVE and PENDING contracts when a new one was created. So if a user accidentally created two contracts for the same staff, the first PENDING (unsigned) one became EXPIRED. Then the sign button (which required `status === 'ACTIVE'`) never appeared, leaving the contract stuck.
- Investigated the sign button condition: it was `contract.status === 'ACTIVE'` but contracts start as `PENDING` (per commit c64e1ba2) and only become `ACTIVE` after signing. So the button was unreachable.

Backend fixes (api-server):
- ia-prisma.service.ts detectFraud(): removed `(${c.id})` from email and phone duplicate grouping — only the readable name is now returned.
- contracts-prisma.service.ts createContract(): changed `status: { in: ['ACTIVE', 'PENDING'] }` → `status: 'ACTIVE'`. Only ACTIVE contracts get auto-expired when a new one is created. PENDING (unsigned) contracts stay PENDING and can coexist with a new contract (so the user can choose which one to sign).
- contracts-prisma.service.ts: added new `reactivateContract(id, tenantId)` method that reactivates an unsigned EXPIRED contract → PENDING. Guards: rejects already-signed contracts and non-EXPIRED statuses.
- contracts-prisma.controller.ts: added new `PUT /hr/contracts/:id/reactivate` endpoint.

Frontend fixes (web-app):
- contracts/[id]/page.tsx (full rewrite of the action bar + restoration of lost features):
  * Re-imported ContractEditModal, ContractDocumentEditor, Pencil/Eye/RotateCcw icons
  * Added state: editModalOpen, docEditorOpen, pdfPreviewUrl, loadingPreview, reactivating
  * Added loadPdfPreview() function with auth header + 401 token-refresh retry + auto-generate fallback
  * Added "Éditer le document" button → opens ContractDocumentEditor (when !isSigned)
  * Added "Modifier les infos" button → opens ContractEditModal (when !isSigned)
  * Added "Réactiver" button → calls PUT /contracts/:id/reactivate (when contract is EXPIRED and !isSigned)
  * Added "Signer le contrat" button — condition is now `!isSigned && (PENDING || ACTIVE || DRAFT)` instead of just `ACTIVE`
  * Added reactivation helper banner explaining the flow for unsigned EXPIRED contracts
  * Restored in-app PDF preview section at the bottom (iframe + "Charger l'aperçu" button + "Actualiser" button)
- ContractsWorkspace.tsx: replaced `STATUS_CONFIG[x] || STATUS_CONFIG.EXPIRED` (which falsely labelled unknown statuses as 'Expiré') with a neutral `STATUS_FALLBACK` ('En attente', amber style).
- staff/[id]/page.tsx (contracts tab):
  * Each contract card is now a clickable Link to /app/hr/contracts/[id] (was just a static div)
  * Replaced raw status display with a readable statusMap (PENDING → 'En attente de signature', DRAFT → same, etc.)
  * Added "(non signé)" badge when contract.signedAt is null
  * Added "Ouvrir le contrat →" link label
  * Imported `Link` from 'next/link'

Verification:
- TypeScript check: no NEW errors introduced by these changes (pre-existing environment errors about missing React/NestJS type declarations remain, but they are not caused by this commit).
- All 6 modified files commit cleanly together (commit 8320b2c5).

Stage Summary:
- 6 files modified (+336, -33)
- Détection fraude now displays readable candidate names instead of UUIDs
- Contracts module fully restored: edit modal + document editor + in-app PDF preview + sign button (for PENDING/ACTIVE/DRAFT) + reactivate button (for unsigned EXPIRED)
- Backend no longer auto-expires unsigned PENDING contracts — they remain signable
- Legacy unsigned EXPIRED contracts can be reactivated to PENDING via the new endpoint and the "Réactiver" button on the contract detail page
- Staff detail page now links directly to each contract's detail page with proper status labels
