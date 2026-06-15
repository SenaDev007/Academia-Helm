import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/platform_provider.dart';

class PlatformScreen extends ConsumerWidget {
  const PlatformScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'platform');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'platform-dashboard': return const _DashboardContent();
          case 'platform-tenants': return const _TenantsContent();
          case 'platform-billing': return const _BillingContent();
          case 'platform-audit': return const _AuditContent();
          case 'platform-users': return const _UsersContent();
          case 'platform-roles': return const _RolesContent();
          case 'platform-features': return const _FeaturesContent();
          case 'platform-licenses': return const _LicensesContent();
          case 'platform-analytics': return const _AnalyticsContent();
          case 'platform-support': return const _SupportContent();
          case 'platform-logs': return const _LogsContent();
          case 'platform-backups': return const _BackupsContent();
          case 'platform-integrations': return const _IntegrationsContent();
          case 'platform-api': return const _ApiContent();
          case 'platform-notifications': return const _NotificationsContent();
          case 'platform-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(platformDashboardProvider),
      moduleName: 'Plateforme',
      onRetry: () => ref.invalidate(platformDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Établissements', valueKey: 'tenants_count', defaultValue: '—', icon: Icons.business),
        StatCardConfig(title: 'Utilisateurs totaux', valueKey: 'total_users', defaultValue: '—', icon: Icons.people, iconColor: AHColors.info),
        StatCardConfig(title: 'Revenus mensuels', valueKey: 'monthly_revenue', defaultValue: '—', icon: Icons.euro, iconColor: AHColors.success),
        StatCardConfig(title: 'Tickets support', valueKey: 'support_tickets', defaultValue: '—', icon: Icons.support_agent, iconColor: AHColors.warning),
      ],
    );
  }
}

class _TenantsContent extends ConsumerWidget {
  const _TenantsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(platformTenantsProvider),
      moduleName: 'Établissements',
      emptyTitle: 'Aucun établissement',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(platformTenantsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvel établissement', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom'),
          AddFieldConfig(key: 'plan', label: 'Plan'),
          AddFieldConfig(key: 'subdomain', label: 'Sous-domaine'),
        ]);
        if (data != null) ref.read(platformMutationProvider.notifier).createTenant(data);
      },
      addLabel: 'Ajouter un établissement',
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Établissement',
        subtitle: '${item['plan'] ?? ''} - ${item['students_count'] ?? ''} élèves',
        leadingIcon: Icons.business,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: _st(item['status'])),
      ),
    );
  }
}

class _BillingContent extends ConsumerWidget {
  const _BillingContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Facturation')]);
}
class _AuditContent extends ConsumerWidget {
  const _AuditContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(platformAuditLogsProvider),
      moduleName: 'Audit',
      emptyTitle: 'Aucune entrée d\'audit',
      emptySubtitle: 'Les logs d\'audit apparaîtront ici',
      onRetry: () => ref.invalidate(platformAuditLogsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['action'] ?? 'Entrée d\'audit',
        subtitle: item['timestamp'] ?? '',
        leadingIcon: Icons.shield_check,
        badge: StatusBadge(label: item['status'] ?? 'Vérifié', type: _st(item['status'])),
      ),
    );
  }
}
class _UsersContent extends ConsumerWidget {
  const _UsersContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(platformUsersProvider),
      moduleName: 'Utilisateurs',
      emptyTitle: 'Aucun utilisateur',
      emptySubtitle: 'Les utilisateurs apparaîtront ici',
      onRetry: () => ref.invalidate(platformUsersProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Utilisateur',
        subtitle: '${item['role'] ?? ''} - ${item['tenant'] ?? ''}',
        leadingIcon: Icons.person,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: _st(item['status'])),
      ),
    );
  }
}
class _RolesContent extends ConsumerWidget {
  const _RolesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rôles')]);
}
class _FeaturesContent extends ConsumerWidget {
  const _FeaturesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Fonctionnalités')]);
}
class _LicensesContent extends ConsumerWidget {
  const _LicensesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Licences')]);
}
class _AnalyticsContent extends ConsumerWidget {
  const _AnalyticsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Analytique')]);
}
class _SupportContent extends ConsumerWidget {
  const _SupportContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Support')]);
}
class _LogsContent extends ConsumerWidget {
  const _LogsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Journaux')]);
}
class _BackupsContent extends ConsumerWidget {
  const _BackupsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Sauvegardes')]);
}
class _IntegrationsContent extends ConsumerWidget {
  const _IntegrationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Intégrations')]);
}
class _ApiContent extends ConsumerWidget {
  const _ApiContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'API')]);
}
class _NotificationsContent extends ConsumerWidget {
  const _NotificationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Notifications')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('actif') || v.contains('valid') || v.contains('vérifié')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('error') || v.contains('bloqué')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
