import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class OrionScreen extends StatefulWidget {
  const OrionScreen({super.key});

  @override
  State<OrionScreen> createState() => _OrionScreenState();
}

class _OrionScreenState extends State<OrionScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'orion');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'orion-dashboard':
            return _buildDashboardContent(context);
          case 'orion-analysis':
            return _buildAnalysisContent(context);
          case 'orion-predictions':
            return _buildPredictionsContent(context);
          case 'orion-reports':
            return _buildReportsContent(context);
          case 'orion-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Vue d\'ensemble Orion IA'),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: AHSpacing.sm,
          crossAxisSpacing: AHSpacing.sm,
          childAspectRatio: 1.4,
          children: const [
            StatCard(
              title: 'Analyses actives',
              value: '12',
              icon: Icons.analytics,
              subtitle: '+3 cette semaine',
            ),
            StatCard(
              title: 'Prédictions',
              value: '48',
              icon: Icons.trending_up,
              iconColor: AHColors.success,
              subtitle: '87% précision',
            ),
            StatCard(
              title: 'Alertes',
              value: '5',
              icon: Icons.notifications_active,
              iconColor: AHColors.warning,
              subtitle: '2 critiques',
            ),
            StatCard(
              title: 'Rapports générés',
              value: '23',
              icon: Icons.description,
              iconColor: AHColors.info,
              subtitle: 'Ce mois',
            ),
          ],
        ),
        const SectionHeader(title: 'Analyses récentes'),
        ...[
          ListItemCard(title: 'Risque d\'abandon - 3ème B', subtitle: 'Prédiction: Élevé (78%)', leadingIcon: Icons.warning_amber, leadingIconColor: AHColors.error),
          ListItemCard(title: 'Performance maths - 2nde A', subtitle: 'Tendance: En hausse (+12%)', leadingIcon: Icons.trending_up, leadingIconColor: AHColors.success),
          ListItemCard(title: 'Absentéisme - 1ère S', subtitle: 'Analyse: 15% au-dessus seuil', leadingIcon: Icons.person_off, leadingIconColor: AHColors.warning),
        ],
      ],
    );
  }

  Widget _buildAnalysisContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Analyses en cours'),
        ...[
          ListItemCard(title: 'Analyse des résultats Q1', subtitle: 'Mathématiques - Toutes classes', leadingIcon: Icons.analytics, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
          ListItemCard(title: 'Corrélations notes/présence', subtitle: 'Cycle secondaire', leadingIcon: Icons.compare_arrows, badge: StatusBadge(label: 'Terminé', type: StatusBadgeType.success)),
          ListItemCard(title: 'Profils d\'apprentissage', subtitle: '6ème - 3ème', leadingIcon: Icons.psychology, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
          ListItemCard(title: 'Impact pédagogique', subtitle: 'Nouveaux programmes', leadingIcon: Icons.lightbulb, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral)),
        ],
      ],
    );
  }

  Widget _buildPredictionsContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Prédictions IA'),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: AHSpacing.sm,
          crossAxisSpacing: AHSpacing.sm,
          childAspectRatio: 1.4,
          children: const [
            StatCard(title: 'Taux de réussite estimé', value: '82%', icon: Icons.school, iconColor: AHColors.success),
            StatCard(title: 'Risque d\'abandon', value: '8%', icon: Icons.person_off, iconColor: AHColors.error),
            StatCard(title: 'Progression moyenne', value: '+5.2%', icon: Icons.trending_up, iconColor: AHColors.info),
            StatCard(title: 'Confiance modèle', value: '91%', icon: Icons.verified, iconColor: AHColors.gold),
          ],
        ),
        const SectionHeader(title: 'Prédictions détaillées'),
        ...[
          ListItemCard(title: 'Classe 3ème B - Taux réussite', subtitle: 'Prédit: 76% | Réel: 79%', leadingIcon: Icons.trending_up, leadingIconColor: AHColors.success),
          ListItemCard(title: 'Élève Dupont M. - Risque abandon', subtitle: 'Probabilité: 45% | Confiance: 87%', leadingIcon: Icons.warning, leadingIconColor: AHColors.warning),
          ListItemCard(title: 'Classe 2nde A - Moyenne générale', subtitle: 'Prédit: 12.8 | Réel: 13.1', leadingIcon: Icons.show_chart, leadingIconColor: AHColors.info),
        ],
      ],
    );
  }

  Widget _buildReportsContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Rapports IA'),
        ...[
          ListItemCard(title: 'Rapport mensuel - Mars 2025', subtitle: 'Généré le 01/04/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold)),
          ListItemCard(title: 'Bilan trimestriel Q2', subtitle: 'Généré le 15/03/2025', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success)),
          ListItemCard(title: 'Analyse prédictive semestrielle', subtitle: 'Généré le 01/02/2025', leadingIcon: Icons.auto_graph, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success)),
          ListItemCard(title: 'Rapport personnalisé - Direction', subtitle: 'Généré le 28/01/2025', leadingIcon: Icons.folder_special, badge: StatusBadge(label: 'Archivé', type: StatusBadgeType.neutral)),
        ],
      ],
    );
  }

  Widget _buildSettingsContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Configuration Orion IA'),
        ...[
          ListItemCard(title: 'Modèles de prédiction', subtitle: '3 modèles actifs', leadingIcon: Icons.model_training),
          ListItemCard(title: 'Sources de données', subtitle: '5 connecteurs configurés', leadingIcon: Icons.storage),
          ListItemCard(title: 'Seuils d\'alerte', subtitle: 'Configurés pour 4 indicateurs', leadingIcon: Icons.tune),
          ListItemCard(title: 'Planification des analyses', subtitle: 'Quotidienne à 02h00', leadingIcon: Icons.schedule),
          ListItemCard(title: 'Historique des modifications', subtitle: '12 changements ce mois', leadingIcon: Icons.history),
        ],
      ],
    );
  }
}
