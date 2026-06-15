import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class GeneralScreen extends StatefulWidget {
  const GeneralScreen({super.key});

  @override
  State<GeneralScreen> createState() => _GeneralScreenState();
}

class _GeneralScreenState extends State<GeneralScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'general');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'general-direction':
            return _buildDirectionContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDirectionContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Direction de l\'établissement'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Élèves inscrits', value: '1 247', icon: Icons.school, subtitle: 'Année 2024-2025'),
        StatCard(title: 'Personnel', value: '87', icon: Icons.people, iconColor: AHColors.info, subtitle: 'Tous statuts'),
        StatCard(title: 'Classes', value: '42', icon: Icons.class_, iconColor: AHColors.gold, subtitle: '6 niveaux'),
        StatCard(title: 'Budget annuel', value: '3.0M €', icon: Icons.account_balance_wallet, iconColor: AHColors.success, subtitle: 'En cours'),
      ]),
      const SectionHeader(title: 'Actions de direction'),
      ...[
        ListItemCard(title: 'Réunion équipe de direction', subtitle: 'Aujourd\'hui, 09h00', leadingIcon: Icons.event_available, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)),
        ListItemCard(title: 'Validation ordre du jour CA', subtitle: 'À traiter avant le 15/03', leadingIcon: Icons.assignment, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)),
        ListItemCard(title: 'Bilan T2 à valider', subtitle: 'Diffusion prévue le 28/03', leadingIcon: Icons.fact_check, badge: StatusBadge(label: 'Brouillon', type: StatusBadgeType.neutral)),
      ],
    ]);
  }
}
