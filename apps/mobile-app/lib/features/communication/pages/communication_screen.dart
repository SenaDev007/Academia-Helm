import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../../../core/widgets/loading/module_loading_wrapper.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';
// Dashboard built from messages count as proxy
final _communicationDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final msgs = await ref.watch(messagesProvider.future);
  return {'received_count': msgs.length};
});

class CommunicationScreen extends ConsumerWidget {
  const CommunicationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'communication');
    final alertsAsync = ref.watch(orionAlertsProvider);
    return Column(
      children: [
        OrionAlertBanner(alertsAsync: alertsAsync),
        Expanded(
          child: StatefulModulePage(
            module: module,
            visibleSubTabs: module.subTabs,
            initialSubTabId: module.subTabs.first.id,
            subTabBuilder: (subTab) {
              switch (subTab.id) {
          case 'communication-dashboard': return const _DashboardContent();
          case 'communication-inbox': return const _InboxContent();
          case 'communication-sent': return const _SentContent();
          case 'communication-announcements': return const _AnnouncementsContent();
          case 'communication-notifications': return const _NotificationsContent();
          case 'communication-newsletter': return const _NewsletterContent();
          case 'communication-sms': return const _SmsContent();
          case 'communication-email': return const _EmailContent();
          case 'communication-push': return const _PushContent();
          case 'communication-templates': return const _TemplatesContent();
          case 'communication-contacts': return const _ContactsContent();
          case 'communication-groups': return const _GroupsContent();
          case 'communication-calendar': return const _CalendarContent();
          case 'communication-media': return const _MediaContent();
          case 'communication-settings': return const _SettingsContent();
          case 'communication-orion': return const _OrionContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
          ),
        ),
      ],
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(_communicationDashboardProvider),
      moduleName: 'Communication',
      onRetry: () => ref.invalidate(_communicationDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Messages reçus', valueKey: 'received_count', defaultValue: '—', icon: Icons.inbox),
        StatCardConfig(title: 'Envoyés aujourd\'hui', valueKey: 'sent_today', defaultValue: '—', icon: Icons.send, iconColor: AHColors.success),
        StatCardConfig(title: 'Annonces actives', valueKey: 'active_announcements', defaultValue: '—', icon: Icons.campaign, iconColor: AHColors.gold),
        StatCardConfig(title: 'SMS envoyés', valueKey: 'sms_sent_month', defaultValue: '—', icon: Icons.sms, iconColor: AHColors.info),
      ],
    );
  }
}

class _InboxContent extends ConsumerWidget {
  const _InboxContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(messagesProvider),
      moduleName: 'Boîte de réception',
      emptyTitle: 'Aucun message',
      emptySubtitle: 'Votre boîte de réception est vide',
      onRetry: () => ref.invalidate(messagesProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['sender'] ?? item['subject'] ?? 'Message',
        subtitle: item['preview'] ?? item['date'] ?? '',
        leadingIcon: Icons.mail,
        badge: StatusBadge(label: item['read'] == true ? 'Lu' : 'Non lu', type: item['read'] == true ? StatusBadgeType.neutral : StatusBadgeType.gold),
      ),
    );
  }
}

class _SentContent extends ConsumerWidget {
  const _SentContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(messagesProvider),
      moduleName: 'Envoyés',
      emptyTitle: 'Aucun message envoyé',
      emptySubtitle: 'Les messages envoyés apparaîtront ici',
      onRetry: () => ref.invalidate(messagesProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['subject'] ?? 'Message envoyé',
        subtitle: '${item['recipients'] ?? ''} - ${item['date'] ?? ''}',
        leadingIcon: Icons.send,
        badge: StatusBadge(label: item['status'] ?? 'Délivré', type: _st(item['status'])),
      ),
    );
  }
}

class _AnnouncementsContent extends ConsumerWidget {
  const _AnnouncementsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(announcementsProvider),
      moduleName: 'Annonces',
      emptyTitle: 'Aucune annonce',
      emptySubtitle: 'Appuyez sur + pour créer une annonce',
      onRetry: () => ref.invalidate(announcementsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle annonce', fields: const [
          AddFieldConfig(key: 'title', label: 'Titre'),
          AddFieldConfig(key: 'content', label: 'Contenu'),
          AddFieldConfig(key: 'target', label: 'Destinataires'),
        ]);
        if (data != null) ref.read(communicationMutationProvider.notifier).createAnnouncement(data);
      },
      addLabel: 'Créer une annonce',
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Annonce',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.campaign,
        badge: StatusBadge(label: item['status'] ?? 'Active', type: _st(item['status'])),
      ),
    );
  }
}

// Simple section placeholders for sub-tabs without dedicated providers
class _NotificationsContent extends ConsumerWidget {
  const _NotificationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Notifications')]);
}
class _NewsletterContent extends ConsumerWidget {
  const _NewsletterContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Newsletter')]);
}
class _SmsContent extends ConsumerWidget {
  const _SmsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'SMS')]);
}
class _EmailContent extends ConsumerWidget {
  const _EmailContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'E-mail')]);
}
class _PushContent extends ConsumerWidget {
  const _PushContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Push')]);
}
class _TemplatesContent extends ConsumerWidget {
  const _TemplatesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Modèles')]);
}
class _ContactsContent extends ConsumerWidget {
  const _ContactsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Contacts')]);
}
class _GroupsContent extends ConsumerWidget {
  const _GroupsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Groupes')]);
}
class _CalendarContent extends ConsumerWidget {
  const _CalendarContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Calendrier')]);
}
class _MediaContent extends ConsumerWidget {
  const _MediaContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Médias')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}

// ─── Orion ──────────────────────────────────────────────────────────────────

class _OrionContent extends ConsumerWidget {
  const _OrionContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpisAsync = ref.watch(orionKpisProvider);
    final insightsAsync = ref.watch(orionInsightsProvider);
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'ORION — Communication'),
      const SizedBox(height: AHSpacing.sm),
      kpisAsync.when(
        data: (kpis) => Wrap(
          spacing: AHSpacing.sm,
          runSpacing: AHSpacing.sm,
          children: kpis.take(4).map((kpi) => SizedBox(
            width: (MediaQuery.of(context).size.width - AHSpacing.xl * 2 - AHSpacing.sm * 3) / 4,
            child: OrionKpiCard(
              label: kpi['label'] ?? kpi['title'] ?? 'KPI',
              value: kpi['value']?.toString() ?? '—',
              trend: kpi['trend'] as String?,
              trendValue: kpi['trendValue'] as String?,
              icon: Icons.message,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'Communication'),
      const SizedBox(height: AHSpacing.lg),
      const SectionHeader(title: 'Alertes actives'),
      ModuleLoadingWrapper<List<Map<String, dynamic>>>(
        value: ref.watch(orionAlertsProvider),
        moduleName: 'Alertes',
        onRetry: () => ref.invalidate(orionAlertsProvider),
        builder: (alerts) {
          if (alerts.isEmpty) return const Padding(
            padding: EdgeInsets.all(AHSpacing.lg),
            child: Text('Aucune alerte active', style: TextStyle(color: AHColors.gray500)),
          );
          return Column(children: alerts.take(5).map((a) => ListItemCard(
            title: a['title'] ?? 'Alerte',
            subtitle: a['description'] ?? '',
            leadingIcon: Icons.warning_amber,
            leadingIconColor: AHColors.warning,
          )).toList());
        },
      ),
    ]);
  }
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('actif') || v.contains('délivré') || v.contains('envoyé') || v.contains('valid')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('error') || v.contains('rejeté')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
