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
