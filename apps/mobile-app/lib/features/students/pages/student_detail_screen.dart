import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// Student detail screen — mirrors the web's 12-tab dossier view.
///
/// Tabs (matching web StudentDossierSection):
/// 1. Identité
/// 2. Admin
/// 3. Parents
/// 4. Scolarité
/// 5. Documents
/// 6. Carte scolaire
/// 7. Frais
/// 8. Médical
/// 9. Bulletins
/// 10. Observations
/// 11. ORION
/// 12. Audit
class StudentDetailScreen extends ConsumerStatefulWidget {
  const StudentDetailScreen({super.key, required this.studentId});

  final String studentId;

  @override
  ConsumerState<StudentDetailScreen> createState() =>
      _StudentDetailScreenState();
}

class _StudentDetailScreenState extends ConsumerState<StudentDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Identité',
    'Admin',
    'Parents',
    'Scolarité',
    'Documents',
    'Carte',
    'Frais',
    'Médical',
    'Bulletins',
    'Observations',
    'ORION',
    'Audit',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sid = widget.studentId;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(showBackButton: true, title: 'Dossier Élève'),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              labelColor: AHColors.navy,
              unselectedLabelColor: AHColors.grey400,
              indicatorColor: AHColors.gold,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelStyle:
                  const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _IdentityTab(studentId: sid),
                _AdminTab(studentId: sid),
                _ParentsTab(studentId: sid),
                _ScolariteTab(studentId: sid),
                _DocumentsTab(studentId: sid),
                _CardTab(studentId: sid),
                _FeesTab(studentId: sid),
                _MedicalTab(studentId: sid),
                _BulletinsTab(studentId: sid),
                _ObservationsTab(studentId: sid),
                _OrionTab(studentId: sid),
                _AuditTab(studentId: sid),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reusable tab that fetches /students/:id/<section> ────────────────────

class _StudentSectionTab extends ConsumerWidget {
  const _StudentSectionTab({
    required this.studentId,
    required this.section,
    required this.titleField,
    required this.tableColumns,
    required this.icon,
    this.showCreateButton = false,
    this.createLabel = 'Nouveau',
    this.rowActions = const [],
    this.onAction,
  });

  final String studentId;
  final String section;
  final String titleField;
  final List<String> tableColumns;
  final IconData icon;
  final bool showCreateButton;
  final String createLabel;
  final List<RowAction> rowActions;
  final void Function(String actionId, Map<String, dynamic> item)? onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/$studentId/$section',
      titleField: titleField,
      tableColumns: tableColumns,
      icon: icon,
      showCreateButton: showCreateButton,
      createLabel: createLabel,
      rowActions: rowActions,
      onAction: onAction ??
          (actionId, item) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content:
                    Text('Action "$actionId" — en cours d\'implémentation'),
                duration: const Duration(seconds: 2),
              ),
            );
          },
    );
  }
}

// ── Tab 1: Identité ──────────────────────────────────────────────────────

class _IdentityTab extends ConsumerWidget {
  const _IdentityTab({required this.studentId});
  final String studentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiClient = ref.watch(apiClientProvider);
    return FutureBuilder(
      future: apiClient.getRaw('/students/$studentId/dossier'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: AHColors.navy));
        }
        final result = snapshot.data;
        return result?.when(
              success: (data) {
                final student =
                    data['student'] ?? data['data'] ?? data;
                if (student is! Map<String, dynamic>) {
                  return _buildEmpty();
                }
                return _IdentityView(student: student);
              },
              failure: (_) => _buildEmpty(),
              loading: () => const Center(
                  child: CircularProgressIndicator(color: AHColors.navy)),
            ) ??
            _buildEmpty();
      },
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.person_outline, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Élève introuvable',
              style: TextStyle(fontSize: 13, color: AHColors.grey500)),
        ],
      ),
    );
  }
}

class _IdentityView extends StatelessWidget {
  const _IdentityView({required this.student});
  final Map<String, dynamic> student;

