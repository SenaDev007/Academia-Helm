/// ============================================================================
/// MODULE TAB FRAMEWORK — Academia Helm Mobile
/// ============================================================================
///
/// A reusable widget framework that mirrors the web app's data browsing
/// pattern across all modules. Each "data tab" displays:
///
/// 1. Optional KPI cards row (top)
/// 2. Status filter chips (horizontal scrollable)
/// 3. Toolbar (search + sort + filter button + create button)
/// 4. Data table with row actions (tap to view, long-press to delete)
/// 5. Detail bottom sheet with all fields + edit/delete buttons
///
/// This replaces the old `GenericModuleTab` with a richer, more web-aligned
/// UI. The old widget is kept for backwards compatibility but new code
/// should use `ModuleDataTab`.
///

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/services/module_action_service.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import 'dynamic_form_dialog.dart';
import 'generic_module_tab.dart' show KpiCardConfig;

/// Status filter chip configuration.
class StatusFilter {
  final String id;
  final String label;
  final int? count;

  const StatusFilter({required this.id, required this.label, this.count});
}

/// Row action configuration.
class RowAction {
  final String id;
  final IconData icon;
  final String label;
  final Color color;
  final bool Function(Map<String, dynamic> item)? isVisible;

  const RowAction({
    required this.id,
    required this.icon,
    required this.label,
    required this.color,
    this.isVisible,
  });
}

/// A rich module data tab — KPIs + status filters + search + table + actions.
///
/// Usage:
/// ```dart
/// ModuleDataTab(
///   endpoint: '/students/admissions',
///   kpiConfigs: [...],
///   statusFilters: [...],
///   titleField: 'lastName',
///   tableColumns: ['firstName', 'status', 'createdAt'],
///   rowActions: [
///     RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
///     RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
///     RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: AHColors.error),
///   ],
///   onAction: (actionId, item) => _handleAction(actionId, item),
/// )
/// ```
class ModuleDataTab extends ConsumerStatefulWidget {
  const ModuleDataTab({
    super.key,
    required this.endpoint,
    this.params,
    this.kpiConfigs = const [],
    this.statusFilters = const [],
    this.titleField,
    this.subtitleField,
    this.tableColumns = const [],
    this.rowActions = const [],
    this.onAction,
    this.showCreateButton = true,
    this.createLabel = 'Nouveau',
    this.createFields = const [],
    this.emptyMessage = 'Aucune donnée',
    this.icon = Icons.list,
  });

  final String endpoint;
  final Map<String, dynamic>? params;
  final List<KpiCardConfig> kpiConfigs;
  final List<StatusFilter> statusFilters;
  final String? titleField;
  final String? subtitleField;
  final List<String> tableColumns;
  final List<RowAction> rowActions;
  final void Function(String actionId, Map<String, dynamic> item)? onAction;
  final bool showCreateButton;
  final String createLabel;
  /// Fields to show in the create form. If empty, the create button calls
  /// the API with an empty payload.
  final List<FormFieldDef> createFields;
  final String emptyMessage;
  final IconData icon;

  @override
  ConsumerState<ModuleDataTab> createState() => _ModuleDataTabState();
}

class _ModuleDataTabState extends ConsumerState<ModuleDataTab> {
  String _search = '';
  String _activeStatus = 'ALL';
  final _searchCtrl = TextEditingController();
  bool _isExecuting = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  /// Default action handler — uses ModuleActionService to call the API.
  /// If the caller provided an `onAction` callback, that takes priority.
  void _handleAction(String actionId, Map<String, dynamic> item) {
    if (widget.onAction != null) {
      widget.onAction!(actionId, item);
      return;
    }

    // For 'create' action, show a form dialog if createFields are provided
    if (actionId == 'create' && widget.createFields.isNotEmpty) {
      _showCreateForm();
      return;
    }

    // Default behavior: call the ModuleActionService
    _executeViaService(actionId, item);
  }

