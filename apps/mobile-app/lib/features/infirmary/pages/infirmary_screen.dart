import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class InfirmaryScreen extends StatefulWidget {
  const InfirmaryScreen({super.key});

  @override
  State<InfirmaryScreen> createState() => _InfirmaryScreenState();
}

class _InfirmaryScreenState extends State<InfirmaryScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'infirmary');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'infirmary-dashboard':
            return _buildDashboardContent(context);
          case 'infirmary-records':
            return _buildRecordsContent(context);
          case 'infirmary-visits':
            return _buildVisitsContent(context);
          case 'infirmary-medications':
            return _buildMedicationsContent(context);
          case 'infirmary-allergies':
            return _buildAllergiesContent(context);
          case 'infirmary-vaccinations':
            return _buildVaccinationsContent(context);
          case 'infirmary-emergencies':
            return _buildEmergenciesContent(context);
          case 'infirmary-reports':
            return _buildReportsContent(context);
          case 'infirmary-stock':
            return _buildStockContent(context);
          case 'infirmary-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Infirmerie'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Visites ce mois', value: '45', icon: Icons.local_hospital, subtitle: '+8 vs mois dernier'),
        StatCard(title: 'Élèves suivis', value: '67', icon: Icons.health_and_safety, iconColor: AHColors.info, subtitle: 'Chroniques'),
        StatCard(title: 'Vaccinations à jour', value: '89%', icon: Icons.vaccines, iconColor: AHColors.success, subtitle: 'Conformité'),
        StatCard(title: 'Urgences ce mois', value: '2', icon: Icons.emergency, iconColor: AHColors.error, subtitle: 'Prises en charge'),
      ]),
    ]);
  }

  Widget _buildRecordsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Dossiers médicaux'),
      ...[
        ListItemCard(title: 'Dupont Marie', subtitle: '3ème B - Asthme, Allergie arachides', leadingIcon: Icons.folder_shared, badge: StatusBadge(label: 'Suivi', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Martin Lucas', subtitle: '2nde A - Diabète type 1', leadingIcon: Icons.folder_shared, badge: StatusBadge(label: 'Suivi', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Ben Ahmed Youssef', subtitle: '1ère S - Aucune pathologie', leadingIcon: Icons.folder_shared, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
        ListItemCard(title: 'Petit Sophie', subtitle: '6ème C - Allergie gluten', leadingIcon: Icons.folder_shared, badge: StatusBadge(label: 'Suivi', type: StatusBadgeType.warning)),
      ],
    ]);
  }

  Widget _buildVisitsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Visites'),
      ...[
        ListItemCard(title: 'Kone Aminata', subtitle: 'Maux de tête - 10/03/2025 10h30', leadingIcon: Icons.login, badge: StatusBadge(label: 'Traité', type: StatusBadgeType.success)),
        ListItemCard(title: 'Moreau Thomas', subtitle: 'Blessure sport - 10/03/2025 14h15', leadingIcon: Icons.login, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Diop Fatou', subtitle: 'Fièvre - 09/03/2025 09h00', leadingIcon: Icons.login, badge: StatusBadge(label: 'Traité', type: StatusBadgeType.success)),
        ListItemCard(title: 'Lambert Paul', subtitle: 'Mal de ventre - 09/03/2025 11h45', leadingIcon: Icons.login, badge: StatusBadge(label: 'Renvoyé', type: StatusBadgeType.neutral)),
      ],
    ]);
  }

  Widget _buildMedicationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Médicaments'),
      ...[
        ListItemCard(title: 'Paracétamol 500mg', subtitle: '125 comprimés - Péremption: 12/2025', leadingIcon: Icons.medication, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
        ListItemCard(title: 'Ventoline (salbutamol)', subtitle: '3 inhalateurs - Péremption: 06/2025', leadingIcon: Icons.medication, badge: StatusBadge(label: 'Bientôt exp.', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Doliprane sirop enfant', subtitle: '2 flacons - Péremption: 03/2025', leadingIcon: Icons.medication, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Expiré', type: StatusBadgeType.error)),
        ListItemCard(title: 'Crème hydrocortisone', subtitle: '4 tubes - Péremption: 09/2025', leadingIcon: Icons.medication, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildAllergiesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Allergies'),
      ...[
        ListItemCard(title: 'Arachides', subtitle: '7 élèves - Protocole EPI requis', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Sévère', type: StatusBadgeType.error)),
        ListItemCard(title: 'Gluten', subtitle: '14 élèves - Régime sans gluten', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Modéré', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Lactose', subtitle: '9 élèves - Alternatives proposées', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.info, badge: StatusBadge(label: 'Léger', type: StatusBadgeType.info)),
      ],
    ]);
  }

  Widget _buildVaccinationsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Vaccinations'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Taux conformité', value: '89%', icon: Icons.vaccines, iconColor: AHColors.success, subtitle: 'Obligatoires'),
        StatCard(title: 'Rappels à faire', value: '23', icon: Icons.event_busy, iconColor: AHColors.warning, subtitle: 'Ce trimestre'),
        StatCard(title: 'Campagne en cours', value: '1', icon: Icons.campaign, iconColor: AHColors.info, subtitle: 'Grippe'),
        StatCard(title: 'Certificats validés', value: '1 198', icon: Icons.verified, iconColor: AHColors.success),
      ]),
    ]);
  }

  Widget _buildEmergenciesContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Urgences'),
      ...[
        ListItemCard(title: 'Crise d\'asthme - Dupont M.', subtitle: '10/03/2025 08h45 - Traitée sur place', leadingIcon: Icons.emergency, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Résolu', type: StatusBadgeType.success)),
        ListItemCard(title: 'Chute récréation - Laurent J.', subtitle: '07/03/2025 10h15 - Hospitalisé', leadingIcon: Icons.emergency, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Suivi', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Réaction allergique - Petit S.', subtitle: '03/03/2025 12h30 - EPI administré', leadingIcon: Icons.emergency, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Résolu', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Rapports Infirmerie'),
      ...[
        ListItemCard(title: 'Rapport mensuel - Mars 2025', subtitle: '45 visites, 2 urgences, 67 suivis', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Bilan vaccinations Q1', subtitle: '89% conformité - 23 rappels en attente', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)),
        ListItemCard(title: 'Rapport hygiène', subtitle: 'Inspection du 01/03/2025', leadingIcon: Icons.health_and_safety, badge: StatusBadge(label: 'Conforme', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildStockContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Stock Infirmerie'),
      ...[
        ListItemCard(title: 'Matériel premier secours', subtitle: '12 trousses - Complètes', leadingIcon: Icons.medical_services, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
        ListItemCard(title: 'EPI (stylos auto-injecteurs)', subtitle: '5 unités - 2 élèves concernés', leadingIcon: Icons.emergency, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Vérifier', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Matériel diagnostic', subtitle: 'Tension, thermomètre, oxymètre', leadingIcon: Icons.monitor_heart, badge: StatusBadge(label: 'OK', type: StatusBadgeType.success)),
      ],
    ]);
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Paramètres Infirmerie'),
      ...[
        ListItemCard(title: 'Horaires infirmerie', subtitle: '8h00 - 17h00', leadingIcon: Icons.schedule, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Personnel infirmier', subtitle: '2 infirmiers affectés', leadingIcon: Icons.people, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Protocoles d\'urgence', subtitle: '5 protocoles actifs', leadingIcon: Icons.assignment, leadingIconColor: AHColors.error),
        ListItemCard(title: 'Notifications parents', subtitle: 'Activées - SMS + email', leadingIcon: Icons.notifications, leadingIconColor: AHColors.info),
      ],
    ]);
  }
}
