import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/dynamic_form_dialog.dart';
import '../../../core/widgets/module_data_tab.dart';

/// Pedagogy module — 11 sub-tabs, ALL connected to real API endpoints.
class PedagogyModuleScreen extends ConsumerStatefulWidget {
  const PedagogyModuleScreen({super.key});
  @override
  ConsumerState<PedagogyModuleScreen> createState() =>
      _PedagogyModuleScreenState();
}

class _PedagogyModuleScreenState extends ConsumerState<PedagogyModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Dashboard',
    'Structure académique',
    'Matières',
    'Enseignants',
    'Emploi du temps',
    'Espace Pédagogie',
    'Validation Direction',
    'ORION',
    'Travaux & Suivi',
    'Sarah Compose',
    'Cahiers de textes',
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
      appBar: const AHAppBar(showBackButton: true, title: 'Pédagogie'),
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
                  endpoint: '/pedagogy/dashboard',
                  icon: Icons.dashboard,
                  showCreateButton: false,
                  rowActions: const [],
                  onAction: (_, __) {},
                ),
                ModuleDataTab(
                  endpoint: '/settings/classes',
                  titleField: 'name',
                  tableColumns: const ['level', 'capacity', 'studentsCount'],
                  icon: Icons.grid_view,
                  createLabel: 'Nouvelle classe',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'subjects', icon: Icons.book, label: 'Matières', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/subjects',
                  titleField: 'name',
                  tableColumns: const ['code', 'coefficient', 'category'],
                  icon: Icons.book,
                  createLabel: 'Nouvelle matière',
                  createFields: const [
                    FormFieldDef(key: 'name', label: 'Nom', required: true, hint: 'Ex: Mathématiques'),
                    FormFieldDef(key: 'code', label: 'Code', required: true, hint: 'Ex: MATH'),
                    FormFieldDef(key: 'coefficient', label: 'Coefficient', type: FieldType.number, initialValue: 1),
                    FormFieldDef(key: 'category', label: 'Catégorie', type: FieldType.dropdown, options: ['SCIENTIFIQUE', 'LITTERAIRE', 'TECHNIQUE', 'ARTISTIQUE', 'SPORTIVE', 'AUTRE']),
                    FormFieldDef(key: 'weeklyHours', label: 'Heures/semaine', type: FieldType.number, initialValue: 2),
                    FormFieldDef(key: 'language', label: 'Langue', type: FieldType.dropdown, options: ['FR', 'EN', 'BILINGUE']),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/teachers',
                  titleField: 'name',
                  tableColumns: const ['subject', 'email', 'phone', 'classesCount'],
                  icon: Icons.person,
                  createLabel: 'Nouvel enseignant',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'classes', icon: Icons.class_, label: 'Classes', color: Color(0xFF6366F1)),
                    RowAction(id: 'profile', icon: Icons.assignment_ind, label: 'Profil', color: Color(0xFFD97706)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/timetables',
                  titleField: 'className',
                  tableColumns: const ['day', 'startTime', 'endTime', 'subject'],
                  icon: Icons.calendar_today,
                  createLabel: 'Nouvel emploi',
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'copy', icon: Icons.copy, label: 'Copier', color: Color(0xFF6366F1)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy-space/my-classes',
                  titleField: 'className',
                  tableColumns: const ['schoolLevelName', 'studentsCount', 'subject'],
                  icon: Icons.class_,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'attendance', icon: Icons.checklist, label: 'Présences', color: Color(0xFF10B981)),
                    RowAction(id: 'homework', icon: Icons.assignment, label: 'Devoirs', color: Color(0xFFD97706)),
                    RowAction(id: 'grades', icon: Icons.grade, label: 'Notes', color: Color(0xFF6366F1)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/control',
                  titleField: 'className',
                  tableColumns: const ['status', 'submittedBy', 'submittedAt'],
                  icon: Icons.check_box,
                  showCreateButton: false,
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
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/orion-dashboard',
                  icon: Icons.auto_awesome,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'insights', icon: Icons.insights, label: 'Insights', color: Color(0xFF6366F1)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy-space/homeworks',
                  titleField: 'title',
                  tableColumns: const ['className', 'subject', 'dueDate', 'status'],
                  icon: Icons.assignment,
                  createLabel: 'Nouveau devoir',
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'ASSIGNED', label: 'Assignés'),
                    StatusFilter(id: 'SUBMITTED', label: 'Soumis'),
                    StatusFilter(id: 'GRADED', label: 'Corrigés'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
                    RowAction(id: 'grade', icon: Icons.grade, label: 'Corriger', color: Color(0xFF10B981)),
                    RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/sara-compose',
                  icon: Icons.auto_awesome,
                  showCreateButton: false,
                  rowActions: const [
                    RowAction(id: 'compose', icon: Icons.edit, label: 'Composer', color: AHColors.navy),
                    RowAction(id: 'history', icon: Icons.history, label: 'Historique', color: Color(0xFF64748B)),
                  ],
                            ),
                ModuleDataTab(
                  endpoint: '/pedagogy/class-diaries',
                  titleField: 'className',
                  tableColumns: const ['week', 'submittedBy', 'submittedAt', 'status'],
                  icon: Icons.menu_book,
                  showCreateButton: false,
                  statusFilters: const [
                    StatusFilter(id: 'ALL', label: 'Tous'),
                    StatusFilter(id: 'DRAFT', label: 'Brouillons'),
                    StatusFilter(id: 'SUBMITTED', label: 'Soumis'),
                    StatusFilter(id: 'VALIDATED', label: 'Validés'),
                  ],
                  rowActions: const [
                    RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
                    RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
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