  /// Shows the create form dialog, then calls the API with the collected data.
  Future<void> _showCreateForm() async {
    final formData = await showDynamicFormDialog(
      context: context,
      title: widget.createLabel,
      fields: widget.createFields,
    );
    if (formData == null) return; // user cancelled

    // Now execute the create action with the form data
    final actionService = ref.read(moduleActionServiceProvider);
    final result = await actionService.executeAction(
      endpoint: widget.endpoint,
      actionId: 'create',
      item: const {},
      extraData: formData,
    );

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.message),
        backgroundColor: result.success ? AHColors.success : AHColors.error,
        duration: const Duration(seconds: 3),
      ),
    );

    // Refresh the data
    if (result.success) {
      final dataParams = (
        endpoint: widget.endpoint,
        params: {
          ...?widget.params,
          if (_activeStatus != 'ALL') 'status': _activeStatus,
        },
      );
      ref.invalidate(_moduleDataProvider(dataParams));
    }
  }

  Future<void> _executeViaService(
      String actionId, Map<String, dynamic> item) async {
    if (_isExecuting) return;
    setState(() => _isExecuting = true);

    // For destructive/irreversible actions, confirm first
    if (actionId == 'delete' || actionId == 'terminate' ||
        actionId == 'revoke' || actionId == 'reject' ||
        actionId == 'cancel') {
      final confirmed = await _confirmAction(actionId, item);
      if (!confirmed) {
        if (mounted) setState(() => _isExecuting = false);
        return;
      }
    }

    final actionService = ref.read(moduleActionServiceProvider);
    final result = await actionService.executeAction(
      endpoint: widget.endpoint,
      actionId: actionId,
      item: item,
    );

    if (!mounted) return;
    setState(() => _isExecuting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.message),
        backgroundColor: result.success ? AHColors.success : AHColors.error,
        duration: const Duration(seconds: 3),
      ),
    );

    // Refresh the data after a successful action
    if (result.success) {
      final dataParams = (
        endpoint: widget.endpoint,
        params: {
          ...?widget.params,
          if (_activeStatus != 'ALL') 'status': _activeStatus,
        },
      );
      ref.invalidate(_moduleDataProvider(dataParams));
    }
  }

  /// Shows a confirmation dialog for destructive actions.
  Future<bool> _confirmAction(
      String actionId, Map<String, dynamic> item) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_confirmTitle(actionId)),
        content: Text(_confirmMessage(actionId, item)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: _actionColor(actionId),
              foregroundColor: Colors.white,
            ),
            child: Text(_confirmLabel(actionId)),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  String _confirmTitle(String actionId) {
    switch (actionId) {
      case 'delete':
        return 'Confirmer la suppression';
      case 'terminate':
        return 'Confirmer la résiliation';
      case 'revoke':
        return 'Confirmer la révocation';
      case 'reject':
        return 'Confirmer le refus';
      case 'cancel':
        return 'Confirmer l\'annulation';
      default:
        return 'Confirmer';
    }
  }

  String _confirmMessage(String actionId, Map<String, dynamic> item) {
    final name = item['name']?.toString() ??
        item['title']?.toString() ??
        item['firstName']?.toString() ??
        item['lastName']?.toString() ??
        item['studentName']?.toString() ??
        'cet élément';
    switch (actionId) {
      case 'delete':
        return 'Voulez-vous vraiment supprimer "$name" ? Cette action est irréversible.';
      case 'terminate':
        return 'Voulez-vous vraiment résilier "$name" ?';
      case 'revoke':
        return 'Voulez-vous vraiment révoquer "$name" ?';
      case 'reject':
        return 'Voulez-vous vraiment refuser "$name" ?';
      case 'cancel':
        return 'Voulez-vous vraiment annuler "$name" ?';
      default:
        return 'Voulez-vous vraiment effectuer cette action sur "$name" ?';
    }
  }

  String _confirmLabel(String actionId) {
    switch (actionId) {
      case 'delete':
        return 'Supprimer';
      case 'terminate':
        return 'Résilier';
      case 'revoke':
        return 'Révoquer';
      case 'reject':
        return 'Refuser';
      case 'cancel':
        return 'Annuler';
      default:
        return 'Confirmer';
    }
  }

  Color _actionColor(String actionId) {
    switch (actionId) {
      case 'delete':
      case 'terminate':
      case 'revoke':
      case 'reject':
      case 'cancel':
        return AHColors.error;
      case 'accept':
      case 'approve':
      case 'validate':
      case 'publish':
      case 'complete':
        return AHColors.success;
      case 'submit':
      case 'start':
      case 'process':
      case 'open':
        return const Color(0xFFD97706);
      default:
        return AHColors.navy;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dataParams = (
      endpoint: widget.endpoint,
      params: {
        ...?widget.params,
        if (_activeStatus != 'ALL') 'status': _activeStatus,
      },
    );

    final dataAsync = ref.watch(_moduleDataProvider(dataParams));
    final kpiAsync = widget.kpiConfigs.isNotEmpty
        ? ref.watch(_kpiProvider((endpoint: widget.endpoint, params: widget.params)))
        : null;

    return Column(
      children: [
        // ── KPI cards row ───────────────────────────────────────────
        if (widget.kpiConfigs.isNotEmpty && kpiAsync != null)
          _KpiRow(
            kpiAsync: kpiAsync,
            configs: widget.kpiConfigs,
          ),

        // ── Status filter chips ──────────────────────────────────────
        if (widget.statusFilters.isNotEmpty)
          _StatusChipRow(
            filters: widget.statusFilters,
            activeId: _activeStatus,
            onSelected: (id) => setState(() => _activeStatus = id),
          ),

        // ── Toolbar ─────────────────────────────────────────────────
        _Toolbar(
          searchController: _searchCtrl,
          searchHint: 'Rechercher...',
          showCreate: widget.showCreateButton,
          createLabel: widget.createLabel,
          onSearch: (v) => setState(() => _search = v),
          onRefresh: () {
            ref.invalidate(_moduleDataProvider(dataParams));
            if (kpiAsync != null) {
              ref.invalidate(_kpiProvider((endpoint: widget.endpoint, params: widget.params)));
            }
          },
          onCreate: () => _handleAction('create', <String, dynamic>{}),
        ),

        // ── Data table ──────────────────────────────────────────────
        Expanded(
          child: RefreshIndicator(
            color: AHColors.navy,
            onRefresh: () async => ref.invalidate(_moduleDataProvider(dataParams)),
            child: dataAsync.when(
              data: (items) {
                final filtered = _filterItems(items);
                if (filtered.isEmpty) return _buildEmpty();
                return _buildList(filtered);
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: AHColors.navy),
              ),
              error: (_, __) => _buildError(dataParams),
            ),
          ),
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _filterItems(List<Map<String, dynamic>> items) {
    if (_search.isEmpty) return items;
    final q = _search.toLowerCase();
    return items.where((item) {
      for (final v in item.values) {
        if (v != null && v.toString().toLowerCase().contains(q)) return true;
      }
      return false;
    }).toList();
  }

  Widget _buildList(List<Map<String, dynamic>> items) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.sm, vertical: AHSpacing.xs),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _DataRow(
          item: item,
          columns: widget.tableColumns,
          titleField: widget.titleField,
          subtitleField: widget.subtitleField,
          icon: widget.icon,
          rowActions: widget.rowActions,
          onTap: () => _showDetailSheet(context, item),
          onAction: (actionId) =>
              _handleAction(actionId, item),
        );
      },
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        SizedBox(
          height: 320,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(widget.icon, size: 48, color: AHColors.grey300),
                const SizedBox(height: 8),
                Text(widget.emptyMessage,
                    style: const TextStyle(
                        fontSize: 13, color: AHColors.grey500)),
                if (widget.showCreateButton) ...[
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () =>
                        _handleAction('create', <String, dynamic>{}),
                    icon: const Icon(Icons.add, size: 16),
                    label: Text(widget.createLabel),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AHColors.navy,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError(
      ({String endpoint, Map<String, dynamic>? params}) dataParams) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
          const SizedBox(height: 8),
          const Text('Erreur de chargement',
              style: TextStyle(fontSize: 13, color: AHColors.grey600)),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => ref.invalidate(_moduleDataProvider(dataParams)),
            style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  void _showDetailSheet(BuildContext context, Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.lg),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AHColors.grey300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      margin: const EdgeInsets.only(bottom: AHSpacing.md),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AHColors.navy.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(widget.icon, color: AHColors.navy, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _extractTitle(item),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      if (item['status'] != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color:
                                _statusColor(item['status'].toString()).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item['status'].toString(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: _statusColor(item['status'].toString()),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AHSpacing.md),
                  ...item.entries
                      .where((e) =>
                          !['id', 'tenantId', 'password', 'token', 'salt', 'hash']
                              .contains(e.key) &&
                          e.value != null &&
                          e.value is! List &&
                          e.value is! Map)
                      .map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(
                                  width: 130,
                                  child: Text(
                                    _humanizeField(e.key),
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AHColors.grey500),
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    e.value.toString(),
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF0F172A)),
                                  ),
                                ),
                              ],
                            ),
                          )),
                  const SizedBox(height: AHSpacing.lg),
                  // Row actions
                  if (widget.rowActions.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widget.rowActions.where((a) {
                        if (a.isVisible == null) return true;
                        return a.isVisible!(item);
                      }).map((a) {
                        return ActionChip(
                          avatar: Icon(a.icon, size: 16, color: a.color),
                          label: Text(a.label,
                              style:
                                  TextStyle(fontSize: 11, color: a.color)),
                          backgroundColor: a.color.withOpacity(0.08),
                          side: BorderSide(color: a.color.withOpacity(0.2)),
                          onPressed: () {
                            Navigator.pop(context);
                            _handleAction(a.id, item);
                          },
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _extractTitle(Map<String, dynamic> item) {
    if (widget.titleField != null) {
      final v = _readField(item, widget.titleField!);
      if (v != null) return v;
    }
    for (final field in [
      'name', 'title', 'label',
      'firstName', 'lastName',
      'staff_name', 'student_name',
    ]) {
      if (item[field] != null) {
        if (field == 'firstName' && item['lastName'] != null) {
          return '${item['lastName']} ${item['firstName']}';
        }
        return item[field].toString();
      }
    }
    return 'Détail';
  }

  String? _readField(Map<String, dynamic> item, String fieldPath) {
    final parts = fieldPath.split('.');
    dynamic value = item;
    for (final part in parts) {
      if (value is Map<String, dynamic>) {
        value = value[part];
      } else {
        return null;
      }
    }
    return value?.toString();
  }

  String _humanizeField(String field) {
    // Convert camelCase to Title Case
    final out = StringBuffer();
    for (var i = 0; i < field.length; i++) {
      final c = field[i];
      if (i > 0 && c.toUpperCase() == c && c.toLowerCase() != c) {
        out.write(' ');
      }
      out.write(i == 0 ? c.toUpperCase() : c);
    }
    return out.toString();
  }

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('active') ||
        s.contains('valid') ||
        s.contains('accept') ||
        s.contains('approved')) return const Color(0xFF10B981);
    if (s.contains('pending') ||
        s.contains('attente') ||
        s.contains('waiting') ||
        s.contains('submitted')) return const Color(0xFFF59E0B);
    if (s.contains('reject') ||
        s.contains('inactive') ||
        s.contains('refus') ||
        s.contains('rejected')) return const Color(0xFFDC2626);
    if (s.contains('converted') || s.contains('inscrit')) return const Color(0xFF6366F1);
    return AHColors.grey400;
  }
}

// ── Providers ───────────────────────────────────────────────────────────

final _moduleDataProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String endpoint, Map<String, dynamic>? params})>(
        (ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw(
    params.endpoint,
    queryParameters: params.params,
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['items'] ?? data['results'] ?? data;
      if (list is List) {
        return list.whereType<Map<String, dynamic>>().toList();
      }
      if (data is Map<String, dynamic> && data.isNotEmpty) {
        return [data];
      }
      return <Map<String, dynamic>>[];
    },
    failure: (_) => <Map<String, dynamic>>[],
    loading: () => <Map<String, dynamic>>[],
  );
});

