import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/meetings_provider.dart';

// Dashboard built from allMeetingsProvider
final _meetingsDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final meetings = await ref.watch(allMeetingsProvider.future);
  return {'meetings_this_month': meetings.length};
});

class MeetingsScreen extends ConsumerWidget {
  const MeetingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'meetings');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'meetings-dashboard': return const _DashboardContent();
          case 'meetings-schedule': return const _ScheduleContent();
          case 'meetings-minutes': return const _MinutesContent();
          case 'meetings-decisions': return const _DecisionsContent();
          case 'meetings-documents': return const _DocumentsContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(_meetingsDashboardProvider),
      moduleName: 'Réunions',
      onRetry: () => ref.invalidate(_meetingsDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Réunions ce mois', valueKey: 'meetings_this_month', defaultValue: '—', icon: Icons.event_available),
        StatCardConfig(title: 'Procès-verbaux', valueKey: 'minutes_count', defaultValue: '—', icon: Icons.description, iconColor: AHColors.info),
        StatCardConfig(title: 'Décisions', valueKey: 'decisions_count', defaultValue: '—', icon: Icons.check_circle, iconColor: AHColors.gold),
        StatCardConfig(title: 'Participants', valueKey: 'participants_count', defaultValue: '—', icon: Icons.people, iconColor: AHColors.success),
      ],
    );
  }
}

class _ScheduleContent extends ConsumerWidget {
  const _ScheduleContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(allMeetingsProvider),
      moduleName: 'Planification',
      emptyTitle: 'Aucune réunion planifiée',
      emptySubtitle: 'Appuyez sur + pour planifier une réunion',
      onRetry: () => ref.invalidate(allMeetingsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle réunion', fields: const [
          AddFieldConfig(key: 'title', label: 'Titre'),
          AddFieldConfig(key: 'date', label: 'Date et heure'),
          AddFieldConfig(key: 'location', label: 'Lieu'),
        ]);
        if (data != null) ref.read(meetingsMutationProvider.notifier).createMeeting(data);
      },
      addLabel: 'Planifier une réunion',
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Réunion',
        subtitle: '${item['date'] ?? ''} - ${item['location'] ?? ''}',
        leadingIcon: Icons.event_available,
        badge: StatusBadge(label: item['status'] ?? 'Planifié', type: _st(item['status'])),
      ),
    );
  }
}

class _MinutesContent extends ConsumerWidget {
  const _MinutesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(meetingMinutesProvider),
      moduleName: 'Procès-verbaux',
      emptyTitle: 'Aucun procès-verbal',
      emptySubtitle: 'Les PV apparaîtront après les réunions',
      onRetry: () => ref.invalidate(meetingMinutesProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Procès-verbal',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.description,
        badge: StatusBadge(label: item['status'] ?? 'En relecture', type: _st(item['status'])),
      ),
    );
  }
}

class _DecisionsContent extends ConsumerWidget {
  const _DecisionsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(meetingDecisionsProvider),
      moduleName: 'Décisions',
      emptyTitle: 'Aucune décision',
      emptySubtitle: 'Les décisions apparaîtront ici',
      onRetry: () => ref.invalidate(meetingDecisionsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Décision',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.check_circle,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: _st(item['status'])),
      ),
    );
  }
}

class _DocumentsContent extends ConsumerWidget {
  const _DocumentsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Documents de réunion')]);
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('valid') || v.contains('actif') || v.contains('appliquée')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard') || v.contains('relecture')) return StatusBadgeType.warning;
  if (v.contains('rejeté')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
