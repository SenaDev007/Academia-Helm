import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../../../core/widgets/loading/module_loading_wrapper.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'settings');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'settings-dashboard': return const _DashboardContent();
          case 'settings-general': return const _GeneralContent();
          case 'settings-academic-year': return const _AcademicYearContent();
          case 'settings-classes': return const _ClassesContent();
          case 'settings-subjects': return const _SubjectsContent();
          case 'settings-periods': return const _PeriodsContent();
          case 'settings-grading': return const _GradingContent();
          case 'settings-rooms': return const _RoomsContent();
          case 'settings-roles': return const _RolesContent();
          case 'settings-permissions': return const _PermissionsContent();
          case 'settings-features': return const _FeaturesContent();
          case 'settings-import': return const _ImportContent();
          case 'settings-export': return const _ExportContent();
          case 'settings-backup': return const _BackupContent();
          case 'settings-advanced': return const _AdvancedContent();
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
      dashboardAsync: ref.watch(generalSettingsProvider),
      moduleName: 'Paramètres',
      onRetry: () => ref.invalidate(generalSettingsProvider),
      statCards: const [
        StatCardConfig(title: 'Classes configurées', valueKey: 'classes_count', defaultValue: '—', icon: Icons.class_),
        StatCardConfig(title: 'Matières actives', valueKey: 'subjects_count', defaultValue: '—', icon: Icons.book, iconColor: AHColors.info),
        StatCardConfig(title: 'Rôles définis', valueKey: 'roles_count', defaultValue: '—', icon: Icons.shield, iconColor: AHColors.gold),
        StatCardConfig(title: 'Dernière sauvegarde', valueKey: 'last_backup', defaultValue: '—', icon: Icons.cloud_done, iconColor: AHColors.success),
      ],
    );
  }
}

class _GeneralContent extends ConsumerWidget {
  const _GeneralContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleLoadingWrapper<Map<String, dynamic>>(
      value: ref.watch(generalSettingsProvider),
      moduleName: 'Paramètres généraux',
      onRetry: () => ref.invalidate(generalSettingsProvider),
      builder: (data) => SubTabContentWrapper(children: [
        const SectionHeader(title: 'Paramètres généraux'),
        ListItemCard(title: 'Nom de l\'établissement', subtitle: (data['name'] as String?) ?? '—', leadingIcon: Icons.business, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Adresse', subtitle: (data['address'] as String?) ?? '—', leadingIcon: Icons.location_on, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Téléphone', subtitle: (data['phone'] as String?) ?? '—', leadingIcon: Icons.phone, leadingIconColor: AHColors.success),
        ListItemCard(title: 'Logo', subtitle: data['logo_url'] != null ? 'Configuré' : 'Non configuré', leadingIcon: Icons.image, leadingIconColor: AHColors.gold),
      ]),
    );
  }
}

class _AcademicYearContent extends ConsumerWidget {
  const _AcademicYearContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(academicYearsProvider),
      moduleName: 'Année scolaire',
      emptyTitle: 'Aucune année scolaire',
      emptySubtitle: 'Appuyez sur + pour configurer',
      onRetry: () => ref.invalidate(academicYearsProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['label'] as String?) ?? 'Année scolaire',
        subtitle: '${(item['start_date'] as String?) ?? ''} - ${(item['end_date'] as String?) ?? ''}',
        leadingIcon: Icons.calendar_today,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'En cours', type: _st(item['status'])),
      ),
    );
  }
}

class _ClassesContent extends ConsumerWidget {
  const _ClassesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(classesProvider),
      moduleName: 'Classes',
      emptyTitle: 'Aucune classe configurée',
      emptySubtitle: 'Appuyez sur + pour ajouter une classe',
      onRetry: () => ref.invalidate(classesProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle classe', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom'),
          AddFieldConfig(key: 'level', label: 'Niveau'),
          AddFieldConfig(key: 'capacity', label: 'Capacité'),
        ]);
        if (data != null) ref.read(settingsMutationProvider.notifier).createClass(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: (item['name'] as String?) ?? 'Classe',
        subtitle: '${(item['level'] as String?) ?? ''} - ${(item['student_count'] as String?) ?? ''} élèves',
        leadingIcon: Icons.class_,
        leadingIconColor: AHColors.info,
      ),
    );
  }
}

class _SubjectsContent extends ConsumerWidget {
  const _SubjectsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(settingsSubjectsProvider),
      moduleName: 'Matières',
      emptyTitle: 'Aucune matière configurée',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(settingsSubjectsProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['name'] as String?) ?? 'Matière',
        subtitle: 'Coefficient: ${(item['coefficient'] as String?) ?? '—'}',
        leadingIcon: Icons.book,
        leadingIconColor: AHColors.navy,
      ),
    );
  }
}