final _kpiProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, ({String endpoint, Map<String, dynamic>? params})>(
        (ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw(
    params.endpoint,
    queryParameters: params.params,
  );
  return result.when(
    success: (data) => data,
    failure: (_) => <String, dynamic>{},
    loading: () => <String, dynamic>{},
  );
});

// ── KPI row ──────────────────────────────────────────────────────────────

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.kpiAsync, required this.configs});

  final AsyncValue<Map<String, dynamic>> kpiAsync;
  final List<KpiCardConfig> configs;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8FAFC),
      padding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.sm, vertical: AHSpacing.xs),
      child: kpiAsync.when(
        data: (kpi) {
          // If no explicit configs, auto-render all key-value pairs.
          if (configs.isEmpty) {
            final entries = kpi.entries
                .where((e) =>
                    !['id', 'tenantId'].contains(e.key) &&
                    e.value != null &&
                    e.value is! List &&
                    e.value is! Map)
                .take(6)
                .toList();
            return SizedBox(
              height: 80,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: entries.length,
                itemBuilder: (context, index) {
                  final e = entries[index];
                  return _KpiMiniCard(
                    label: _humanize(e.key),
                    value: e.value.toString(),
                  );
                },
              ),
            );
          }
          return SizedBox(
            height: 96,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: configs.length,
              itemBuilder: (context, index) {
                final config = configs[index];
                final value = _extractValue(kpi, config.apiField);
                return _KpiCard(config: config, value: value);
              },
            ),
          );
        },
        loading: () => const SizedBox(
          height: 96,
          child: Center(
            child: SizedBox(
              width: 24, height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: AHColors.navy),
            ),
          ),
        ),
        error: (_, __) => const SizedBox(height: 96),
      ),
    );
  }

  String _humanize(String field) {
    final out = StringBuffer();
    for (var i = 0; i < field.length; i++) {
      final c = field[i];
      if (i > 0 && c.toUpperCase() == c && c.toLowerCase() != c) {
        out.write(' ');
      }
      out.write(i == 0 ? c.toUpperCase() : c);
    }
    return out.toString();
  }

  String _extractValue(Map<String, dynamic> kpi, String fieldPath) {
    final parts = fieldPath.split('.');
    dynamic value = kpi;
    for (final part in parts) {
      if (value is Map<String, dynamic>) {
        value = value[part];
      } else {
        break;
      }
    }
    if (value == null) return '0';
    if (value is num) {
      if (value == value.toInt()) return value.toInt().toString();
      return value.toStringAsFixed(1);
    }
    return value.toString();
  }
}

