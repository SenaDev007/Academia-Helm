import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class PedagogyScreen extends StatefulWidget {
  const PedagogyScreen({super.key});

  @override
  State<PedagogyScreen> createState() => _PedagogyScreenState();
}

class _PedagogyScreenState extends State<PedagogyScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'pedagogy');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'pedagogy-dashboard':
            return _buildDashboardContent(context);
          case 'pedagogy-planning':
            return _buildPlanningContent(context);
          case 'pedagogy-lessons':
            return _buildLessonsContent(context);
          case 'pedagogy-homework':
            return _buildHomeworkContent(context);
          case 'pedagogy-resources':
            return _buildResourcesContent(context);
          case 'pedagogy-evaluations':
            return _buildEvaluationsContent(context);
          case 'pedagogy-competencies':
            return _buildCompetenciesContent(context);
          case 'pedagogy-projects':
            return _buildProjectsContent(context);
          case 'pedagogy-differentiation':
            return _buildDifferentiationContent(context);
          case 'pedagogy-progress':
            return _buildProgressContent(context);
          case 'pedagogy-reports':
            return _buildReportsContent(context);
          case 'pedagogy-archive':
            return _buildArchiveContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Pédagogie'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Leçons actives', value: '156', icon: Icons.menu_book, subtitle: '18 enseignants'),
        StatCard(title: 'Devoirs assignés', value: '42', icon: Icons.assignment, iconColor: AHColors.info, subtitle: 'Cette semaine'),
        StatCard(title: 'Évaluations', value: '8', icon: Icons.fact_check, iconColor: AHColors.gold, subtitle: 'Planifiées'),
        StatCard(title: 'Ressources', value: '234', icon: Icons.folder_open, iconColor: AHColors.success, subtitle: 'Partagées'),
      ]),
    ]);
  }

  Widget _buildPlanningContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Progression pédagogique'), ...[ListItemCard(title: 'Mathématiques - 3ème B', subtitle: 'Chapitre 5/8 - 62% avancement', leadingIcon: Icons.calendar_month, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Français - 2nde A', subtitle: 'Chapitre 6/10 - 60% avancement', leadingIcon: Icons.calendar_month, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'SVT - 1ère S', subtitle: 'Chapitre 4/7 - 57% avancement', leadingIcon: Icons.calendar_month, badge: StatusBadge(label: 'En retard', type: StatusBadgeType.warning))]]); }
  Widget _buildLessonsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Leçons'), ...[ListItemCard(title: 'Fonctions affines', subtitle: 'Maths 3ème - M. Dubois', leadingIcon: Icons.functions), ListItemCard(title: 'Les Misérables - Analyse', subtitle: 'Français 2nde - Mme Laurent', leadingIcon: Icons.auto_stories), ListItemCard(title: 'La photosynthèse', subtitle: 'SVT 1ère - Mme Petit', leadingIcon: Icons.eco)]]); }
  Widget _buildHomeworkContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Devoirs'), ...[ListItemCard(title: 'Exercices p.87 #1-5', subtitle: 'Maths 3ème - Pour le 15/03', leadingIcon: Icons.edit_note, badge: StatusBadge(label: 'À rendre', type: StatusBadgeType.warning)), ListItemCard(title: 'Dissertation', subtitle: 'Français 2nde - Pour le 18/03', leadingIcon: Icons.edit_note, badge: StatusBadge(label: 'À rendre', type: StatusBadgeType.warning)), ListItemCard(title: 'TP compte-rendu', subtitle: 'SVT 1ère - Pour le 14/03', leadingIcon: Icons.edit_note, badge: StatusBadge(label: 'Rendu', type: StatusBadgeType.success))]]); }
  Widget _buildResourcesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Ressources'), ...[ListItemCard(title: 'Banque d\'exercices maths', subtitle: '234 exercices disponibles', leadingIcon: Icons.library_books, leadingIconColor: AHColors.info), ListItemCard(title: 'Vidéos pédagogiques', subtitle: '89 vidéos classées', leadingIcon: Icons.play_circle, leadingIconColor: AHColors.error), ListItemCard(title: 'Documents partagés', subtitle: '156 fichiers', leadingIcon: Icons.folder_shared, leadingIconColor: AHColors.gold)]]); }
  Widget _buildEvaluationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Évaluations'), ...[ListItemCard(title: 'Contrôle commun maths T2', subtitle: '3ème - 28/02/2025', leadingIcon: Icons.fact_check, badge: StatusBadge(label: 'Terminé', type: StatusBadgeType.success)), ListItemCard(title: 'Évaluation formative français', subtitle: '2nde - En cours', leadingIcon: Icons.fact_check, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info))]]); }
  Widget _buildCompetenciesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Compétences'), ...[ListItemCard(title: 'Compétences maths 3ème', subtitle: '8/12 validées en moyenne', leadingIcon: Icons.military_tech, leadingIconColor: AHColors.gold), ListItemCard(title: 'Socle commun - Cycle 4', subtitle: 'Progression: 72%', leadingIcon: Icons.verified, leadingIconColor: AHColors.success)]]); }
  Widget _buildProjectsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Projets'), ...[ListItemCard(title: 'Projet interdisciplinaire 3ème', subtitle: 'Sciences/Lettres - 45 élèves', leadingIcon: Icons.lightbulb, leadingIconColor: AHColors.gold, badge: StatusBadge(label: 'Actif', type: StatusBadgeType.info)), ListItemCard(title: 'Exposé groupe 2nde', subtitle: 'Histoire/Arts - 32 élèves', leadingIcon: Icons.groups, leadingIconColor: AHColors.navy, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info))]]); }
  Widget _buildDifferentiationContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Différenciation'), ...[ListItemCard(title: 'Groupes de besoin - Maths', subtitle: '3 groupes identifiés', leadingIcon: Icons.call_split, leadingIconColor: AHColors.info), ListItemCard(title: 'Plans individualisés', subtitle: '12 PAP en cours', leadingIcon: Icons.person_pin, leadingIconColor: AHColors.success)]]); }
  Widget _buildProgressContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Suivi des progrès'), ...[AHProgressBar(label: 'Mathématiques 3ème', valueLabel: '62%', progress: 0.62), const SizedBox(height: AHSpacing.md), AHProgressBar(label: 'Français 2nde', valueLabel: '60%', progress: 0.60, activeColor: AHColors.info), const SizedBox(height: AHSpacing.md), AHProgressBar(label: 'SVT 1ère S', valueLabel: '57%', progress: 0.57, activeColor: AHColors.warning)]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports pédagogiques'), ...[ListItemCard(title: 'Bilan pédagogique T2', subtitle: 'Généré le 01/03/2025', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success)), ListItemCard(title: 'Analyse des pratiques', subtitle: 'Généré le 15/02/2025', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success))]]); }
  Widget _buildArchiveContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Archive pédagogique'), ...[ListItemCard(title: 'Année 2023-2024', subtitle: 'Toutes progressions archivées', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted), ListItemCard(title: 'Année 2022-2023', subtitle: 'Toutes progressions archivées', leadingIcon: Icons.archive, leadingIconColor: AHColors.muted)]]); }
}
