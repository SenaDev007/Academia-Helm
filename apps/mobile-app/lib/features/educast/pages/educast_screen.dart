import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/educast_provider.dart';

class EducastScreen extends ConsumerWidget {
  const EducastScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'educast');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'educast-dashboard': return const _DashboardContent();
          case 'educast-channels': return const _ChannelsContent();
          case 'educast-courses': return const _CoursesContent();
          case 'educast-videos': return const _VideosContent();
          case 'educast-podcasts': return const _PodcastsContent();
          case 'educast-live': return const _LiveContent();
          case 'educast-playlists': return const _PlaylistsContent();
          case 'educast-categories': return const _CategoriesContent();
          case 'educast-analytics': return const _AnalyticsContent();
          case 'educast-comments': return const _CommentsContent();
          case 'educast-ratings': return const _RatingsContent();
          case 'educast-bookmarks': return const _BookmarksContent();
          case 'educast-history': return const _HistoryContent();
          case 'educast-downloads': return const _DownloadsContent();
          case 'educast-subscriptions': return const _SubscriptionsContent();
          case 'educast-reports': return const _ReportsContent();
          case 'educast-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(educastDashboardProvider),
      moduleName: 'EduCast',
      onRetry: () => ref.invalidate(educastDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Chaînes', valueKey: 'channels_count', defaultValue: '—', icon: Icons.tv),
        StatCardConfig(title: 'Vidéos', valueKey: 'videos_count', defaultValue: '—', icon: Icons.video_library, iconColor: AHColors.info),
        StatCardConfig(title: 'Vues ce mois', valueKey: 'views_this_month', defaultValue: '—', icon: Icons.visibility, iconColor: AHColors.success),
        StatCardConfig(title: 'Abonnés', valueKey: 'subscribers_count', defaultValue: '—', icon: Icons.people, iconColor: AHColors.gold),
      ],
    );
  }
}

class _ChannelsContent extends ConsumerWidget {
  const _ChannelsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(educastChannelsProvider),
      moduleName: 'Chaînes',
      emptyTitle: 'Aucune chaîne',
      emptySubtitle: 'Appuyez sur + pour créer une chaîne',
      onRetry: () => ref.invalidate(educastChannelsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle chaîne', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom'),
          AddFieldConfig(key: 'description', label: 'Description'),
        ]);
        if (data != null) ref.read(educastMutationProvider.notifier).createChannel(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Chaîne',
        subtitle: item['description'] ?? '${item['videos_count'] ?? ''} vidéos',
        leadingIcon: Icons.tv,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: StatusBadgeType.success),
      ),
    );
  }
}

class _VideosContent extends ConsumerWidget {
  const _VideosContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(educastVideosProvider),
      moduleName: 'Vidéos',
      emptyTitle: 'Aucune vidéo',
      emptySubtitle: 'Les vidéos apparaîtront ici',
      onRetry: () => ref.invalidate(educastVideosProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Vidéo',
        subtitle: '${item['views'] ?? ''} vues - ${item['duration'] ?? ''}',
        leadingIcon: Icons.play_circle,
      ),
    );
  }
}

// Sub-tabs without dedicated providers
class _CoursesContent extends ConsumerWidget {
  const _CoursesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Cours')]);
}
class _PodcastsContent extends ConsumerWidget {
  const _PodcastsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Podcasts')]);
}
class _LiveContent extends ConsumerWidget {
  const _LiveContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'En direct')]);
}
class _PlaylistsContent extends ConsumerWidget {
  const _PlaylistsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Playlists')]);
}
class _CategoriesContent extends ConsumerWidget {
  const _CategoriesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Catégories')]);
}
class _AnalyticsContent extends ConsumerWidget {
  const _AnalyticsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Analytique')]);
}
class _CommentsContent extends ConsumerWidget {
  const _CommentsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Commentaires')]);
}
class _RatingsContent extends ConsumerWidget {
  const _RatingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Évaluations')]);
}
class _BookmarksContent extends ConsumerWidget {
  const _BookmarksContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Favoris')]);
}
class _HistoryContent extends ConsumerWidget {
  const _HistoryContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Historique')]);
}
class _DownloadsContent extends ConsumerWidget {
  const _DownloadsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Téléchargements')]);
}
class _SubscriptionsContent extends ConsumerWidget {
  const _SubscriptionsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Abonnements')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}