class _KpiMiniCard extends StatelessWidget {
  const _KpiMiniCard({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 110,
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value,
            style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AHColors.navy),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(label,
            style: const TextStyle(fontSize: 9, color: AHColors.grey500),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.config, required this.value});
  final KpiCardConfig config;
  final String value;

  @override
  Widget build(BuildContext context) {
    final displayValue = '${config.prefix}$value${config.suffix}';
    return Container(
      width: 130,
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 28, height: 28,
                decoration: BoxDecoration(
                    color: config.bg, borderRadius: BorderRadius.circular(6)),
                child: Icon(config.icon, size: 16, color: config.color),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(displayValue,
                  style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w800,
                    color: value == '0' ? AHColors.grey300 : const Color(0xFF0F172A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Text(config.label,
              style: const TextStyle(fontSize: 9, color: AHColors.grey500),
              maxLines: 2,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ── Status chip row ──────────────────────────────────────────────────────

class _StatusChipRow extends StatelessWidget {
  const _StatusChipRow({
    required this.filters,
    required this.activeId,
    required this.onSelected,
  });

  final List<StatusFilter> filters;
  final String activeId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.sm, vertical: 6),
      child: SizedBox(
        height: 32,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          itemCount: filters.length,
          itemBuilder: (context, index) {
            final f = filters[index];
            final isActive = f.id == activeId;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: FilterChip(
                label: Text(
                  f.count != null ? '${f.label} (${f.count})' : f.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isActive ? Colors.white : AHColors.grey600,
                  ),
                ),
                selected: isActive,
                onSelected: (_) => onSelected(f.id),
                selectedColor: AHColors.navy,
                backgroundColor: const Color(0xFFF1F5F9),
                showCheckmark: false,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                padding: const EdgeInsets.symmetric(horizontal: 4),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ── Toolbar ─────────────────────────────────────────────────────────────

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.searchController,
    required this.searchHint,
    required this.showCreate,
    required this.createLabel,
    required this.onSearch,
    required this.onRefresh,
    required this.onCreate,
  });

  final TextEditingController searchController;
  final String searchHint;
  final bool showCreate;
  final String createLabel;
  final ValueChanged<String> onSearch;
  final VoidCallback onRefresh;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AHSpacing.sm, vertical: 6),
      color: Colors.white,
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: searchController,
              onChanged: onSearch,
              decoration: InputDecoration(
                hintText: searchHint,
                hintStyle: TextStyle(fontSize: 12, color: AHColors.grey400),
                prefixIcon: const Icon(Icons.search, size: 18, color: AHColors.grey400),
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AHColors.grey200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: AHColors.grey200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AHColors.navy, width: 1.5),
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
              ),
              style: const TextStyle(fontSize: 13),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AHColors.navy),
            onPressed: onRefresh,
            tooltip: 'Rafraîchir',
            visualDensity: VisualDensity.compact,
          ),
          if (showCreate)
            Container(
              margin: const EdgeInsets.only(left: 4),
              child: ElevatedButton.icon(
                onPressed: onCreate,
                icon: const Icon(Icons.add, size: 16),
                label: Text(createLabel, style: const TextStyle(fontSize: 12)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  minimumSize: const Size(0, 36),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Data row ─────────────────────────────────────────────────────────────

class _DataRow extends StatelessWidget {
  const _DataRow({
    required this.item,
    required this.columns,
    required this.titleField,
    required this.subtitleField,
    required this.icon,
    required this.rowActions,
    required this.onTap,
    this.onAction,
  });

  final Map<String, dynamic> item;
  final List<String> columns;
  final String? titleField;
  final String? subtitleField;
  final IconData icon;
  final List<RowAction> rowActions;
  final VoidCallback onTap;
  final void Function(String actionId)? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          onLongPress: () => _showActionMenu(context),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AHColors.navy.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 16, color: AHColors.navy),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _title,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 8,
                        runSpacing: 2,
                        children: columns
                            .where((c) => !_isTitleField(c))
                            .take(3)
                            .map((c) => _FieldChip(label: c, value: item[c]))
                            .toList(),
                      ),
                    ],
                  ),
                ),
                if (item['status'] != null) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color:
                          _statusColor(item['status'].toString()).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item['status'].toString(),
                      style: TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w700,
                          color: _statusColor(item['status'].toString())),
                    ),
                  ),
                ],
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 16, color: AHColors.grey400),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showActionMenu(BuildContext context) {
    if (rowActions.isEmpty) {
      onTap();
      return;
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Actions',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AHColors.navy)),
                const SizedBox(height: AHSpacing.sm),
                ...rowActions.where((a) {
                  if (a.isVisible == null) return true;
                  return a.isVisible!(item);
                }).map((a) => ListTile(
                      leading: Icon(a.icon, color: a.color, size: 20),
                      title: Text(a.label,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: a.color)),
                      onTap: () {
                        Navigator.pop(context);
                        onAction?.call(a.id);
                      },
                    )),
              ],
            ),
          ),
        );
      },
    );
  }

  bool _isTitleField(String field) {
    if (titleField == field) return true;
    return ['name', 'title', 'firstName', 'staff_name', 'student_name']
        .contains(field);
  }

  String get _title {
    if (titleField != null) {
      final v = _read(item, titleField!);
      if (v != null) return v;
    }
    for (final field in [
      'name', 'title', 'label',
      'firstName', 'staff_name', 'student_name',
    ]) {
      if (item[field] != null) return item[field].toString();
    }
    if (item['firstName'] != null && item['lastName'] != null) {
      return '${item['lastName']} ${item['firstName']}';
    }
    return 'Item';
  }

  String? _read(Map<String, dynamic> item, String path) {
    final parts = path.split('.');
    dynamic v = item;
    for (final p in parts) {
      if (v is Map<String, dynamic>) {
        v = v[p];
      } else {
        return null;
      }
    }
    return v?.toString();
  }

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('active') ||
        s.contains('valid') ||
        s.contains('accept') ||
        s.contains('approved')) return const Color(0xFF10B981);
    if (s.contains('pending') ||
        s.contains('attente') ||
        s.contains('waiting') ||
        s.contains('submitted')) return const Color(0xFFF59E0B);
    if (s.contains('reject') ||
        s.contains('inactive') ||
        s.contains('refus') ||
        s.contains('rejected')) return const Color(0xFFDC2626);
    if (s.contains('converted') || s.contains('inscrit')) return const Color(0xFF6366F1);
    return AHColors.grey400;
  }
}

class _FieldChip extends StatelessWidget {
  const _FieldChip({required this.label, required this.value});
  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    if (value == null) return const SizedBox.shrink();
    final s = value.toString();
    if (s.isEmpty) return const SizedBox.shrink();
    if (s.length > 30) return const SizedBox.shrink();

    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 9, fontFamily: 'Inter'),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(
                color: AHColors.grey500, fontWeight: FontWeight.w500),
          ),
          TextSpan(
            text: s,
            style: const TextStyle(
                color: Color(0xFF0F172A), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
