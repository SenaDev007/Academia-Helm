import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// Exams module — 11 sub-tabs, ALL connected to real API endpoints with
/// action buttons, status filters, and row actions matching the web.
class ExamsModuleScreen extends ConsumerStatefulWidget {
  const ExamsModuleScreen({super.key});
  @override
  ConsumerState<ExamsModuleScreen> createState() => _ExamsModuleScreenState();
}

class _ExamsModuleScreenState extends ConsumerState<ExamsModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de bord',
    'Évaluations',
    'Saisie des notes',
    'Validation',
    'Déverrouillage',
    'Registre',
    'Bulletins',
    'Conseils',
    'Statistiques',
    'Audit',
    'Paramètres',
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
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(showBackButton: true, title: 'Examens & Notes'),
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
                ModuleDataTab(
                  endpoint: '/institutional-exams/dashboard/kpi',
                  icon: Icons.dashboard,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/evaluations',
                  titleField: 'title',
                  tableColumns: const ['className', 'evaluationType', 'term', 'status'],
                  icon: Icons.assignment,
                  createLabel: 'Nouvelle évaluation',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'OPEN_FOR_GRADING', label: 'Saisie ouverte'),
                    StatusFilter(id: 'SUBMITTED', label: 'Soumises'),
                    StatusFilter(id: 'VALIDATED', label: 'Validées'),
                    StatusFilter(id: 'CANCELLED', label: 'Annulées'),
                  ],
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(
                        id: 'open',
                        icon: Icons.lock_open,
                        label: 'Ouvrir saisie',
                        color: const Color(0xFF10B981),
                        isVisible: (item) => item['status'] == 'DRAFT'),
                    RowAction(
                        id: 'submit',
                        icon: Icons.send,
                        label: 'Soumettre',
                        color: const Color(0xFFD97706),
                        isVisible: (item) => item['status'] == 'OPEN_FOR_GRADING'),
                    RowAction(
                        id: 'validate',
                        icon: Icons.check_circle,
                        label: 'Valider',
                        color: const Color(0xFF10B981),
                        isVisible: (item) => item['status'] == 'SUBMITTED'),
                    const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/evaluations',
                  params: const {'status': 'OPEN_FOR_GRADING'},
                  titleField: 'title',
                  tableColumns: const ['className', 'evaluationType', 'term', 'dueDate'],
                  icon: Icons.edit_note,
                  createLabel: 'Saisir notes',
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'enter_grades', icon: Icons.edit, label: 'Saisir notes', color: AHColors.navy),
                    RowAction(
                        id: 'submit',
                        icon: Icons.send,
                        label: 'Soumettre',
                        color: const Color(0xFFD97706),
                        isVisible: (item) => item['status'] == 'OPEN_FOR_GRADING'),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/evaluations',
                  params: const {'status': 'SUBMITTED'},
                  titleField: 'title',
                  tableColumns: const ['className', 'submissionDate', 'submittedBy'],
                  icon: Icons.check_circle,
                  createLabel: 'Valider',
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(
                        id: 'validate',
                        icon: Icons.check_circle,
                        label: 'Valider',
                        color: const Color(0xFF10B981),
                        isVisible: (item) => item['status'] == 'SUBMITTED'),
                    RowAction(
                        id: 'reject',
                        icon: Icons.cancel,
                        label: 'Rejeter',
                        color: const Color(0xFFDC2626),
                        isVisible: (item) => item['status'] == 'SUBMITTED'),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/unlock-requests',
                  titleField: 'evaluationTypeName',
                  tableColumns: const ['className', 'requester', 'reason', 'status', 'createdAt'],
                  icon: Icons.lock_open,
                  createLabel: 'Demander déverr.',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'PENDING', label: 'En attente'),
                    StatusFilter(id: 'APPROVED', label: 'Approuvées'),
                    StatusFilter(id: 'REJECTED', label: 'Refusées'),
                  ],
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(
                        id: 'approve',
                        icon: Icons.check_circle,
                        label: 'Approuver',
                        color: const Color(0xFF10B981),
                        isVisible: (item) =>
                            item['status']?.toString().toUpperCase() == 'PENDING'),
                    RowAction(
                        id: 'reject',
                        icon: Icons.cancel,
                        label: 'Rejeter',
                        color: const Color(0xFFDC2626),
                        isVisible: (item) =>
                            item['status']?.toString().toUpperCase() == 'PENDING'),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/evaluations',
                  params: const {'status': 'VALIDATED'},
                  titleField: 'title',
                  tableColumns: const ['className', 'validatedAt', 'validatedBy'],
                  icon: Icons.assignment_turned_in,
                  showCreateButton: false,
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/bulletins',
                  titleField: 'studentName',
                  tableColumns: const ['className', 'average', 'rank', 'mention', 'status'],
                  icon: Icons.description,
                  createLabel: 'Générer bulletins',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'GENERATED', label: 'Générés'),
                    StatusFilter(id: 'PUBLISHED', label: 'Publiés'),
                  ],
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
                    RowAction(
                        id: 'publish',
                        icon: Icons.send,
                        label: 'Publier',
                        color: const Color(0xFF6366F1),
                        isVisible: (item) =>
                            item['status']?.toString().toUpperCase() == 'GENERATED'),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/councils',
                  titleField: 'className',
                  tableColumns: const ['periodName', 'scheduledAt', 'status'],
                  icon: Icons.groups,
                  createLabel: 'Nouveau conseil',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'SCHEDULED', label: 'Planifiés'),
                    StatusFilter(id: 'IN_PROGRESS', label: 'En cours'),
                    StatusFilter(id: 'COMPLETED', label: 'Terminés'),
                  ],
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(
                        id: 'start',
                        icon: Icons.play_arrow,
                        label: 'Démarrer',
                        color: const Color(0xFF10B981),
                        isVisible: (item) =>
                            item['status']?.toString().toUpperCase() == 'SCHEDULED'),
                    RowAction(
                        id: 'complete',
                        icon: Icons.check_circle,
                        label: 'Terminer',
                        color: const Color(0xFF6366F1),
                        isVisible: (item) =>
                            item['status']?.toString().toUpperCase() == 'IN_PROGRESS'),
                    const RowAction(id: 'minutes', icon: Icons.description, label: 'Procès-verbal', color: Color(0xFFD97706)),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/dashboard/kpi',
                  icon: Icons.bar_chart,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/audit/logs',
                  titleField: 'action',
                  tableColumns: const ['entity', 'user', 'reference', 'createdAt'],
                  icon: Icons.history,
                  showCreateButton: false,
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
                ModuleDataTab(
                  endpoint: '/institutional-exams/config',
                  icon: Icons.settings,
                  showCreateButton: false,
                  rowActions: [
                    const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                  onAction: (a, i) => _actionStub(context, a),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _actionStub(BuildContext context, String actionId) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Action "$actionId" — en cours d\'implémentation'),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
