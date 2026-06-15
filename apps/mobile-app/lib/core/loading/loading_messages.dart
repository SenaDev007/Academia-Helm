/// ============================================================================
/// LOADING MESSAGES — Academia Hub Mobile
/// ============================================================================
///
/// Loading messages matching the web app's loading-messages.ts.
/// All text in FRENCH. Provides contextual messages for:
/// - 6-step post-login flow
/// - Module-specific contexts (finance, examens, pédagogie, orion, élèves, paiements)
/// - Error messages (timeout, network, auth, tenant)
/// ============================================================================

// ─── Loading Context ─────────────────────────────────────────────────────────

/// Context for loading messages, matching the web app's LoadingContext.
enum LoadingContext {
  postLogin,
  moduleSwitch,
  offlineSync,
  orionAnalysis,
  dashboard,
  finance,
  examens,
  pedagogie,
  orion,
  eleves,
  paiements,
  grades,
  settings,
  messages,
}

// ─── Post-Login Flow Steps ───────────────────────────────────────────────────

/// The 6 steps of the post-login flow, matching the web app.
enum PostLoginStep {
  initSecureContext,
  verifyAcademicYear,
  loadRolesPermissions,
  checkOfflineStatus,
  initOrion,
  preloadUI;

  String get title {
    switch (this) {
      case PostLoginStep.initSecureContext:
        return 'Initialisation du contexte sécurisé';
      case PostLoginStep.verifyAcademicYear:
        return 'Vérification de l\'année scolaire';
      case PostLoginStep.loadRolesPermissions:
        return 'Chargement des rôles et permissions';
      case PostLoginStep.checkOfflineStatus:
        return 'Vérification du mode hors-ligne';
      case PostLoginStep.initOrion:
        return 'Initialisation d\'Orion';
      case PostLoginStep.preloadUI:
        return 'Préchargement de l\'interface';
    }
  }

  String get subtitle {
    switch (this) {
      case PostLoginStep.initSecureContext:
        return 'Configuration de votre espace de travail...';
      case PostLoginStep.verifyAcademicYear:
        return 'Synchronisation avec l\'année scolaire en cours...';
      case PostLoginStep.loadRolesPermissions:
        return 'Récupération de vos accès et autorisations...';
      case PostLoginStep.checkOfflineStatus:
        return 'Vérification des données locales...';
      case PostLoginStep.initOrion:
        return 'Démarrage du module d\'intelligence artificielle...';
      case PostLoginStep.preloadUI:
        return 'Préparation de votre tableau de bord...';
    }
  }

  /// Approximate progress percentage for each step.
  double get progress {
    switch (this) {
      case PostLoginStep.initSecureContext:
        return 10.0;
      case PostLoginStep.verifyAcademicYear:
        return 25.0;
      case PostLoginStep.loadRolesPermissions:
        return 40.0;
      case PostLoginStep.checkOfflineStatus:
        return 55.0;
      case PostLoginStep.initOrion:
        return 70.0;
      case PostLoginStep.preloadUI:
        return 85.0;
    }
  }
}

// ─── Post-Login Flow Messages ────────────────────────────────────────────────

/// Complete set of 6-step post-login flow messages.
class PostLoginMessages {
  final String title;
  final String subtitle;
  final double progress;

  const PostLoginMessages({
    required this.title,
    required this.subtitle,
    required this.progress,
  });
}

/// Returns the loading message for a given post-login step.
PostLoginMessages getPostLoginMessage(PostLoginStep step) {
  return PostLoginMessages(
    title: step.title,
    subtitle: step.subtitle,
    progress: step.progress,
  );
}

// ─── Contextual Messages ─────────────────────────────────────────────────────

