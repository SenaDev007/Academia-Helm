import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'settings');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'settings-dashboard':
            return _buildDashboardContent(context);
          case 'settings-general':
            return _buildGeneralContent(context);
          case 'settings-academic-year':
            return _buildAcademicYearContent(context);
          case 'settings-classes':
            return _buildClassesContent(context);
          case 'settings-subjects':
            return _buildSubjectsContent(context);
          case 'settings-periods':
            return _buildPeriodsContent(context);
          case 'settings-grading':
            return _buildGradingContent(context);
          case 'settings-rooms':
            return _buildRoomsContent(context);
          case 'settings-roles':
            return _buildRolesContent(context);
          case 'settings-permissions':
            return _buildPermissionsContent(context);
          case 'settings-features':
            return _buildFeaturesContent(context);
          case 'settings-import':
            return _buildImportContent(context);
          case 'settings-export':
            return _buildExportContent(context);
          case 'settings-backup':
            return _buildBackupContent(context);
          case 'settings-advanced':
            return _buildAdvancedContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Paramètres'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Classes configurées', value: '48', icon: Icons.class_, subtitle: '6 niveaux'),
        StatCard(title: 'Matières actives', value: '16', icon: Icons.book, iconColor: AHColors.info),
        StatCard(title: 'Rôles définis', value: '7', icon: Icons.shield, iconColor: AHColors.gold),
        StatCard(title: 'Dernière sauvegarde', value: 'Auj.', icon: Icons.cloud_done, iconColor: AHColors.success, subtitle: '10/03/2025 23h'),
      ]),
    ]);
  }

  Widget _buildGeneralContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres généraux'),
      ...[
        ListItemCard(title: 'Nom de l\'établissement', subtitle: 'Lycée Academia Paris', leadingIcon: Icons.business, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Adresse', subtitle: '12 Rue des Écoles, 75005 Paris', leadingIcon: Icons.location_on, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Téléphone', subtitle: '+33 1 23 45 67 89', leadingIcon: Icons.phone, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Logo', subtitle: 'Dernière mise à jour: 01/09/2024', leadingIcon: Icons.image, leadingIconColor: AHColors.gold),
      ],
    ]);
  }

  Widget _buildAcademicYearContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Année scolaire'),
      ...[
        ListItemCard(title: 'Année 2024-2025', subtitle: '02/09/2024 - 04/07/2025', leadingIcon: Icons.calendar_today, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.success)),
        ListItemCard(title: 'Trimestre 2', subtitle: '06/01/2025 - 28/03/2025', leadingIcon: Icons.calendar_month, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Trimestre 3', subtitle: '14/04/2025 - 04/07/2025', leadingIcon: Icons.calendar_month, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral)),
        ListItemCard(title: 'Année 2025-2026', subtitle: '01/09/2025 - 03/07/2026', leadingIcon: Icons.calendar_today, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildClassesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Classes'),
      ...[
        ListItemCard(title: '6ème A, B, C', subtitle: '3 classes - 78 élèves', leadingIcon: Icons.class_, leadingIconColor: AHColors.info),
        ListItemCard(title: '4ème A, B, C, D', subtitle: '4 classes - 112 élèves', leadingIcon: Icons.class_, leadingIconColor: AHColors.info),
        ListItemCard(title: '3ème A, B, C', subtitle: '3 classes - 89 élèves', leadingIcon: Icons.class_, leadingIconColor: AHColors.gold),
        ListItemCard(title: '2nde A, B', subtitle: '2 classes - 56 élèves', leadingIcon: Icons.class_, leadingIconColor: AHColors.navy),
      ],
    ]);
  }

  Widget _buildSubjectsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Matières'),
      ...[
        ListItemCard(title: 'Mathématiques', subtitle: 'Coefficient: 4 - Toutes classes', leadingIcon: Icons.calculate, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Français', subtitle: 'Coefficient: 4 - Toutes classes', leadingIcon: Icons.menu_book, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Physique-Chimie', subtitle: 'Coefficient: 3 - 3ème et +', leadingIcon: Icons.science, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Anglais', subtitle: 'Coefficient: 3 - Toutes classes', leadingIcon: Icons.language, leadingIconColor: AHColors.success),
      ],
    ]);
  }

  Widget _buildPeriodsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Périodes'),
      ...[
        ListItemCard(title: 'Trimestre 1', subtitle: '02/09/2024 - 20/12/2024 - Terminé', leadingIcon: Icons.schedule, badge: StatusBadge(label: 'Terminé', type: StatusBadgeType.neutral)),
        ListItemCard(title: 'Trimestre 2', subtitle: '06/01/2025 - 28/03/2025 - En cours', leadingIcon: Icons.schedule, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Trimestre 3', subtitle: '14/04/2025 - 04/07/2025 - À venir', leadingIcon: Icons.schedule, badge: StatusBadge(label: 'À venir', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildGradingContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Notation'),
      ...[
        ListItemCard(title: 'Barème par défaut', subtitle: '0 à 20 - Notes entières et demi-points', leadingIcon: Icons.straighten, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Coefficients matière', subtitle: 'De 1 à 5 - Configurables par classe', leadingIcon: Icons.tune, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Arrondi des moyennes', subtitle: 'Au dixième le plus proche', leadingIcon: Icons.rule, leadingIconColor: AHColors.gold),
        ListItemCard(title: 'Appréciations automatiques', subtitle: 'Seuils: <8: Insuffisant, 8-10: Passable, etc.', leadingIcon: Icons.auto_awesome, leadingIconColor: AHColors.success),
      ],
    ]);
  }

  Widget _buildRoomsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Salles'),
      ...[
        ListItemCard(title: 'Salle 101 - Bâtiment A', subtitle: 'Capacité: 30 places - Vidéoprojecteur', leadingIcon: Icons.meeting_room, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Labo Physique - Bâtiment B', subtitle: 'Capacité: 20 places - Équipement labo', leadingIcon: Icons.science, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'CDI', subtitle: 'Capacité: 50 places - Bibliothèque', leadingIcon: Icons.local_library, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Gymnase', subtitle: 'Capacité: 100 places - Sport', leadingIcon: Icons.sports_basketball, badge: StatusBadge(label: 'Occupé', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildRolesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rôles'),
      ...[
        ListItemCard(title: 'Chef d\'établissement', subtitle: 'Accès complet - 1 utilisateur', leadingIcon: Icons.admin_panel_settings, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Admin', type: StatusBadgeType.error)),
        ListItemCard(title: 'Directeur adjoint', subtitle: 'Accès étendu - 2 utilisateurs', leadingIcon: Icons.manage_accounts, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'Élevé', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Enseignant', subtitle: 'Accès pédagogique - 42 utilisateurs', leadingIcon: Icons.school, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Standard', type: StatusBadgeType.info)),
        ListItemCard(title: 'CPE', subtitle: 'Vie scolaire - 3 utilisateurs', leadingIcon: Icons.supervised_user_circle, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Standard', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildPermissionsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Permissions'),
      ...[
        ListItemCard(title: 'Gestion des notes', subtitle: 'Enseignants, CPE, Direction', leadingIcon: Icons.lock, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'Protégé', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Modification emplois du temps', subtitle: 'Direction uniquement', leadingIcon: Icons.lock, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Restreint', type: StatusBadgeType.error)),
        ListItemCard(title: 'Consultation dossiers élèves', subtitle: 'Direction, CPE, Infirmier', leadingIcon: Icons.lock_open, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Modéré', type: StatusBadgeType.info)),
        ListItemCard(title: 'Accès boutique', subtitle: 'Tous les utilisateurs', leadingIcon: Icons.lock_open, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Public', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildFeaturesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Fonctionnalités'),
      ...[
        ListItemCard(title: 'Module Élèves', subtitle: 'Activé - Toutes les fonctionnalités', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Module Finance', subtitle: 'Activé - Facturation & paiements', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Module Cantine', subtitle: 'Activé - Menus & réservations', leadingIcon: Icons.toggle_on, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Module Boutique', subtitle: 'Phase bêta - Activation sur demande', leadingIcon: Icons.toggle_off, leadingIconColor: AHColors.muted, badge: StatusBadge(label: 'Beta', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildImportContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Import'),
      ...[
        ListItemCard(title: 'Import élèves', subtitle: 'CSV / Excel - Dernier import: 02/09/2024', leadingIcon: Icons.upload_file, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Import notes', subtitle: 'CSV / Excel - Dernier import: 20/12/2024', leadingIcon: Icons.upload_file, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Import enseignants', subtitle: 'CSV / Excel - Dernier import: 01/09/2024', leadingIcon: Icons.upload_file, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildExportContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Export'),
      ...[
        ListItemCard(title: 'Export bulletins scolaires', subtitle: 'PDF - Toutes classes', leadingIcon: Icons.download, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Export liste élèves', subtitle: 'CSV / Excel - Par classe', leadingIcon: Icons.download, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Export notes trimestrielles', subtitle: 'CSV / PDF - Par matière', leadingIcon: Icons.download, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Export présence', subtitle: 'CSV - Par période', leadingIcon: Icons.download, leadingIconColor: AHColors.info),
      ],
    ]);
  }

  Widget _buildBackupContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Sauvegarde'),
      ...[
        ListItemCard(title: 'Sauvegarde automatique', subtitle: 'Quotidienne - 23h00 - Dernière: 09/03/2025', leadingIcon: Icons.cloud_done, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)),
        ListItemCard(title: 'Sauvegarde manuelle', subtitle: 'Lancer une sauvegarde immédiate', leadingIcon: Icons.cloud_upload, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.info)),
        ListItemCard(title: 'Restauration', subtitle: 'Dernière restauration: 15/01/2025', leadingIcon: Icons.restore, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Attention', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildAdvancedContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres avancés'),
      ...[
        ListItemCard(title: 'Base de données', subtitle: 'SQLite - 245 MB - Optimisée', leadingIcon: Icons.storage, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Cache applicatif', subtitle: '12 MB - Dernière purge: 01/03/2025', leadingIcon: Icons.cached, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Mode débogage', subtitle: 'Désactivé - Production', leadingIcon: Icons.bug_report, leadingIconColor: AHColors.muted, badge: StatusBadge(label: 'Inactif', type: StatusBadgeType.neutral)),
        ListItemCard(title: 'Version application', subtitle: 'v2.4.1 - Build 2025.03.10', leadingIcon: Icons.info, leadingIconColor: AHColors.muted),
      ],
    ]);
  }
}
