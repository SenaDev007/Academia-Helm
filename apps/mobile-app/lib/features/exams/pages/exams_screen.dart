import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class ExamsScreen extends StatefulWidget {
  const ExamsScreen({super.key});

  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'exams');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'exams-dashboard':
            return _buildDashboardContent(context);
          case 'exams-schedule':
            return _buildScheduleContent(context);
          case 'exams-results':
            return _buildResultsContent(context);
          case 'exams-statistics':
            return _buildStatisticsContent(context);
          case 'exams-deliberations':
            return _buildDeliberationsContent(context);
          case 'exams-rankings':
            return _buildRankingsContent(context);
          case 'exams-certificates':
            return _buildCertificatesContent(context);
          case 'exams-appeals':
            return _buildAppealsContent(context);
          case 'exams-rooms':
            return _buildRoomsContent(context);
          case 'exams-supervision':
            return _buildSupervisionContent(context);
          case 'exams-archive':
            return _buildArchiveContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Examens'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Examens planifiés', value: '24', icon: Icons.event_available, subtitle: 'Ce trimestre'),
        StatCard(title: 'Résultats publiés', value: '18', icon: Icons.check_circle, iconColor: AHColors.success, subtitle: '75%'),
        StatCard(title: 'Délibérations', value: '3', icon: Icons.gavel, iconColor: AHColors.gold, subtitle: 'À venir'),
        StatCard(title: 'Taux de réussite', value: '87%', icon: Icons.trending_up, iconColor: AHColors.info, subtitle: '+2% vs N-1'),
      ]),
    ]);
  }

  Widget _buildScheduleContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Planning des examens'), ...[ListItemCard(title: 'Mathématiques - 3ème B', subtitle: '15 mars 2025, 08h00 - Salle A1', leadingIcon: Icons.calculate, badge: StatusBadge(label: 'Confirmé', type: StatusBadgeType.success)), ListItemCard(title: 'Français - 2nde A', subtitle: '17 mars 2025, 10h00 - Salle B3', leadingIcon: Icons.menu_book, badge: StatusBadge(label: 'Confirmé', type: StatusBadgeType.success)), ListItemCard(title: 'SVT - 1ère S', subtitle: '20 mars 2025, 14h00 - Amphi', leadingIcon: Icons.biotech, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Histoire-Géo - Tle L', subtitle: '22 mars 2025, 08h00 - Salle C2', leadingIcon: Icons.public, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info))]]); }
  Widget _buildResultsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Résultats'), ...[ListItemCard(title: 'Mathématiques - 3ème B', subtitle: 'Moyenne: 13.2/20 - 28 élèves', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Publié', type: StatusBadgeType.success)), ListItemCard(title: 'Français - 2nde A', subtitle: 'Moyenne: 11.8/20 - 32 élèves', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Publié', type: StatusBadgeType.success)), ListItemCard(title: 'Physique - 1ère S', subtitle: 'En cours de correction', leadingIcon: Icons.assignment, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info))]]); }
  Widget _buildStatisticsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Statistiques'), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [StatCard(title: 'Moy. générale', value: '12.6', icon: Icons.grade, iconColor: AHColors.gold, subtitle: '/20'), StatCard(title: 'Taux réussite', value: '87%', icon: Icons.check_circle, iconColor: AHColors.success), StatCard(title: 'Écart type', value: '3.2', icon: Icons.bar_chart, iconColor: AHColors.info, subtitle: 'Dispersion'), StatCard(title: 'Médiane', value: '12.9', icon: Icons.straighten, iconColor: AHColors.navy, subtitle: '/20')])]); }
  Widget _buildDeliberationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Délibérations'), ...[ListItemCard(title: 'Conseil de classe 3ème B', subtitle: 'Prévu le 28 mars 2025', leadingIcon: Icons.gavel, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Conseil de classe 2nde A', subtitle: 'Prévu le 29 mars 2025', leadingIcon: Icons.gavel, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)), ListItemCard(title: 'Conseil 1ère S - T2', subtitle: 'Terminé le 15/02/2025', leadingIcon: Icons.gavel, badge: StatusBadge(label: 'Clôturé', type: StatusBadgeType.success))]]); }
  Widget _buildRankingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Classements'), ...[ListItemCard(title: 'Classement 3ème B - T2', subtitle: '1er: Dupont M. (16.8/20)', leadingIcon: Icons.emoji_events, leadingIconColor: AHColors.gold), ListItemCard(title: 'Classement 2nde A - T2', subtitle: '1er: Moreau T. (15.2/20)', leadingIcon: Icons.emoji_events, leadingIconColor: AHColors.gold), ListItemCard(title: 'Classement général - T2', subtitle: '1 247 élèves classés', leadingIcon: Icons.leaderboard, leadingIconColor: AHColors.navy)]]); }
  Widget _buildCertificatesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Certificats'), ...[ListItemCard(title: 'Certificat de réussite - 3ème', subtitle: '87 certificats émis', leadingIcon: Icons.workspace_premium, leadingIconColor: AHColors.gold), ListItemCard(title: 'Mention très bien', subtitle: '12 élèves', leadingIcon: Icons.star, leadingIconColor: AHColors.gold), ListItemCard(title: 'Mention bien', subtitle: '34 élèves', leadingIcon: Icons.star_half, leadingIconColor: AHColors.success)]]); }
  Widget _buildAppealsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Recours'), ...[ListItemCard(title: 'Recours note maths - Martin L.', subtitle: 'Demandé le 08/03/2025', leadingIcon: Icons.campaign, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Recours note français - Kone A.', subtitle: 'Demandé le 05/03/2025', leadingIcon: Icons.campaign, badge: StatusBadge(label: 'Traité', type: StatusBadgeType.success))]]); }
  Widget _buildRoomsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Salles d\'examen'), ...[ListItemCard(title: 'Salle A1', subtitle: 'Capacité: 30 places - Disponible', leadingIcon: Icons.meeting_room, badge: StatusBadge(label: 'Libre', type: StatusBadgeType.success)), ListItemCard(title: 'Amphithéâtre', subtitle: 'Capacité: 120 places - Occupé 15/03', leadingIcon: Icons.meeting_room, badge: StatusBadge(label: 'Réservé', type: StatusBadgeType.warning)), ListItemCard(title: 'Salle B3', subtitle: 'Capacité: 25 places - Disponible', leadingIcon: Icons.meeting_room, badge: StatusBadge(label: 'Libre', type: StatusBadgeType.success))]]); }
  Widget _buildSupervisionContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Surveillance'), ...[ListItemCard(title: 'Mathématiques 3ème B - 15/03', subtitle: 'M. Dubois, Mme Laurent', leadingIcon: Icons.visibility, badge: StatusBadge(label: 'Assigné', type: StatusBadgeType.success)), ListItemCard(title: 'Français 2nde A - 17/03', subtitle: 'Mme Petit, M. Nguyeân', leadingIcon: Icons.visibility, badge: StatusBadge(label: 'À assigner', type: StatusBadgeType.warning))]]); }
  Widget _buildArchiveContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Archive examens'), ...[ListItemCard(title: 'Session 2023-2024', subtitle: '156 examens archivés', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted), ListItemCard(title: 'Session 2022-2023', subtitle: '142 examens archivés', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted)]]); }
}
