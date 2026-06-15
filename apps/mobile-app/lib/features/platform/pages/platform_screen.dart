import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class PlatformScreen extends StatefulWidget {
  const PlatformScreen({super.key});

  @override
  State<PlatformScreen> createState() => _PlatformScreenState();
}

class _PlatformScreenState extends State<PlatformScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'platform');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'platform-dashboard':
            return _buildDashboardContent(context);
          case 'platform-tenants':
            return _buildTenantsContent(context);
          case 'platform-billing':
            return _buildBillingContent(context);
          case 'platform-audit':
            return _buildAuditContent(context);
          case 'platform-users':
            return _buildUsersContent(context);
          case 'platform-roles':
            return _buildRolesContent(context);
          case 'platform-features':
            return _buildFeaturesContent(context);
          case 'platform-licenses':
            return _buildLicensesContent(context);
          case 'platform-analytics':
            return _buildAnalyticsContent(context);
          case 'platform-support':
            return _buildSupportContent(context);
          case 'platform-logs':
            return _buildLogsContent(context);
          case 'platform-backups':
            return _buildBackupsContent(context);
          case 'platform-integrations':
            return _buildIntegrationsContent(context);
          case 'platform-api':
            return _buildApiContent(context);
          case 'platform-notifications':
            return _buildNotificationsContent(context);
          case 'platform-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Plateforme'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Établissements', value: '24', icon: Icons.business, subtitle: '+2 ce mois'),
        StatCard(title: 'Utilisateurs totaux', value: '5 432', icon: Icons.people, iconColor: AHColors.info, subtitle: 'Toutes plateformes'),
        StatCard(title: 'Revenus mensuels', value: '48.5K €', icon: Icons.euro, iconColor: AHColors.success, subtitle: '+8% vs mois dernier'),
        StatCard(title: 'Tickets support', value: '12', icon: Icons.support_agent, iconColor: AHColors.warning, subtitle: '3 critiques'),
      ]),
    ]);
  }

  Widget _buildTenantsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Établissements'),
      ...[
        ListItemCard(title: 'Lycée Academia Paris', subtitle: 'Plan Premium - 1 247 élèves - Actif', leadingIcon: Icons.business, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Collège Academia Lyon', subtitle: 'Plan Standard - 890 élèves - Actif', leadingIcon: Icons.business, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'École Academia Marseille', subtitle: 'Plan Essentiel - 456 élèves - Actif', leadingIcon: Icons.business, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Institut Academia Lille', subtitle: 'Plan Premium - En configuration', leadingIcon: Icons.business, badge: StatusBadge(label: 'Configuration', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildBillingContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Facturation'),
      ...[
        ListItemCard(title: 'Facture #F-2025-0345', subtitle: 'Lycée Paris - 2 450 € - Échéance: 31/03/2025', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Facture #F-2025-0344', subtitle: 'Collège Lyon - 1 200 € - Payée le 05/03', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success)),
        ListItemCard(title: 'Facture #F-2025-0343', subtitle: 'École Marseille - 650 € - Payée le 01/03', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildAuditContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Audit'),
      ...[
        ListItemCard(title: 'Connexion admin - Lycée Paris', subtitle: 'm.durand - 10/03/2025 09:45', leadingIcon: Icons.shield_check, badge: StatusBadge(label: 'Légitime', type: StatusBadgeType.success)),
        ListItemCard(title: 'Modification permissions - Lyon', subtitle: 'Rôle modifié par admin - 09/03/2025 16:30', leadingIcon: Icons.shield_check, badge: StatusBadge(label: 'Vérifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Tentative accès refusée', subtitle: 'IP: 192.168.x.x - 08/03/2025 22:15', leadingIcon: Icons.shield_check, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Bloqué', type: StatusBadgeType.error)),
        ListItemCard(title: 'Export données - Marseille', subtitle: 'Export CSV par admin - 07/03/2025 14:00', leadingIcon: Icons.shield_check, badge: StatusBadge(label: 'Autorisé', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildUsersContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Utilisateurs'),
      ...[
        ListItemCard(title: 'Marie-Claire Durand', subtitle: 'Admin - Lycée Paris - Dernière connexion: 10/03', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Jean-Pierre Martin', subtitle: 'Admin - Collège Lyon - Dernière connexion: 09/03', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Sophie Petit', subtitle: 'Directeur - École Marseille - Dernière connexion: 08/03', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Compte orphelin #4521', subtitle: 'Sans établissement - Inactif depuis 30j', leadingIcon: Icons.person_off, badge: StatusBadge(label: 'Inactif', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildRolesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rôles'),
      ...[
        ListItemCard(title: 'Super Administrateur', subtitle: 'Accès complet - 2 utilisateurs', leadingIcon: Icons.admin_panel_settings, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Critique', type: StatusBadgeType.error)),
        ListItemCard(title: 'Administrateur Établissement', subtitle: 'Gestion complète - 24 utilisateurs', leadingIcon: Icons.manage_accounts, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'Élevé', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Enseignant', subtitle: 'Accès pédagogique - 1 008 utilisateurs', leadingIcon: Icons.school, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Standard', type: StatusBadgeType.info)),
        ListItemCard(title: 'Parent', subtitle: 'Accès consultation - 4 398 utilisateurs', leadingIcon: Icons.family_restroom, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Limité', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildFeaturesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Fonctionnalités'),
      ...[
        ListItemCard(title: 'Module Cantine', subtitle: 'Activé pour 18/24 établissements', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Module QHSE', subtitle: 'Activé pour 12/24 établissements', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Module EduCast', subtitle: 'Activé pour 8/24 établissements', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Partiel', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Module Boutique', subtitle: 'Activé pour 6/24 établissements', leadingIcon: Icons.toggle_off, leadingIconColor: AHColors.muted, badge: StatusBadge(label: 'Beta', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildLicensesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Licences'),
      ...[
        ListItemCard(title: 'Licence Premium - Lycée Paris', subtitle: 'Valide jusqu\'au 31/08/2025 - 1 500 places', leadingIcon: Icons.key, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Licence Standard - Collège Lyon', subtitle: 'Valide jusqu\'au 31/08/2025 - 1 000 places', leadingIcon: Icons.key, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Licence Essentiel - École Marseille', subtitle: 'Valide jusqu\'au 31/08/2025 - 500 places', leadingIcon: Icons.key, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildAnalyticsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Analytique Plateforme'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Utilisateurs actifs/jour', value: '2 340', icon: Icons.people, subtitle: 'Moyenne 7 jours'),
        StatCard(title: 'Sessions/jour', value: '8 920', icon: Icons.touch_app, iconColor: AHColors.info),
        StatCard(title: 'Temps moyen session', value: '12 min', icon: Icons.timer, iconColor: AHColors.success),
        StatCard(title: 'Taux de rétention', value: '78%', icon: Icons.refresh, iconColor: AHColors.gold, subtitle: 'Mensuel'),
      ]),
    ]);
  }

  Widget _buildSupportContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Support'),
      ...[
        ListItemCard(title: 'Ticket #T-4521 - Lycée Paris', subtitle: 'Erreur export notes - Priorité: Haute', leadingIcon: Icons.support_agent, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Critique', type: StatusBadgeType.error)),
        ListItemCard(title: 'Ticket #T-4520 - Collège Lyon', subtitle: 'Problème connexion - Priorité: Moyenne', leadingIcon: Icons.support_agent, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Ticket #T-4519 - École Marseille', subtitle: 'Demande formation - Priorité: Basse', leadingIcon: Icons.support_agent, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Ouvert', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildLogsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Journaux'),
      ...[
        ListItemCard(title: '[INFO] Déploiement v2.4.1', subtitle: '10/03/2025 06:00 - Succès', leadingIcon: Icons.description, badge: StatusBadge(label: 'Info', type: StatusBadgeType.info)),
        ListItemCard(title: '[WARN] Latence API élevée', subtitle: '10/03/2025 09:45 - 450ms avg', leadingIcon: Icons.description, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Attention', type: StatusBadgeType.warning)),
        ListItemCard(title: '[ERROR] Échec sauvegarde Lille', subtitle: '09/03/2025 23:00 - Retry planifié', leadingIcon: Icons.description, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Erreur', type: StatusBadgeType.error)),
        ListItemCard(title: '[INFO] Maintenance planifiée', subtitle: '15/03/2025 02:00-04:00', leadingIcon: Icons.description, badge: StatusBadge(label: 'Info', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildBackupsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Sauvegardes'),
      ...[
        ListItemCard(title: 'Sauvegarde complète - 10/03/2025', subtitle: '2.3 GB - Status: Succès', leadingIcon: Icons.cloud_done, badge: StatusBadge(label: 'Complète', type: StatusBadgeType.success)),
        ListItemCard(title: 'Sauvegarde incrémentale - 09/03/2025', subtitle: '150 MB - Status: Succès', leadingIcon: Icons.cloud_done, badge: StatusBadge(label: 'Incrémentale', type: StatusBadgeType.info)),
        ListItemCard(title: 'Sauvegarde complète - 08/03/2025', subtitle: '2.3 GB - Status: Succès', leadingIcon: Icons.cloud_done, badge: StatusBadge(label: 'Complète', type: StatusBadgeType.success)),
        ListItemCard(title: 'Sauvegarde Lille - 09/03/2025', subtitle: 'Échec - Prochaine tentative: 10/03 23h', leadingIcon: Icons.cloud_off, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Échouée', type: StatusBadgeType.error)),
      ],
    ]);
  }

  Widget _buildIntegrationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Intégrations'),
      ...[
        ListItemCard(title: 'Google Workspace', subtitle: 'Connecté - Synchronisation active', leadingIcon: Icons.link, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Connecté', type: StatusBadgeType.success)),
        ListItemCard(title: 'Microsoft Teams', subtitle: 'Connecté - Synchronisation active', leadingIcon: Icons.link, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Connecté', type: StatusBadgeType.success)),
        ListItemCard(title: 'Librairie Éducative Nationale', subtitle: 'Configuration requise', leadingIcon: Icons.link_off, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildApiContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'API'),
      ...[
        ListItemCard(title: 'Clé API - Lycée Paris', subtitle: 'Créée: 15/01/2025 - Dernière utilisation: 10/03', leadingIcon: Icons.code, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Clé API - Collège Lyon', subtitle: 'Créée: 20/02/2025 - Dernière utilisation: 09/03', leadingIcon: Icons.code, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Webhook - Notifications', subtitle: 'Endpoint: /api/webhooks/notify', leadingIcon: Icons.webhook, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildNotificationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Notifications Plateforme'),
      ...[
        ListItemCard(title: 'Alerte sauvegarde échouée', subtitle: 'Établissement Lille - 09/03/2025 23:00', leadingIcon: Icons.notification_important, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Critique', type: StatusBadgeType.error)),
        ListItemCard(title: 'Nouvel établissement inscrit', subtitle: 'Institut Lille - 10/03/2025 08:00', leadingIcon: Icons.notification_important, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Info', type: StatusBadgeType.info)),
        ListItemCard(title: 'Licence expirant bientôt', subtitle: 'École Marseille - Expire: 31/08/2025', leadingIcon: Icons.notification_important, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Rappel', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres Plateforme'),
      ...[
        ListItemCard(title: 'Mode maintenance', subtitle: 'Désactivé', leadingIcon: Icons.build, leadingIconColor: AHColors.muted, badge: StatusBadge(label: 'Inactif', type: StatusBadgeType.neutral)),
        ListItemCard(title: 'Fréquence sauvegardes', subtitle: 'Quotidienne - 23h00', leadingIcon: Icons.schedule, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Politique mots de passe', subtitle: 'Min. 12 caractères, majuscule, chiffre', leadingIcon: Icons.password, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Rétention données', subtitle: '5 ans - Conformité RGPD', leadingIcon: Icons.security, leadingIconColor: AHColors.info),
      ],
    ]);
  }
}
