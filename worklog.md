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
