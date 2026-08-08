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
        title: '${(item['first_name'] as String?) ?? ''} ${(item['last_name'] as String?) ?? ''}'.trim(),
        subtitle: (item['role'] as String?) ?? (item['position'] as String?) ?? '',
        leadingIcon: Icons.person,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'Actif', type: _st(item['status'])),
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
        title: (item['staff_name'] as String?) ?? (item['reference'] as String?) ?? 'Contrat',
        subtitle: (item['type'] as String?) ?? '',
        leadingIcon: Icons.description,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'Actif', type: _st(item['status'])),
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
        title: (item['label'] as String?) ?? (item['reference'] as String?) ?? 'Fiche de paie',
        subtitle: '${(item['amount'] as String?) ?? '—'} FCFA',
        leadingIcon: Icons.payments,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'En préparation', type: _st(item['status'])),
      ),
    );
  }
}
class _LeaveContent extends ConsumerWidget {
  const _LeaveContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leavesAsync = ref.watch(leavesProvider);
    return leavesAsync.when(
      data: (items) {
        if (items.isEmpty) {
          return _buildEmpty(ref, context);
        }
        return RefreshIndicator(
          color: AHColors.navy,
          onRefresh: () async => ref.invalidate(leavesProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(AHSpacing.md),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 4),
            itemBuilder: (context, index) {
              final item = items[index];
              return _LeaveCard(
                item: item,
                onApprove: () async {
                  final id = (item['id'] ?? '').toString();
                  if (id.isNotEmpty) {
                    await ref.read(hrMutationProvider.notifier).approveLeave(id);
                    ref.invalidate(leavesProvider);
                  }
                },
                onReject: () async {
                  final id = (item['id'] ?? '').toString();
                  if (id.isEmpty) return;
                  final comment = await _showRejectDialog(context);
                  if (comment != null && comment.isNotEmpty) {
                    await ref.read(hrMutationProvider.notifier).rejectLeave(id, comment);
                    ref.invalidate(leavesProvider);
                  }
                },
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildError(ref, context),
    );
  }

  Widget _buildEmpty(WidgetRef ref, BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.event_busy, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Aucune demande de congé', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: () => _showAddDialog(context, ref),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Nouvelle demande'),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildError(WidgetRef ref, BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
          const SizedBox(height: 8),
          const Text('Erreur de chargement', style: TextStyle(fontSize: 14, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => ref.invalidate(leavesProvider),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddDialog(BuildContext context, WidgetRef ref) async {
    final data = await showAddItemDialog(context, title: 'Demande de congé', fields: const [
      AddFieldConfig(key: 'staff_name', label: 'Employé'),
      AddFieldConfig(key: 'dates', label: 'Dates'),
      AddFieldConfig(key: 'type', label: 'Type (CP, RTT...)'),
    ]);
    if (data != null) {
      await ref.read(hrMutationProvider.notifier).createLeave(data);
      ref.invalidate(leavesProvider);
    }
  }

  Future<String?> _showRejectDialog(BuildContext context) async {
    String comment = '';
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rejeter la demande', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AHColors.navy)),
        content: TextField(
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Motif du rejet',
            hintText: 'Expliquez la raison...',
            isDense: true,
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          maxLines: 3,
          onChanged: (v) => comment = v,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, null), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, comment),
            style: ElevatedButton.styleFrom(backgroundColor: AHColors.error, foregroundColor: Colors.white),
            child: const Text('Rejeter'),
          ),
        ],
      ),
    );
  }
}

class _LeaveCard extends StatelessWidget {
  const _LeaveCard({required this.item, required this.onApprove, required this.onReject});
  final Map<String, dynamic> item;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final status = (item['status'] as String?) ?? 'pending';
    final isPending = status.toLowerCase().contains('pending') || status.toLowerCase().contains('attente');
    final staffName = (item['staff_name'] as String?) ?? (item['employeeName'] as String?) ?? 'Employé';
    final dates = (item['dates'] as String?) ?? (item['dateRange'] as String?) ?? '';
    final type = (item['type'] as String?) ?? '';

    final statusColor = isPending ? const Color(0xFFF59E0B) :
        status.toLowerCase().contains('approved') || status.toLowerCase().contains('approuvé') ?
        const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final statusLabel = isPending ? 'En attente' :
        status.toLowerCase().contains('approved') || status.toLowerCase().contains('approuvé') ?
        'Approuvé' : 'Rejeté';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.event_busy, size: 18, color: statusColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(staffName,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: Text(statusLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          if (dates.isNotEmpty || type.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                if (dates.isNotEmpty) ...[
                  Icon(Icons.calendar_today, size: 12, color: AHColors.grey400),
                  const SizedBox(width: 2),
                  Text(dates, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                  const SizedBox(width: 8),
                ],
                if (type.isNotEmpty) ...[
                  Icon(Icons.label, size: 12, color: AHColors.grey400),
                  const SizedBox(width: 2),
                  Text(type, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ],
              ],
            ),
          ],
          // Approve / Reject buttons (only for pending)
          if (isPending) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 32,
                    child: ElevatedButton.icon(
                      onPressed: onApprove,
                      icon: const Icon(Icons.check, size: 14),
                      label: const Text('Approuver', style: TextStyle(fontSize: 11)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 32,
                    child: OutlinedButton.icon(
                      onPressed: onReject,
                      icon: const Icon(Icons.close, size: 14),
                      label: const Text('Rejeter', style: TextStyle(fontSize: 11)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626)),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
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
              label: (kpi['label'] as String?) ?? (kpi['title'] as String?) ?? 'KPI',
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
            title: (a['title'] as String?) ?? 'Alerte',
            subtitle: (a['description'] as String?) ?? '',
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