class _PeriodsContent extends ConsumerWidget {
  const _PeriodsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Périodes')]);
}
class _GradingContent extends ConsumerWidget {
  const _GradingContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Notation')]);
}
class _RoomsContent extends ConsumerWidget {
  const _RoomsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Salles')]);
}
class _RolesContent extends ConsumerWidget {
  const _RolesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rolesAsync = ref.watch(rolesProvider);
    return rolesAsync.when(
      data: (roles) {
        if (roles.isEmpty) return _buildEmpty('Aucun rôle configuré');
        return ListView.builder(
          padding: const EdgeInsets.all(AHSpacing.md),
          itemCount: roles.length,
          itemBuilder: (context, index) {
            final role = roles[index];
            return Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(children: [
                Container(width: 32, height: 32, decoration: BoxDecoration(color: AHColors.navy.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                  child: const Icon(Icons.admin_panel_settings, size: 18, color: AHColors.navy)),
                const SizedBox(width: 12),
                Expanded(child: Text((role['name'] as String?) ?? (role['label'] as String?) ?? 'Rôle',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                if (role['userCount'] != null)
                  Text('${role['userCount']} utilisateurs', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
              ]),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }
}

class _PermissionsContent extends ConsumerWidget {
  const _PermissionsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permAsync = ref.watch(permissionsProvider);
    return permAsync.when(
      data: (perms) {
        if (perms.isEmpty) return _buildEmpty('Aucune permission configurée');
        return ListView.builder(
          padding: const EdgeInsets.all(AHSpacing.md),
          itemCount: perms.length,
          itemBuilder: (context, index) {
            final perm = perms[index];
            return Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
              child: Row(children: [
                Icon(Icons.lock_outline, size: 16, color: AHColors.grey400),
                const SizedBox(width: 8),
                Expanded(child: Text((perm['resource'] as String?) ?? (perm['name'] as String?) ?? 'Permission',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                if (perm['actions'] != null)
                  Text('${perm['actions']}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
              ]),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }
}

class _FeaturesContent extends ConsumerWidget {
  const _FeaturesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featuresAsync = ref.watch(featuresProvider);
    return featuresAsync.when(
      data: (features) {
        if (features.isEmpty) return _buildEmpty('Aucun module configurable');
        return ListView.builder(
          padding: const EdgeInsets.all(AHSpacing.md),
          itemCount: features.length,
          itemBuilder: (context, index) {
            final feature = features[index];
            final isEnabled = feature['enabled'] == true || feature['isActive'] == true;
            final featureId = (feature['id'] as String?) ?? (feature['code'] as String?) ?? '';
            return _FeatureToggleCard(
              name: (feature['name'] as String?) ?? (feature['label'] as String?) ?? 'Module',
              description: (feature['description'] as String?) ?? '',
              isEnabled: isEnabled,
              onToggle: isEnabled
                ? () => ref.read(settingsMutationProvider.notifier).disableFeature(featureId)
                : () => ref.read(settingsMutationProvider.notifier).enableFeature(featureId),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }
}

class _FeatureToggleCard extends StatelessWidget {
  const _FeatureToggleCard({required this.name, required this.description, required this.isEnabled, required this.onToggle});
  final String name;
  final String description;
  final bool isEnabled;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(
          color: isEnabled ? const Color(0xFF16A34A).withOpacity(0.1) : AHColors.grey100,
          borderRadius: BorderRadius.circular(6)),
          child: Icon(isEnabled ? Icons.check_circle : Icons.circle_outlined, size: 18, color: isEnabled ? const Color(0xFF16A34A) : AHColors.grey400)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          if (description.isNotEmpty) Text(description, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis),
        ])),
        Switch(value: isEnabled, onChanged: (_) => onToggle(), activeColor: AHColors.navy),
      ]),
    );
  }
}

class _ImportContent extends ConsumerWidget {
  const _ImportContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Import')]);
}
class _ExportContent extends ConsumerWidget {
  const _ExportContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Export')]);
}
class _BackupContent extends ConsumerWidget {
  const _BackupContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Sauvegarde')]);
}
class _AdvancedContent extends ConsumerWidget {
  const _AdvancedContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final securityAsync = ref.watch(securitySettingsProvider);
    return securityAsync.when(
      data: (settings) {
        if (settings.isEmpty) return _buildEmpty('Aucune configuration de sécurité');
        return ListView(
          padding: const EdgeInsets.all(AHSpacing.md),
          children: [
            const Text('Sécurité', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AHColors.navy)),
            const SizedBox(height: AHSpacing.sm),
            ...settings.entries.map((e) => _SecurityTile(label: e.key, value: e.value.toString())),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }
}

Widget _buildEmpty(String message) {
  return Center(child: Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.settings, size: 48, color: AHColors.grey300),
      const SizedBox(height: 8),
      Text(message, style: const TextStyle(fontSize: 13, color: AHColors.grey500)),
    ],
  ));
}

class _SecurityTile extends StatelessWidget {
  const _SecurityTile({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Icon(Icons.security, size: 16, color: AHColors.grey400),
        const SizedBox(width: 8),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: value.toLowerCase() == 'true' ? const Color(0xFF16A34A) : AHColors.grey500)),
      ]),
    );
  }
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('actif') || v.contains('en cours') || v.contains('valid')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('inactif') || v.contains('archivé')) return StatusBadgeType.neutral;
  return StatusBadgeType.info;
}