  @override
  Widget build(BuildContext context) {
    final fields = <String, String>{};
    for (final entry in student.entries) {
      if (entry.value == null) continue;
      if (entry.value is List || entry.value is Map) continue;
      if (['id', 'tenantId', 'password', 'token', 'salt', 'hash']
          .contains(entry.key)) continue;
      fields[entry.key] = entry.value.toString();
    }

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(AHSpacing.md),
        children: [
          // Avatar + name header
          Container(
            padding: const EdgeInsets.all(AHSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AHColors.navy,
                  child: Text(
                    _initials(),
                    style: const TextStyle(
                        color: AHColors.gold,
                        fontSize: 20,
                        fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${student['firstName'] ?? ''} ${student['lastName'] ?? ''}',
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A)),
                      ),
                      if (student['matricule'] != null)
                        Text('Mat: ${student['matricule']}',
                            style: const TextStyle(
                                fontSize: 11, color: AHColors.grey500)),
                      if (student['className'] != null)
                        Text('Classe: ${student['className']}',
                            style: const TextStyle(
                                fontSize: 11, color: AHColors.grey500)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AHSpacing.md),
          // All fields
          Container(
            padding: const EdgeInsets.all(AHSpacing.md),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: fields.entries.map((e) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 130,
                        child: Text(
                          _humanize(e.key),
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AHColors.grey500),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          e.value,
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String _initials() {
    final f = student['firstName']?.toString() ?? '';
    final l = student['lastName']?.toString() ?? '';
    return '${f.isNotEmpty ? f[0] : ''}${l.isNotEmpty ? l[0] : ''}'
        .toUpperCase();
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
}

// ── Tabs 2-12: Reuse _StudentSectionTab with appropriate config ──────────

class _AdminTab extends ConsumerWidget {
  const _AdminTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'admin',
        titleField: 'field',
        tableColumns: const ['value', 'updatedAt'],
        icon: Icons.admin_panel_settings,
      ).build(context, ref);
}

class _ParentsTab extends ConsumerWidget {
  const _ParentsTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'guardians',
        titleField: 'lastName',
        tableColumns: const ['firstName', 'relationship', 'phone', 'email', 'isPrimary'],
        icon: Icons.family_restroom,
        showCreateButton: true,
        createLabel: 'Ajouter responsable',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(id: 'primary', icon: Icons.star, label: 'Définir principal', color: Color(0xFFD97706)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
      ).build(context, ref);
}

class _ScolariteTab extends ConsumerWidget {
  const _ScolariteTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'enrollment',
        titleField: 'className',
        tableColumns: const ['academicYear', 'enrollmentType', 'status', 'startDate'],
        icon: Icons.school,
      ).build(context, ref);
}

class _DocumentsTab extends ConsumerWidget {
  const _DocumentsTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'documents',
        titleField: 'name',
        tableColumns: const ['type', 'mimeType', 'size', 'uploadedAt', 'status'],
        icon: Icons.folder,
        showCreateButton: true,
        createLabel: 'Uploader document',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
          RowAction(id: 'validate', icon: Icons.check_circle, label: 'Valider', color: Color(0xFF10B981)),
          RowAction(id: 'reject', icon: Icons.cancel, label: 'Refuser', color: Color(0xFFDC2626)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
      ).build(context, ref);
}

class _CardTab extends ConsumerWidget {
  const _CardTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'id-card',
        titleField: 'cardNumber',
        tableColumns: const ['issueDate', 'expiryDate', 'status'],
        icon: Icons.credit_card,
        showCreateButton: true,
        createLabel: 'Générer carte',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'download', icon: Icons.download, label: 'Télécharger PDF', color: Color(0xFF10B981)),
          RowAction(id: 'revoke', icon: Icons.block, label: 'Révoquer', color: Color(0xFFDC2626)),
          RowAction(id: 'reissue', icon: Icons.refresh, label: 'Réémettre', color: Color(0xFFD97706)),
        ],
      ).build(context, ref);
}

class _FeesTab extends ConsumerWidget {
  const _FeesTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Use finance student-accounts endpoint scoped to this student
    return ModuleDataTab(
      endpoint: '/finance/student-accounts',
      params: {'studentId': studentId},
      titleField: 'feeName',
      tableColumns: const ['amount', 'paid', 'balance', 'dueDate', 'status'],
      icon: Icons.account_balance_wallet,
      rowActions: const [
        RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        RowAction(id: 'pay', icon: Icons.payment, label: 'Encaisser', color: Color(0xFF10B981)),
        RowAction(id: 'history', icon: Icons.history, label: 'Historique', color: Color(0xFF6366F1)),
      ],
      onAction: (a, i) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Action "$a" — en cours d\'implémentation'),
            duration: const Duration(seconds: 2),
          ),
        );
      },
    );
  }
}

class _MedicalTab extends ConsumerWidget {
  const _MedicalTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'medical',
        titleField: 'condition',
        tableColumns: const ['type', 'severity', 'notes', 'recordedAt'],
        icon: Icons.medical_services,
        showCreateButton: true,
        createLabel: 'Ajouter info médicale',
      ).build(context, ref);
}

class _BulletinsTab extends ConsumerWidget {
  const _BulletinsTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/institutional-exams/bulletins',
        params: {'studentId': studentId},
        titleField: 'periodName',
        tableColumns: const ['average', 'rank', 'mention', 'status', 'publishedAt'],
        icon: Icons.description,
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'download', icon: Icons.download, label: 'Télécharger PDF', color: Color(0xFF10B981)),
        ],
        onAction: (a, i) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Action "$a" — en cours d\'implémentation'),
              duration: const Duration(seconds: 2),
            ),
          );
        },
      );
}

class _ObservationsTab extends ConsumerWidget {
  const _ObservationsTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'observations',
        titleField: 'title',
        tableColumns: const ['type', 'author', 'createdAt'],
        icon: Icons.note,
        showCreateButton: true,
        createLabel: 'Nouvelle observation',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
      ).build(context, ref);
}

class _OrionTab extends ConsumerWidget {
  const _OrionTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/students/$studentId/orion-alerts',
        titleField: 'title',
        tableColumns: const ['level', 'category', 'createdAt'],
        icon: Icons.insights,
        showCreateButton: false,
        statusFilters: const [
          StatusFilter(id: 'ALL', label: 'Tous'),
          StatusFilter(id: 'CRITICAL', label: 'Critiques'),
          StatusFilter(id: 'HIGH', label: 'Élevés'),
          StatusFilter(id: 'MEDIUM', label: 'Moyens'),
          StatusFilter(id: 'LOW', label: 'Faibles'),
        ],
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'ack', icon: Icons.check, label: 'Acquitter', color: Color(0xFF10B981)),
        ],
        onAction: (a, i) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Action "$a" — en cours d\'implémentation'),
              duration: const Duration(seconds: 2),
            ),
          );
        },
      );
}

class _AuditTab extends ConsumerWidget {
  const _AuditTab({required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => _StudentSectionTab(
        studentId: studentId,
        section: 'audit',
        titleField: 'action',
        tableColumns: const ['entity', 'user', 'createdAt', 'details'],
        icon: Icons.history,
        showCreateButton: false,
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
        ],
      ).build(context, ref);
}
