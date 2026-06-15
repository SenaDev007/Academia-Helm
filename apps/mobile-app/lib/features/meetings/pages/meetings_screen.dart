import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class MeetingsScreen extends StatefulWidget {
  const MeetingsScreen({super.key});

  @override
  State<MeetingsScreen> createState() => _MeetingsScreenState();
}

class _MeetingsScreenState extends State<MeetingsScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'meetings');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'meetings-dashboard':
            return _buildDashboardContent(context);
          case 'meetings-schedule':
            return _buildScheduleContent(context);
          case 'meetings-minutes':
            return _buildMinutesContent(context);
          case 'meetings-decisions':
            return _buildDecisionsContent(context);
          case 'meetings-documents':
            return _buildDocumentsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Vue d\'ensemble des réunions'),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: AHSpacing.sm,
          crossAxisSpacing: AHSpacing.sm,
          childAspectRatio: 1.4,
          children: const [
            StatCard(title: 'Réunions ce mois', value: '8', icon: Icons.event_available, subtitle: '3 à venir'),
            StatCard(title: 'Procès-verbaux', value: '15', icon: Icons.description, subtitle: '2 en attente'),
            StatCard(title: 'Décisions', value: '34', icon: Icons.check_circle, subtitle: '12 en cours'),
            StatCard(title: 'Participants', value: '47', icon: Icons.people, subtitle: 'Moy. 6/réunion'),
          ],
        ),
        const SectionHeader(title: 'Prochaines réunions'),
        ...[
          ListItemCard(title: 'Conseil pédagogique', subtitle: 'Demain, 10h00 - Salle de conférence', leadingIcon: Icons.event_available, badge: StatusBadge(label: 'Confirmé', type: StatusBadgeType.success)),
          ListItemCard(title: 'Réunion parents-professeurs', subtitle: 'Ven. 14 mars, 14h00', leadingIcon: Icons.groups, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
          ListItemCard(title: 'Bilan trimestriel', subtitle: 'Lun. 17 mars, 09h00', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
        ],
      ],
    );
  }

  Widget _buildScheduleContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Planification des réunions'),
        ...[
          ListItemCard(title: 'Conseil de discipline', subtitle: '12 mars 2025, 09h00 - Bureau directeur', leadingIcon: Icons.gavel, badge: StatusBadge(label: 'Confirmé', type: StatusBadgeType.success)),
          ListItemCard(title: 'Réunion département maths', subtitle: '13 mars 2025, 14h00 - Salle B2', leadingIcon: Icons.calculate, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
          ListItemCard(title: 'CA établissement', subtitle: '20 mars 2025, 16h00 - Amphi', leadingIcon: Icons.account_balance, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.info)),
          ListItemCard(title: 'Cellule crise', subtitle: 'À définir', leadingIcon: Icons.priority_high, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
        ],
      ],
    );
  }

  Widget _buildMinutesContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Procès-verbaux'),
        ...[
          ListItemCard(title: 'PV - Conseil pédagogique fév.', subtitle: 'Rédigé le 28/02/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'Validé', type: StatusBadgeType.success)),
          ListItemCard(title: 'PV - Réunion parents janv.', subtitle: 'Rédigé le 25/01/2025', leadingIcon: Icons.description, badge: StatusBadge(label: 'En relecture', type: StatusBadgeType.warning)),
          ListItemCard(title: 'PV - CA décembre', subtitle: 'Rédigé le 18/12/2024', leadingIcon: Icons.description, badge: StatusBadge(label: 'Validé', type: StatusBadgeType.success)),
        ],
      ],
    );
  }

  Widget _buildDecisionsContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Décisions'),
        ...[
          ListItemCard(title: 'Modification emploi du temps 3ème', subtitle: 'Approuvée le 01/03/2025', leadingIcon: Icons.check_circle, badge: StatusBadge(label: 'Appliquée', type: StatusBadgeType.success)),
          ListItemCard(title: 'Achat manuels SVT', subtitle: 'En attente de validation DA', leadingIcon: Icons.shopping_cart, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
          ListItemCard(title: 'Réorganisation service vie scolaire', subtitle: 'Décision du 15/02/2025', leadingIcon: Icons.reorg, badge: StatusBadge(label: 'Reportée', type: StatusBadgeType.warning)),
          ListItemCard(title: 'Nouveau règlement intérieur', subtitle: 'Vote programmé mars 2025', leadingIcon: Icons.gavel, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral)),
        ],
      ],
    );
  }

  Widget _buildDocumentsContent(BuildContext context) {
    return SubTabContentWrapper(
      children: [
        const SectionHeader(title: 'Documents de réunion'),
        ...[
          ListItemCard(title: 'Ordre du jour - Conseil péd. mars', subtitle: 'PDF - 2 pages', leadingIcon: Icons.picture_as_pdf),
          ListItemCard(title: 'Rapport financier Q1', subtitle: 'XLSX - Mis à jour 01/03', leadingIcon: Icons.table_chart),
          ListItemCard(title: 'Présentation projet numérique', subtitle: 'PPTX - 15 diapositives', leadingIcon: Icons.slideshow),
          ListItemCard(title: 'Bilan social 2024', subtitle: 'PDF - 45 pages', leadingIcon: Icons.picture_as_pdf),
        ],
      ],
    );
  }
}
