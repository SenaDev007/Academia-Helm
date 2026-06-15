import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/general_provider.dart';

class GeneralScreen extends ConsumerWidget {
  const GeneralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'general');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'general-direction': return const _DirectionContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }
}

class _DirectionContent extends ConsumerWidget {
  const _DirectionContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(generalDashboardProvider),
      moduleName: 'Direction',
      onRetry: () => ref.invalidate(generalDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Élèves inscrits', valueKey: 'students_count', defaultValue: '—', icon: Icons.school),
        StatCardConfig(title: 'Personnel', valueKey: 'staff_count', defaultValue: '—', icon: Icons.people, iconColor: AHColors.info),
        StatCardConfig(title: 'Classes', valueKey: 'classes_count', defaultValue: '—', icon: Icons.class_, iconColor: AHColors.gold),
        StatCardConfig(title: 'Budget annuel', valueKey: 'annual_budget', defaultValue: '—', icon: Icons.account_balance_wallet, iconColor: AHColors.success),
      ],
      extraChildren: [
        const SectionHeader(title: 'Actualités'),
        ModuleLoadingWrapper<List<Map<String, dynamic>>>(
          value: ref.watch(generalNewsProvider),
          moduleName: 'Actualités',
          onRetry: () => ref.invalidate(generalNewsProvider),
          builder: (news) {
            if (news.isEmpty) return const Padding(
              padding: EdgeInsets.all(AHSpacing.lg),
              child: Text('Aucune actualité', style: TextStyle(color: AHColors.muted)),
            );
            return Column(children: news.take(5).map((n) => ListItemCard(
              title: n['title'] ?? 'Actualité',
              subtitle: n['date'] ?? '',
              leadingIcon: Icons.article,
            )).toList());
          },
        ),
      ],
    );
  }
}
