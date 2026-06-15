import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
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
        ListItemCard(title: 'Nom de l\'établissement', subtitle: data['name'] ?? '—', leadingIcon: Icons.business, leadingIconColor: AHColors.navy),
        ListItemCard(title: 'Adresse', subtitle: data['address'] ?? '—', leadingIcon: Icons.location_on, leadingIconColor: AHColors.info),
        ListItemCard(title: 'Téléphone', subtitle: data['phone'] ?? '—', leadingIcon: Icons.phone, leadingIconColor: AHColors.success),
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
        title: item['label'] ?? 'Année scolaire',
        subtitle: '${item['start_date'] ?? ''} - ${item['end_date'] ?? ''}',
        leadingIcon: Icons.calendar_today,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: _st(item['status'])),
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
        title: item['name'] ?? 'Classe',
        subtitle: '${item['level'] ?? ''} - ${item['student_count'] ?? ''} élèves',
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
        title: item['name'] ?? 'Matière',
        subtitle: 'Coefficient: ${item['coefficient'] ?? '—'}',
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
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rôles')]);
}
class _PermissionsContent extends ConsumerWidget {
  const _PermissionsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Permissions')]);
}
class _FeaturesContent extends ConsumerWidget {
  const _FeaturesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Fonctionnalités')]);
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
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres avancés')]);
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('actif') || v.contains('en cours') || v.contains('valid')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('inactif') || v.contains('archivé')) return StatusBadgeType.neutral;
  return StatusBadgeType.info;
}
