import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// HR module — 18 sub-tabs, ALL connected to real API endpoints with
/// action buttons, status filters, and row actions matching the web.
class HrModuleScreen extends ConsumerStatefulWidget {
  const HrModuleScreen({super.key});
  @override
  ConsumerState<HrModuleScreen> createState() => _HrModuleScreenState();
}

class _HrModuleScreenState extends ConsumerState<HrModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de bord',
    'Recruteur',
    'Directeurs',
    'Recrutement',
    'Embauche',
    'Personnel',
    'Config. Contrats',
    'Contrats',
    'Collaborateurs',
    'IA RH',
    'Congés',
    'Présences',
    'Planning',
    'Indemnités',
    'Paie',
    'Impôts/CNSS',
    'Rapports',
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
      appBar: const AHAppBar(showBackButton: true, title: 'Ressources Humaines'),
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
                  endpoint: '/hr/overview/dashboard',
                  icon: Icons.dashboard,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/hr/recruitment/settings',
                  icon: Icons.person_search,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/school-directors',
                  titleField: 'name',
                  tableColumns: const ['level', 'email', 'phone', 'status'],
                  icon: Icons.supervisor_account,
                  createLabel: 'Nouveau directeur',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/recruitment/jobs',
                  titleField: 'title',
                  tableColumns: const ['department', 'type', 'status', 'createdAt'],
                  icon: Icons.work,
                  createLabel: 'Nouveau poste',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'OPEN', label: 'Ouverts'),
                    StatusFilter(id: 'CLOSED', label: 'Fermés'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'candidates', icon: Icons.people, label: 'Candidats', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/recruitment/embauches',
                  titleField: 'candidateName',
                  tableColumns: const ['position', 'department', 'status', 'hireDate'],
                  icon: Icons.person_add,
                  createLabel: 'Nouvelle embauche',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'PENDING', label: 'En attente'),
                    StatusFilter(id: 'APPROVED', label: 'Approuvées'),
                    StatusFilter(id: 'COMPLETED', label: 'Complétées'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'onboarding', icon: Icons.assignment_ind, label: 'Onboarding', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/staff',
                  titleField: 'firstName',
                  tableColumns: const ['lastName', 'role', 'email', 'phone', 'status'],
                  icon: Icons.people,
                  createLabel: 'Nouveau personnel',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'ACTIVE', label: 'Actifs'),
                    StatusFilter(id: 'ON_LEAVE', label: 'En congé'),
                    StatusFilter(id: 'SUSPENDED', label: 'Suspendus'),
                    StatusFilter(id: 'TERMINATED', label: 'Terminés'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'card', icon: Icons.badge, label: 'Carte staff', color: Color(0xFFD97706)),
                    RowAction(id: 'terminate', icon: Icons.person_remove, label: 'Terminer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/contract-document-config',
                  icon: Icons.settings,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/contracts',
                  titleField: 'staffName',
                  tableColumns: const ['type', 'startDate', 'endDate', 'status'],
                  icon: Icons.description,
                  createLabel: 'Nouveau contrat',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'ACTIVE', label: 'Actifs'),
                    StatusFilter(id: 'EXPIRED', label: 'Expirés'),
                    StatusFilter(id: 'TERMINATED', label: 'Résiliés'),
                    StatusFilter(id: 'PENDING_SIGNATURE', label: 'En attente signature'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'sign', icon: Icons.draw, label: 'Signer', color: Color(0xFF10B981)),
                    RowAction(id: 'terminate', icon: Icons.cancel, label: 'Résilier', color: Color(0xFFDC2626)),
                    RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF6366F1)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/staff',
                  params: const {'collaborator': 'true'},
                  titleField: 'firstName',
                  tableColumns: const ['lastName', 'role', 'email', 'phone'],
                  icon: Icons.people_outline,
                  createLabel: 'Nouveau collaborateur',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/ia',
                  icon: Icons.psychology,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'chat', icon: Icons.chat, label: 'Discuter', color: AHColors.navy),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/leaves/requests',
                  titleField: 'staff_name',
                  tableColumns: const ['leaveType', 'startDate', 'endDate', 'days', 'status'],
                  icon: Icons.event_busy,
                  createLabel: 'Demande de congé',
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
                    const RowAction(id: 'cancel', icon: Icons.delete, label: 'Annuler', color: Color(0xFF64748B)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/attendance',
                  titleField: 'staffName',
                  tableColumns: const ['date', 'checkIn', 'checkOut', 'status'],
                  icon: Icons.calendar_today,
                  showCreateButton: false,
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'PRESENT', label: 'Présents'),
                    StatusFilter(id: 'ABSENT', label: 'Absents'),
                    StatusFilter(id: 'LATE', label: 'Retards'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Corriger', color: AHColors.navy),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/planning',
                  titleField: 'staffName',
                  tableColumns: const ['shift', 'date', 'startTime', 'endTime'],
                  icon: Icons.schedule,
                  createLabel: 'Nouveau planning',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/allowances/types',
                  titleField: 'name',
                  tableColumns: const ['description', 'amount', 'isRecurring'],
                  icon: Icons.payments,
                  createLabel: 'Nouvelle indemnité',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/payroll/periods',
                  titleField: 'label',
                  tableColumns: const ['month', 'year', 'staffCount', 'totalAmount', 'status'],
                  icon: Icons.account_balance_wallet,
                  createLabel: 'Nouvelle période',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Toutes'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'PROCESSING', label: 'En traitement'),
                    StatusFilter(id: 'PAID', label: 'Payées'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'process', icon: Icons.play_arrow, label: 'Traiter', color: Color(0xFF10B981)),
                    RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF6366F1)),
                    RowAction(id: 'payslips', icon: Icons.receipt, label: 'Bulletin de paie', color: Color(0xFFD97706)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/cnss',
                  icon: Icons.account_balance,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'declare', icon: Icons.send, label: 'Déclarer', color: Color(0xFF10B981)),
                    RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF6366F1)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/overview/analytics',
                  icon: Icons.bar_chart,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'export_excel', icon: Icons.grid_on, label: 'Excel', color: Color(0xFF10B981)),
                    RowAction(id: 'export_pdf', icon: Icons.picture_as_pdf, label: 'PDF', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/hr/settings',
                  icon: Icons.settings,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                  ],
                            ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _stub(BuildContext context, String actionId) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Action "$actionId" — en cours d\'implémentation'),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
