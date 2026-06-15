import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class HrScreen extends StatefulWidget {
  const HrScreen({super.key});

  @override
  State<HrScreen> createState() => _HrScreenState();
}

class _HrScreenState extends State<HrScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'hr');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'hr-dashboard': return _buildDashboardContent(context);
          case 'hr-staff': return _buildStaffContent(context);
          case 'hr-recruitment': return _buildRecruitmentContent(context);
          case 'hr-contracts': return _buildContractsContent(context);
          case 'hr-payroll': return _buildPayrollContent(context);
          case 'hr-leave': return _buildLeaveContent(context);
          case 'hr-training': return _buildTrainingContent(context);
          case 'hr-evaluations': return _buildEvaluationsContent(context);
          case 'hr-discipline': return _buildDisciplineContent(context);
          case 'hr-documents': return _buildDocumentsContent(context);
          case 'hr-orgchart': return _buildOrgchartContent(context);
          case 'hr-policies': return _buildPoliciesContent(context);
          case 'hr-reports': return _buildReportsContent(context);
          case 'hr-settings': return _buildSettingsContent(context);
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord RH'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Effectif total', value: '87', icon: Icons.people, subtitle: '+3 cette année'),
        StatCard(title: 'Enseignants', value: '52', icon: Icons.school, iconColor: AHColors.info, subtitle: '60%'),
        StatCard(title: 'Congés en cours', value: '4', icon: Icons.beach_access, iconColor: AHColors.success, subtitle: 'Ce mois'),
        StatCard(title: 'Recrutement', value: '2', icon: Icons.person_add, iconColor: AHColors.gold, subtitle: 'Postes ouverts'),
      ]),
    ]);
  }

  Widget _buildStaffContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Personnel'), ...[ListItemCard(title: 'Dubois Pierre', subtitle: 'Professeur maths - CDI', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Laurent Marie', subtitle: 'Professeure français - CDI', leadingIcon: Icons.person, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.success)), ListItemCard(title: 'Nguyen Thi', subtitle: 'Documentaliste - CDD', leadingIcon: Icons.person, badge: StatusBadge(label: 'CDD', type: StatusBadgeType.warning))]]); }
  Widget _buildRecruitmentContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Recrutement'), ...[ListItemCard(title: 'Professeur d\'anglais', subtitle: 'Candidatures: 12 - Clôture: 20/03', leadingIcon: Icons.work, badge: StatusBadge(label: 'Ouvert', type: StatusBadgeType.info)), ListItemCard(title: 'Surveillant', subtitle: 'Candidatures: 5 - Entretiens en cours', leadingIcon: Icons.work, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.warning))]]); }
  Widget _buildContractsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Contrats'), ...[ListItemCard(title: 'CDI actifs', subtitle: '68 contrats', leadingIcon: Icons.description, badge: StatusBadge(label: 'Stable', type: StatusBadgeType.success)), ListItemCard(title: 'CDD en cours', subtitle: '12 contrats - 3 arrivent à échéance', leadingIcon: Icons.description, badge: StatusBadge(label: 'Attention', type: StatusBadgeType.warning)), ListItemCard(title: 'Stagiaires', subtitle: '7 conventions', leadingIcon: Icons.school, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info))]]); }
  Widget _buildPayrollContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paie'), ...[ListItemCard(title: 'Fiches de paie mars 2025', subtitle: '87 fiches à générer', leadingIcon: Icons.payments, badge: StatusBadge(label: 'En préparation', type: StatusBadgeType.info)), ListItemCard(title: 'Virements février', subtitle: 'Exécutés le 28/02/2025', leadingIcon: Icons.account_balance, badge: StatusBadge(label: 'Traité', type: StatusBadgeType.success))]]); }
  Widget _buildLeaveContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Congés'), ...[ListItemCard(title: 'Demande: Martin S.', subtitle: '24-28 mars 2025 - CP', leadingIcon: Icons.event_busy, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)), ListItemCard(title: 'Demande: Petit C.', subtitle: '14-18 avril 2025 - CP', leadingIcon: Icons.event_busy, badge: StatusBadge(label: 'Validé', type: StatusBadgeType.success))]]); }
  Widget _buildTrainingContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Formation'), ...[ListItemCard(title: 'Numérique éducatif', subtitle: '15 inscrits - 20/03/2025', leadingIcon: Icons.computer, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Premiers secours', subtitle: '8 inscrits - 25/03/2025', leadingIcon: Icons.health_and_safety, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info))]]); }
  Widget _buildEvaluationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Évaluations'), ...[ListItemCard(title: 'Évaluation annuelle 2024', subtitle: '78/87 complétées', leadingIcon: Icons.star, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Visite médicale', subtitle: '12 planifiées', leadingIcon: Icons.local_hospital, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral))]]); }
  Widget _buildDisciplineContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Discipline'), ...[ListItemCard(title: 'Avertissement - Agent X', subtitle: 'Retards répétés - 05/03/2025', leadingIcon: Icons.warning, leadingIconColor: AHColors.warning), ListItemCard(title: 'Sanction - Surveillant Y', subtitle: 'Absence injustifiée - 01/03/2025', leadingIcon: Icons.gavel, leadingIconColor: AHColors.error)]]); }
  Widget _buildDocumentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Documents RH'), ...[ListItemCard(title: 'Modèle contrat CDI', subtitle: 'Dernière MAJ: 01/01/2025', leadingIcon: Icons.description), ListItemCard(title: 'Règlement intérieur personnel', subtitle: 'Version 2025', leadingIcon: Icons.gavel), ListItemCard(title: 'Modèle attestation employeur', subtitle: 'Disponible', leadingIcon: Icons.badge)]]); }
  Widget _buildOrgchartContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Organigramme'), ...[ListItemCard(title: 'Direction', subtitle: 'Directeur + 2 adjoints', leadingIcon: Icons.account_balance, leadingIconColor: AHColors.navy), ListItemCard(title: 'Pédagogie', subtitle: '52 enseignants + 5 coord.', leadingIcon: Icons.school, leadingIconColor: AHColors.info), ListItemCard(title: 'Administration', subtitle: '18 agents', leadingIcon: Icons.business, leadingIconColor: AHColors.gold), ListItemCard(title: 'Services', subtitle: '14 personnels', leadingIcon: Icons.miscellaneous_services, leadingIconColor: AHColors.success)]]); }
  Widget _buildPoliciesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Politiques RH'), ...[ListItemCard(title: 'Politique congés', subtitle: 'Version 2025 - Approuvée', leadingIcon: Icons.policy, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)), ListItemCard(title: 'Politique recrutement', subtitle: 'Version 2024', leadingIcon: Icons.policy, badge: StatusBadge(label: 'Active', type: StatusBadgeType.success)), ListItemCard(title: 'Politique formation', subtitle: 'En révision', leadingIcon: Icons.policy, badge: StatusBadge(label: 'Brouillon', type: StatusBadgeType.neutral))]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports RH'), ...[ListItemCard(title: 'Bilan social 2024', subtitle: 'Publié le 15/01/2025', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)), ListItemCard(title: 'Statistiques absentéisme', subtitle: 'Mis à jour mars 2025', leadingIcon: Icons.bar_chart, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold))]]); }
  Widget _buildSettingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paramètres RH'), ...[ListItemCard(title: 'Types de congés', subtitle: '7 types configurés', leadingIcon: Icons.settings), ListItemCard(title: 'Grilles salariales', subtitle: '3 grilles actives', leadingIcon: Icons.settings), ListItemCard(title: 'Notifications RH', subtitle: 'Configurées', leadingIcon: Icons.notifications_active)]]); }
}