/// Messages for each loading context.
const Map<LoadingContext, List<_ContextMessage>> _contextMessages = {
  LoadingContext.postLogin: [
    _ContextMessage('Connexion en cours', 'Vérification de vos identifiants...'),
    _ContextMessage('Authentification réussie', 'Chargement de votre profil...'),
    _ContextMessage('Préparation de votre espace', 'Presque terminé...'),
  ],
  LoadingContext.moduleSwitch: [
    _ContextMessage('Changement de module', 'Chargement des données...'),
    _ContextMessage('Transition', 'Mise à jour de l\'affichage...'),
    _ContextMessage('Presque prêt', 'Finalisation du chargement...'),
  ],
  LoadingContext.offlineSync: [
    _ContextMessage('Synchronisation hors-ligne', 'Récupération des données en attente...'),
    _ContextMessage('Synchronisation', 'Mise à jour des données locales...'),
    _ContextMessage('Presque synchronisé', 'Application des modifications...'),
  ],
  LoadingContext.orionAnalysis: [
    _ContextMessage('Orion analyse vos données', 'Détection des tendances...'),
    _ContextMessage('Analyse en cours', 'Génération des prédictions...'),
    _ContextMessage('Rapport en préparation', 'Synthèse des résultats...'),
  ],
  LoadingContext.dashboard: [
    _ContextMessage('Tableau de bord', 'Chargement des indicateurs...'),
    _ContextMessage('Statistiques', 'Calcul des métriques en temps réel...'),
    _ContextMessage('Vue d\'ensemble', 'Actualisation des données...'),
  ],
  LoadingContext.finance: [
    _ContextMessage('Module Finance', 'Chargement des données financières...'),
    _ContextMessage('Rapports financiers', 'Calcul des soldes et totaux...'),
    _ContextMessage('Trésorerie', 'Mise à jour des paiements...'),
  ],
  LoadingContext.examens: [
    _ContextMessage('Module Examens', 'Chargement du planning d\'examens...'),
    _ContextMessage('Résultats', 'Calcul des moyennes et statistiques...'),
    _ContextMessage('Bulletins', 'Préparation des relevés de notes...'),
  ],
  LoadingContext.pedagogie: [
    _ContextMessage('Module Pédagogie', 'Chargement des progressions...'),
    _ContextMessage('Leçons', 'Récupération des contenus pédagogiques...'),
    _ContextMessage('Devoirs', 'Actualisation des évaluations...'),
  ],
  LoadingContext.orion: [
    _ContextMessage('Orion IA', 'Initialisation du moteur d\'analyse...'),
    _ContextMessage('Analyse prédictive', 'Traitement des données scolaires...'),
    _ContextMessage('Alertes', 'Vérification des anomalies détectées...'),
  ],
  LoadingContext.eleves: [
    _ContextMessage('Module Élèves', 'Chargement de la liste des élèves...'),
    _ContextMessage('Inscriptions', 'Vérification des dossiers...'),
    _ContextMessage('Présence', 'Actualisation des données d\'assiduité...'),
  ],
  LoadingContext.paiements: [
    _ContextMessage('Paiements', 'Chargement des transactions...'),
    _ContextMessage('Facturation', 'Récupération des factures...'),
    _ContextMessage('Reçus', 'Mise à jour des quittances...'),
  ],
  LoadingContext.grades: [
    _ContextMessage('Notes', 'Chargement des évaluations...'),
    _ContextMessage('Bulletins', 'Calcul des moyennes...'),
    _ContextMessage('Statistiques', 'Analyse des résultats...'),
  ],
  LoadingContext.settings: [
    _ContextMessage('Paramètres', 'Chargement de la configuration...'),
    _ContextMessage('Année scolaire', 'Récupération des paramètres...'),
    _ContextMessage('Classes', 'Mise à jour de la structure...'),
  ],
  LoadingContext.messages: [
    _ContextMessage('Messages', 'Chargement de la boîte de réception...'),
    _ContextMessage('Notifications', 'Récupération des avis...'),
    _ContextMessage('Communications', 'Actualisation des échanges...'),
  ],
};

/// Returns a contextual loading message for the given context.
/// [index] cycles through available messages.
_MessagePair getContextualMessage(LoadingContext context, {int index = 0}) {
  final messages = _contextMessages[context] ?? _contextMessages[LoadingContext.postLogin]!;
  final i = index % messages.length;
  return _MessagePair(messages[i].title, messages[i].subtitle);
}

/// Returns all contextual messages for a given context.
List<_MessagePair> getContextualMessages(LoadingContext context) {
  final messages = _contextMessages[context] ?? _contextMessages[LoadingContext.postLogin]!;
  return messages.map((m) => _MessagePair(m.title, m.subtitle)).toList();
}

// ─── Error Messages ──────────────────────────────────────────────────────────

/// Error loading messages.
class LoadingErrorMessages {
  // Timeout errors
  static const String timeoutTitle = 'Délai dépassé';
  static const String timeoutSubtitle =
      'Le serveur met trop de temps à répondre. Veuillez réessayer.';

  // Network errors
  static const String networkTitle = 'Erreur de connexion';
  static const String networkSubtitle =
      'Vérifiez votre connexion internet et réessayez.';

  // Auth errors
  static const String authTitle = 'Session expirée';
  static const String authSubtitle =
      'Votre session a expiré. Veuillez vous reconnecter.';

  // Tenant errors
  static const String tenantTitle = 'Établissement introuvable';
  static const String tenantSubtitle =
      'Impossible de charger les données de l\'établissement. Veuillez réessayer.';

  // Generic errors
  static const String genericTitle = 'Erreur de chargement';
  static const String genericSubtitle =
      'Une erreur inattendue s\'est produite. Veuillez réessayer.';

  // Offline
  static const String offlineTitle = 'Mode hors-ligne';
  static const String offlineSubtitle =
      'Certaines fonctionnalités peuvent être limitées.';

  // Refresh
  static const String refreshTitle = 'Actualisation';
  static const String refreshSubtitle = 'Nouvelle tentative en cours...';
}

// ─── Internal Types ──────────────────────────────────────────────────────────

class _ContextMessage {
  final String title;
  final String subtitle;
  const _ContextMessage(this.title, this.subtitle);
}

class _MessagePair {
  final String title;
  final String subtitle;
  const _MessagePair(this.title, this.subtitle);
}
