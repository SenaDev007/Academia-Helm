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
import '../providers/hr_provider.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';

class HrScreen extends ConsumerWidget {
  const HrScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'hr');
    final subTabs = module.subTabs;
    final alertsAsync = ref.watch(orionAlertsProvider);
    return Column(
      children: [
        OrionAlertBanner(alertsAsync: alertsAsync),
        Expanded(
          child: StatefulModulePage(
            module: module,
            visibleSubTabs: subTabs,
            initialSubTabId: subTabs.first.id,
            subTabBuilder: (subTab) {
              switch (subTab.id) {
          case 'hr-dashboard': return const _DashboardContent();
          case 'hr-staff': return const _StaffContent();
          case 'hr-recruitment': return const _RecruitmentContent();
          case 'hr-contracts': return const _ContractsContent();
          case 'hr-payroll': return const _PayrollContent();
          case 'hr-leave': return const _LeaveContent();
          case 'hr-training': return const _TrainingContent();
          case 'hr-evaluations': return const _EvaluationsContent();
          case 'hr-discipline': return const _DisciplineContent();
          case 'hr-documents': return const _DocumentsContent();
          case 'hr-orgchart': return const _OrgchartContent();
          case 'hr-policies': return const _PoliciesContent();
          case 'hr-reports': return const _ReportsContent();
          case 'hr-settings': return const _SettingsContent();
          case 'hr-orion': return const _OrionContent();
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
      dashboardAsync: ref.watch(staffProvider).whenData((_) => <String, dynamic>{'count': _.length}),
      moduleName: 'Ressources Humaines',
      onRetry: () => ref.invalidate(staffProvider),
      statCards: const [
        StatCardConfig(title: 'Effectif total', valueKey: 'count', defaultValue: '—', icon: Icons.people, subtitle: 'Personnel'),
        StatCardConfig(title: 'Enseignants', valueKey: 'teachers_count', defaultValue: '—', icon: Icons.school, iconColor: AHColors.info),
        StatCardConfig(title: 'Congés en cours', valueKey: 'active_leaves', defaultValue: '—', icon: Icons.beach_access, iconColor: AHColors.success),
        StatCardConfig(title: 'Recrutement', valueKey: 'open_positions', defaultValue: '—', icon: Icons.person_add, iconColor: AHColors.gold),
      ],
    );
  }
}

class _StaffContent extends ConsumerWidget {
  const _StaffContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(staffProvider),
      moduleName: 'Personnel',
      emptyTitle: 'Aucun membre du personnel',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(staffProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau personnel', fields: const [
          AddFieldConfig(key: 'first_name', label: 'Prénom'),
          AddFieldConfig(key: 'last_name', label: 'Nom'),
          AddFieldConfig(key: 'role', label: 'Poste'),
        ]);
        if (data != null) ref.read(hrMutationProvider.notifier).createStaff(data);
      },
      addLabel: 'Ajouter du personnel',
      itemBuilder: (item) => ListItemCard(
        title: '${item['first_name'] ?? ''} ${item['last_name'] ?? ''}'.trim(),
        subtitle: item['role'] ?? item['position'] ?? '',
        leadingIcon: Icons.person,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: _st(item['status'])),
      ),
    );
  }
}

class _RecruitmentContent extends ConsumerWidget {
  const _RecruitmentContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Recrutement'), PlaceholderContent(title: 'Recrutement', icon: Icons.work, description: 'Gestion des offres d\'emploi et candidatures')]);
  }
}
class _ContractsContent extends ConsumerWidget {
  const _ContractsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(contractsProvider),
      moduleName: 'Contrats',
      emptyTitle: 'Aucun contrat trouvé',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(contractsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau contrat', fields: const [
          AddFieldConfig(key: 'staff_name', label: 'Employé'),
          AddFieldConfig(key: 'type', label: 'Type (CDI, CDD...)'),
          AddFieldConfig(key: 'start_date', label: 'Date de début'),
        ]);
        if (data != null) ref.read(hrMutationProvider.notifier).createContract(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['staff_name'] ?? item['reference'] ?? 'Contrat',
        subtitle: item['type'] ?? '',
        leadingIcon: Icons.description,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: _st(item['status'])),
      ),
    );
  }
}
class _PayrollContent extends ConsumerWidget {
  const _PayrollContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(payrollProvider),
      moduleName: 'Paie',
      emptyTitle: 'Aucune fiche de paie',
      emptySubtitle: 'Les fiches apparaîtront ici',
      onRetry: () => ref.invalidate(payrollProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['label'] ?? item['reference'] ?? 'Fiche de paie',
        subtitle: '${item['amount'] ?? '—'} €',
        leadingIcon: Icons.payments,
        badge: StatusBadge(label: item['status'] ?? 'En préparation', type: _st(item['status'])),
      ),
    );
  }
}
class _LeaveContent extends ConsumerWidget {
  const _LeaveContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(leavesProvider),
      moduleName: 'Congés',
      emptyTitle: 'Aucune demande de congé',
      emptySubtitle: 'Appuyez sur + pour faire une demande',
      onRetry: () => ref.invalidate(leavesProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Demande de congé', fields: const [
          AddFieldConfig(key: 'staff_name', label: 'Employé'),
          AddFieldConfig(key: 'dates', label: 'Dates'),
          AddFieldConfig(key: 'type', label: 'Type (CP, RTT...)'),
        ]);
        if (data != null) ref.read(hrMutationProvider.notifier).createLeave(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['staff_name'] ?? 'Demande de congé',
        subtitle: item['dates'] ?? '',
        leadingIcon: Icons.event_busy,
        badge: StatusBadge(label: item['status'] ?? 'En attente', type: _st(item['status'])),
      ),
    );
  }
}
class _TrainingContent extends ConsumerWidget {
  const _TrainingContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Formation')]);
  }
}
class _EvaluationsContent extends ConsumerWidget {
  const _EvaluationsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Évaluations')]);
  }
}
class _DisciplineContent extends ConsumerWidget {
  const _DisciplineContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Discipline')]);
  }
}
class _DocumentsContent extends ConsumerWidget {
  const _DocumentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Documents RH')]);
  }
}
class _OrgchartContent extends ConsumerWidget {
  const _OrgchartContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Organigramme')]);
  }
}
class _PoliciesContent extends ConsumerWidget {
  const _PoliciesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Politiques RH')]);
  }
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Rapports RH')]);
  }
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Paramètres RH')]);
  }
}

// ─── Orion ──────────────────────────────────────────────────────────────────

class _OrionContent extends ConsumerWidget {
  const _OrionContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpisAsync = ref.watch(orionKpisProvider);
    final insightsAsync = ref.watch(orionInsightsProvider);
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'ORION — RH'),
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
              icon: Icons.people,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'RH'),
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
  if (v.contains('valid') || v.contains('actif') || v.contains('payé')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('rejeté') || v.contains('error')) return StatusBadgeType.error;
  if (v.contains('inactif') || v.contains('archivé')) return StatusBadgeType.neutral;
  return StatusBadgeType.info;
}
