import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class QhseScreen extends StatefulWidget {
  const QhseScreen({super.key});

  @override
  State<QhseScreen> createState() => _QhseScreenState();
}

class _QhseScreenState extends State<QhseScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'qhse');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'qhse-dashboard':
            return _buildDashboardContent(context);
          case 'qhse-risks':
            return _buildRisksContent(context);
          case 'qhse-inspections':
            return _buildInspectionsContent(context);
          case 'qhse-incidents':
            return _buildIncidentsContent(context);
          case 'qhse-actions':
            return _buildActionsContent(context);
          case 'qhse-audits':
            return _buildAuditsContent(context);
          case 'qhse-documents':
            return _buildDocumentsContent(context);
          case 'qhse-training':
            return _buildTrainingContent(context);
          case 'qhse-regulations':
            return _buildRegulationsContent(context);
          case 'qhse-indicators':
            return _buildIndicatorsContent(context);
          case 'qhse-nonconformities':
            return _buildNonconformitiesContent(context);
          case 'qhse-permits':
            return _buildPermitsContent(context);
          case 'qhse-reports':
            return _buildReportsContent(context);
          case 'qhse-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord QHSE'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Inspections ce mois', value: '8', icon: Icons.search, subtitle: '3 planifiées'),
        StatCard(title: 'Incidents ouverts', value: '4', icon: Icons.alert_octagon, iconColor: AHColors.error, subtitle: '2 critiques'),
        StatCard(title: 'Taux conformité', value: '92%', icon: Icons.verified, iconColor: AHColors.success, subtitle: '+3% vs T3'),
        StatCard(title: 'Actions en cours', value: '12', icon: Icons.build_circle, iconColor: AHColors.warning, subtitle: '5 en retard'),
      ]),
    ]);
  }

  Widget _buildRisksContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Risques'),
      ...[
        ListItemCard(title: 'Risque chimique - Labo sciences', subtitle: 'Niveau: Élevé - Dernière éval: 15/01/2025', leadingIcon: Icons.science, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Élevé', type: StatusBadgeType.error)),
        ListItemCard(title: 'Risque incendie - Cuisine', subtitle: 'Niveau: Moyen - Dernière éval: 20/02/2025', leadingIcon: Icons.local_fire_department, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Moyen', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Risque mécanique - Atelier', subtitle: 'Niveau: Faible - Dernière éval: 10/03/2025', leadingIcon: Icons.construction, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Faible', type: StatusBadgeType.info)),
        ListItemCard(title: 'Risque électrique - Bâtiment B', subtitle: 'Niveau: Moyen - Dernière éval: 05/02/2025', leadingIcon: Icons.electrical_services, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Moyen', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildInspectionsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Inspections'),
      ...[
        ListItemCard(title: 'Inspection cuisine', subtitle: 'Planifiée: 15/03/2025 - Hygiène alimentaire', leadingIcon: Icons.search, badge: StatusBadge(label: 'Planifiée', type: StatusBadgeType.info)),
        ListItemCard(title: 'Inspection incendie', subtitle: 'Planifiée: 20/03/2025 - Extincteurs & sorties', leadingIcon: Icons.search, badge: StatusBadge(label: 'Planifiée', type: StatusBadgeType.info)),
        ListItemCard(title: 'Inspection labo sciences', subtitle: 'Réalisée: 01/03/2025 - Produits chimiques', leadingIcon: Icons.search, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
        ListItemCard(title: 'Inspection cour récréation', subtitle: 'Réalisée: 25/02/2025 - Sécurité sol', leadingIcon: Icons.search, badge: StatusBadge(label: 'Non-conforme', type: StatusBadgeType.error)),
      ],
    ]);
  }

  Widget _buildIncidentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Incidents'),
      ...[
        ListItemCard(title: 'Fuite produit chimique - Labo', subtitle: '10/03/2025 - Gravité: Critique', leadingIcon: Icons.alert_octagon, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Ouvert', type: StatusBadgeType.error)),
        ListItemCard(title: 'Porte incendie bloquée - Bât. C', subtitle: '08/03/2025 - Gravité: Élevée', leadingIcon: Icons.alert_octagon, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'En traitement', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Glissade réfectoire', subtitle: '05/03/2025 - Gravité: Faible', leadingIcon: Icons.alert_octagon, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Résolu', type: StatusBadgeType.success)),
        ListItemCard(title: 'Panne alarme incendie', subtitle: '02/03/2025 - Gravité: Élevée', leadingIcon: Icons.alert_octagon, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Résolu', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildActionsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Plans d\'action'),
      ...[
        ListItemCard(title: 'Remplacement porte incendie Bât. C', subtitle: 'Échéance: 20/03/2025 - Responsable: M. Durand', leadingIcon: Icons.build_circle, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Formation premiers secours équipe', subtitle: 'Échéance: 15/04/2025 - 12 participants', leadingIcon: Icons.build_circle, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Vérification installations électriques', subtitle: 'Échéance: 01/04/2025 - Prestataire: Socélec', leadingIcon: Icons.build_circle, badge: StatusBadge(label: 'En retard', type: StatusBadgeType.error)),
        ListItemCard(title: 'Mise à jour protocole évacuation', subtitle: 'Échéance: 10/03/2025 - Terminé', leadingIcon: Icons.build_circle, badge: StatusBadge(label: 'Terminé', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildAuditsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Audits'),
      ...[
        ListItemCard(title: 'Audit interne Q1 2025', subtitle: 'Planifié: 25/03/2025 - Responsable: Mme. Leblanc', leadingIcon: Icons.shield, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Audit externe certification', subtitle: 'Réalisé: 15/01/2025 - ISO 45001', leadingIcon: Icons.shield, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
        ListItemCard(title: 'Audit hygiène alimentaire', subtitle: 'Réalisé: 10/02/2025 - DDPP', leadingIcon: Icons.shield, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildDocumentsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Documents QHSE'),
      ...[
        ListItemCard(title: 'Plan d\'évacuation', subtitle: 'Version 3.2 - Mis à jour: 01/03/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'À jour', type: StatusBadgeType.success)),
        ListItemCard(title: 'Protocole gestion déchets', subtitle: 'Version 2.1 - Mis à jour: 15/02/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'À jour', type: StatusBadgeType.success)),
        ListItemCard(title: 'FDS produits chimiques', subtitle: '12 fiches - Dernière MAJ: 20/01/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'À jour', type: StatusBadgeType.success)),
        ListItemCard(title: 'Manuel sécurité', subtitle: 'Version 1.8 - Mis à jour: 10/12/2024', leadingIcon: Icons.description, badge: StatusBadge(label: 'MAJ requise', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildTrainingContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Formations QHSE'),
      ...[
        ListItemCard(title: 'SST (Sauveteur Secouriste)', subtitle: '15/04/2025 - 12 inscrits / 15 places', leadingIcon: Icons.school, badge: StatusBadge(label: 'Ouverte', type: StatusBadgeType.success)),
        ListItemCard(title: 'Gestion des déchets dangereux', subtitle: '22/04/2025 - 8 inscrits / 10 places', leadingIcon: Icons.school, badge: StatusBadge(label: 'Ouverte', type: StatusBadgeType.success)),
        ListItemCard(title: 'Évacuation incendie', subtitle: '01/04/2025 - Session complète', leadingIcon: Icons.school, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildRegulationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Réglementation'),
      ...[
        ListItemCard(title: 'Code du travail - Établissement', subtitle: 'Conformité: 95% - 2 points à traiter', leadingIcon: Icons.gavel, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Norme ISO 45001', subtitle: 'Certification valide jusqu\'au 31/12/2025', leadingIcon: Icons.verified, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
        ListItemCard(title: 'Réglementation ICPE', subtitle: 'Non applicable - Seuils non atteints', leadingIcon: Icons.info, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'N/A', type: StatusBadgeType.neutral)),
        ListItemCard(title: 'Arrêté cuisine collective', subtitle: 'Conformité: 100% - Dernière MAJ: 01/2025', leadingIcon: Icons.restaurant, leadingIconColor: AHColors.success, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildIndicatorsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Indicateurs QHSE'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Taux conformité', value: '92%', icon: Icons.verified, iconColor: AHColors.success, subtitle: '+3% vs T3'),
        StatCard(title: 'Incidents/mois', value: '3.2', icon: Icons.trending_down, iconColor: AHColors.info, subtitle: 'Moyenne mobile'),
        StatCard(title: 'Actions clôturées', value: '78%', icon: Icons.task_alt, iconColor: AHColors.gold, subtitle: 'Ce trimestre'),
        StatCard(title: 'Heures formation', value: '120h', icon: Icons.school, iconColor: AHColors.navy, subtitle: 'Total année'),
      ]),
    ]);
  }

  Widget _buildNonconformitiesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Non-conformités'),
      ...[
        ListItemCard(title: 'NC-2025-012: Porte incendie bloquée', subtitle: 'Majeure - Détectée: 08/03/2025', leadingIcon: Icons.cancel, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Ouverte', type: StatusBadgeType.error)),
        ListItemCard(title: 'NC-2025-011: Sol glissant réfectoire', subtitle: 'Mineure - Détectée: 05/03/2025', leadingIcon: Icons.cancel, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'En traitement', type: StatusBadgeType.warning)),
        ListItemCard(title: 'NC-2025-010: EPI périmé labo', subtitle: 'Majeure - Détectée: 01/03/2025', leadingIcon: Icons.cancel, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Résolue', type: StatusBadgeType.success)),
        ListItemCard(title: 'NC-2025-009: Éclairage défaillant couloir B', subtitle: 'Mineure - Détectée: 25/02/2025', leadingIcon: Icons.cancel, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Résolue', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildPermitsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Permis & Autorisations'),
      ...[
        ListItemCard(title: 'Permis de travaux - Bâtiment B', subtitle: 'Valide: 10/03 - 20/03/2025 - Rénovation électrique', leadingIcon: Icons.assignment_turned_in, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
        ListItemCard(title: 'Autorisation accès toiture', subtitle: 'Valide: 15/03 - 15/04/2025 - Maintenance climatisation', leadingIcon: Icons.assignment_turned_in, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
        ListItemCard(title: 'Permis feu - Soudure atelier', subtitle: 'Valide: 12/03/2025 - Intervention ponctuelle', leadingIcon: Icons.assignment_turned_in, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rapports QHSE'),
      ...[
        ListItemCard(title: 'Rapport mensuel - Mars 2025', subtitle: '8 inspections, 4 incidents, 12 actions', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Bilan trimestriel Q4 2024', subtitle: 'Conformité: 89% - 23 NC traitées', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Rapport annuel 2024', subtitle: 'Complet - 156 inspections, 34 incidents', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Archivé', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres QHSE'),
      ...[
        ListItemCard(title: 'Responsable QHSE', subtitle: 'Mme. Leblanc - leblanc@ecole.fr', leadingIcon: Icons.person, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Fréquence inspections', subtitle: 'Mensuelle - Cuisine, Trimestrielle - Autres', leadingIcon: Icons.schedule, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Seuils d\'alerte', subtitle: 'Incidents critiques: immédiat, Mineurs: 24h', leadingIcon: Icons.notifications_active, leadingIconColor: AHColors.error),
        ListItemCard(title: 'Référentiel normatif', subtitle: 'ISO 45001 / ISO 14001', leadingIcon: Icons.book, leadingIconColor: AHColors.info),
      ],
    ]);
  }
}
