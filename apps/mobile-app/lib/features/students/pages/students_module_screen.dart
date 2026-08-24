import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/dynamic_form_dialog.dart';
import '../../../core/widgets/generic_module_tab.dart' show KpiCardConfig;
import '../../../core/widgets/module_data_tab.dart';
import '../services/students_service_v2.dart';

/// Students module screen — mirrors the web's StudentsModulePage.tsx
///
/// 13 sub-tabs (matching web exactly):
/// 1. Tableau de Bord — KPIs + quick actions
/// 2. Admissions — list with status filters + actions
/// 3. Inscriptions — tree view (level → class → students)
/// 4. Affectations & Mouvements
/// 5. Liste des Élèves
/// 6. Sorties & Abandons
/// 7. Cartes Scolaires
/// 8. Dossiers Élèves
/// 9. Familles
/// 10. Transferts & Mobilité
/// 11. Historique Scolaire
/// 12. Educmaster
/// 13. ORION, Stats & Audit
class StudentsModuleScreen extends ConsumerStatefulWidget {
  const StudentsModuleScreen({super.key});

  @override
  ConsumerState<StudentsModuleScreen> createState() => _StudentsModuleScreenState();
}

class _StudentsModuleScreenState extends ConsumerState<StudentsModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de Bord',
    'Admissions',
    'Inscriptions',
    'Affectations',
    'Liste des Élèves',
    'Sorties & Abandons',
    'Cartes Scolaires',
    'Dossiers Élèves',
    'Familles',
    'Transferts',
    'Historique',
    'Educmaster',
    'ORION & Stats',
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
      appBar: const AHAppBar(showBackButton: true, title: 'Élèves & Scolarité'),
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
              unselectedLabelStyle: const TextStyle(fontSize: 11),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _DashboardTab(),
                _AdmissionsTab(),
                _EnrollmentsTab(),
                _AssignmentsTab(),
                _StudentListTab(),
                _MovementsTab(),
                _IdCardsTab(),
                _DossiersTab(),
                _FamiliesTab(),
                _TransfersTab(),
                _HistoryTab(),
                _EducmasterTab(),
                _OrionTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Tableau de Bord ───────────────────────────────────────────────

class _DashboardTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(studentStatisticsProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(studentStatisticsProvider),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AHSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Vue d\'ensemble',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AHColors.navy)),
            const SizedBox(height: AHSpacing.sm),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 1.4,
              children: [
                _KpiCard(
                    label: 'Élèves inscrits',
                    value: '${stats.valueOrNull?.active ?? 0}',
                    icon: Icons.check_circle,
                    color: const Color(0xFF10B981),
                    bg: const Color(0xFFF0FDF4)),
                _KpiCard(
                    label: 'Pré-inscrits',
                    value: '${stats.valueOrNull?.preRegistered ?? 0}',
                    icon: Icons.people,
                    color: const Color(0xFF2563EB),
                    bg: const Color(0xFFEFF6FF)),
                _KpiCard(
                    label: 'Adm. acceptées',
                    value: '${stats.valueOrNull?.admissionsAccepted ?? 0}',
                    icon: Icons.assignment_turned_in,
                    color: const Color(0xFFD97706),
                    bg: const Color(0xFFFFFBEB)),
                _KpiCard(
                    label: 'Adm. en attente',
                    value: '${stats.valueOrNull?.admissionsPending ?? 0}',
                    icon: Icons.access_time,
                    color: const Color(0xFFEA580C),
                    bg: const Color(0xFFFFF7ED)),
                _KpiCard(
                    label: 'Archivés',
                    value: '${stats.valueOrNull?.archived ?? 0}',
                    icon: Icons.archive,
                    color: const Color(0xFF64748B),
                    bg: const Color(0xFFF8FAFC)),
                _KpiCard(
                    label: 'Total',
                    value: '${stats.valueOrNull?.total ?? 0}',
                    icon: Icons.school,
                    color: AHColors.navy,
                    bg: const Color(0xFFEFF6FF)),
              ],
            ),
            const SizedBox(height: AHSpacing.lg),
            const Text('Accès rapide',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AHColors.navy)),
            const SizedBox(height: AHSpacing.sm),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 2.5,
              children: [
                _QuickAction(
                    label: 'Nouvelle admission',
                    icon: Icons.person_add,
                    color: const Color(0xFF2563EB),
                    bg: const Color(0xFFEFF6FF),
                    onTap: () {}),
                _QuickAction(
                    label: 'Rechercher un élève',
                    icon: Icons.search,
                    color: const Color(0xFF6366F1),
                    bg: const Color(0xFFEEF2FF),
                    onTap: () {}),
                _QuickAction(
                    label: 'Générer matricules',
                    icon: Icons.badge,
                    color: const Color(0xFF10B981),
                    bg: const Color(0xFFF0FDF4),
                    onTap: () {}),
                _QuickAction(
                    label: 'Cartes scolaires',
                    icon: Icons.credit_card,
                    color: const Color(0xFFD97706),
                    bg: const Color(0xFFFFFBEB),
                    onTap: () {}),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.bg,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                    color: bg, borderRadius: BorderRadius.circular(6)),
                child: Icon(icon, size: 16, color: color),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(value,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A))),
              ),
            ],
          ),
          Text(label,
              style: const TextStyle(fontSize: 10, color: AHColors.grey500)),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.bg,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                    color: bg, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(label,
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Tab 2: Admissions — uses the new ModuleDataTab framework ────────────

class _AdmissionsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ModuleDataTab fetches /students/admissions and displays the list.
    // Status filter counts are computed from the same data — no need for
    // a separate admissionsProvider call (was causing double API fetch).
    return ModuleDataTab(
      endpoint: '/students/admissions',
      titleField: 'lastName',
      tableColumns: const ['firstName', 'admissionNumber', 'gender', 'createdAt'],
      createLabel: 'Nouveau Dossier',
      createFields: const [
        FormFieldDef(key: 'firstName', label: 'Prénom', required: true, hint: 'Ex: Jean-Marie'),
        FormFieldDef(key: 'lastName', label: 'Nom', required: true, hint: 'Ex: KOFFI'),
        FormFieldDef(key: 'gender', label: 'Sexe', type: FieldType.dropdown, options: ['M', 'F']),
        FormFieldDef(key: 'birthDate', label: 'Date de naissance', type: FieldType.date),
        FormFieldDef(key: 'birthPlace', label: 'Lieu de naissance'),
        FormFieldDef(key: 'nationality', label: 'Nationalité', initialValue: 'Béninoise'),
        FormFieldDef(key: 'previousSchool', label: 'Établissement précédent'),
        FormFieldDef(key: 'mainGuardianName', label: 'Nom du responsable'),
        FormFieldDef(key: 'mainGuardianPhone', label: 'Téléphone du responsable', type: FieldType.phone),
        FormFieldDef(key: 'mainGuardianEmail', label: 'Email du responsable', type: FieldType.email),
        FormFieldDef(key: 'isNewStudent', label: 'Nouvel élève', type: FieldType.toggle, initialValue: true),
      ],
      kpiConfigs: const [
        KpiCardConfig(
            label: 'Total Demandes',
            apiField: 'total',
            icon: Icons.description,
            color: Color(0xFF2563EB),
            bg: Color(0xFFEFF6FF)),
        KpiCardConfig(
            label: 'En Attente',
            apiField: 'pending',
            icon: Icons.access_time,
            color: Color(0xFFD97706),
            bg: Color(0xFFFFFBEB)),
        KpiCardConfig(
            label: 'Acceptés',
            apiField: 'accepted',
            icon: Icons.check_circle,
            color: Color(0xFF10B981),
            bg: Color(0xFFF0FDF4)),
        KpiCardConfig(
            label: 'Taux Conversion',
            apiField: 'conversionRate',
            icon: Icons.trending_up,
            color: Color(0xFF6366F1),
            bg: Color(0xFFEEF2FF),
            suffix: '%'),
      ],
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'PENDING', label: 'Brouillons'),
        StatusFilter(id: 'SUBMITTED', label: 'Soumis'),
        StatusFilter(id: 'UNDER_REVIEW', label: 'En examen'),
        StatusFilter(id: 'ACCEPTED', label: 'Acceptés'),
        StatusFilter(id: 'CONVERTED', label: 'Inscrits'),
        StatusFilter(id: 'REJECTED', label: 'Refusés'),
      ],
      icon: Icons.person_add,
      rowActions: [
        const RowAction(
            id: 'view',
            icon: Icons.visibility,
            label: 'Voir le détail',
            color: AHColors.navy),
        const RowAction(
            id: 'edit',
            icon: Icons.edit,
            label: 'Modifier',
            color: AHColors.navy),
        RowAction(
            id: 'submit',
            icon: Icons.send,
            label: 'Soumettre',
            color: const Color(0xFFD97706),
            isVisible: (item) =>
                item['status']?.toString().toUpperCase() == 'PENDING'),
        RowAction(
            id: 'accept',
            icon: Icons.check_circle,
            label: 'Accepter',
            color: const Color(0xFF10B981),
            isVisible: (item) {
              final s = item['status']?.toString().toUpperCase() ?? '';
              return s == 'SUBMITTED' || s == 'UNDER_REVIEW';
            }),
        RowAction(
            id: 'reject',
            icon: Icons.cancel,
            label: 'Refuser',
            color: const Color(0xFFDC2626),
            isVisible: (item) {
              final s = item['status']?.toString().toUpperCase() ?? '';
              return s == 'SUBMITTED' || s == 'UNDER_REVIEW';
            }),
        RowAction(
            id: 'convert',
            icon: Icons.person_add_alt_1,
            label: 'Convertir en élève',
            color: const Color(0xFF6366F1),
            isVisible: (item) =>
                item['status']?.toString().toUpperCase() == 'ACCEPTED'),
        RowAction(
            id: 'delete',
            icon: Icons.delete,
            label: 'Supprimer',
            color: const Color(0xFFDC2626),
            isVisible: (item) => item['convertedStudentId'] == null),
      ],
    );
  }
}

// ── Tab 3: Inscriptions ─────────────────────────────────────────────────

class _EnrollmentsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/enrollments',
      titleField: 'studentName',
      tableColumns: const ['className', 'status', 'enrollmentDate'],
      icon: Icons.how_to_reg,
      createLabel: 'Nouvelle Inscription',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'ACTIVE', label: 'Actifs'),
        StatusFilter(id: 'PENDING', label: 'En attente'),
        StatusFilter(id: 'TRANSFERRED', label: 'Transférés'),
        StatusFilter(id: 'WITHDRAWN', label: 'Retirés'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 4: Affectations & Mouvements ─────────────────────────────────────

class _AssignmentsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/without-physical-class',
      titleField: 'studentName',
      tableColumns: const ['className', 'previousClassName', 'movementType', 'effectiveDate'],
      icon: Icons.swap_horiz,
      createLabel: 'Nouvelle Affectation',
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 5: Liste des Élèves ──────────────────────────────────────────────

class _StudentListTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students',
      titleField: 'lastName',
      tableColumns: const ['firstName', 'matricule', 'className', 'gender', 'status'],
      icon: Icons.people,
      createLabel: 'Nouvel Élève',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'ACTIVE', label: 'Actifs'),
        StatusFilter(id: 'PENDING', label: 'En attente'),
        StatusFilter(id: 'ARCHIVED', label: 'Archivés'),
        StatusFilter(id: 'WITHDRAWN', label: 'Retirés'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'card', icon: Icons.credit_card, label: 'Générer carte', color: Color(0xFFD97706)),
        const RowAction(id: 'archive', icon: Icons.archive, label: 'Archiver', color: Color(0xFF64748B)),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 6: Sorties & Abandons ────────────────────────────────────────────

class _MovementsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students',
      params: const {'status': 'WITHDRAWN'},
      titleField: 'studentName',
      tableColumns: const ['movementType', 'reason', 'effectiveDate', 'status'],
      icon: Icons.exit_to_app,
      createLabel: 'Nouvelle Sortie',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
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
            isVisible: (item) => item['status']?.toString().toUpperCase() == 'PENDING'),
        RowAction(
            id: 'reject',
            icon: Icons.cancel,
            label: 'Rejeter',
            color: const Color(0xFFDC2626),
            isVisible: (item) => item['status']?.toString().toUpperCase() == 'PENDING'),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 7: Cartes Scolaires ──────────────────────────────────────────────

class _IdCardsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/id-cards',
      titleField: 'studentName',
      tableColumns: const ['matricule', 'className', 'issueDate', 'expiryDate', 'status'],
      icon: Icons.credit_card,
      createLabel: 'Générer Cartes',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'ACTIVE', label: 'Actives'),
        StatusFilter(id: 'EXPIRED', label: 'Expirées'),
        StatusFilter(id: 'REVOKED', label: 'Révoquées'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
        RowAction(
            id: 'revoke',
            icon: Icons.block,
            label: 'Révoquer',
            color: const Color(0xFFDC2626),
            isVisible: (item) => item['status']?.toString().toUpperCase() == 'ACTIVE'),
        const RowAction(id: 'reissue', icon: Icons.refresh, label: 'Réémettre', color: Color(0xFFD97706)),
      ],
    );
  }
}

// ── Tab 8: Dossiers Élèves ──────────────────────────────────────────────

class _DossiersTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students',
      titleField: 'lastName',
      tableColumns: const ['firstName', 'matricule', 'className', 'status'],
      icon: Icons.folder,
      createLabel: 'Nouveau Dossier',
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'documents', icon: Icons.attach_file, label: 'Documents', color: Color(0xFF2563EB)),
        const RowAction(id: 'print', icon: Icons.print, label: 'Imprimer', color: Color(0xFF64748B)),
      ],
      onAction: (actionId, item) {
        if (actionId == 'view' && item['id'] != null) {
          context.go('/students/${item['id']}');
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Action "$actionId" — en cours d\'implémentation'),
            duration: const Duration(seconds: 2),
          ),
        );
      },
    );
  }
}

// ── Tab 9: Familles ──────────────────────────────────────────────────────

class _FamiliesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students',
      params: const {'includeGuardians': true},
      titleField: 'lastName',
      tableColumns: const ['firstName', 'matricule', 'className', 'guardians'],
      icon: Icons.family_restroom,
      createLabel: 'Nouvelle Famille',
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'message', icon: Icons.message, label: 'Message', color: Color(0xFF06B6D4)),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 10: Transferts ───────────────────────────────────────────────────

class _TransfersTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/transfers/outgoing',
      titleField: 'studentName',
      tableColumns: const ['fromSchool', 'toSchool', 'transferDate', 'status'],
      icon: Icons.swap_horizontal_circle,
      createLabel: 'Nouveau Transfert',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'PENDING', label: 'En attente'),
        StatusFilter(id: 'APPROVED', label: 'Approuvés'),
        StatusFilter(id: 'COMPLETED', label: 'Complétés'),
        StatusFilter(id: 'REJECTED', label: 'Refusés'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        RowAction(
            id: 'approve',
            icon: Icons.check_circle,
            label: 'Approuver',
            color: const Color(0xFF10B981),
            isVisible: (item) => item['status']?.toString().toUpperCase() == 'PENDING'),
        RowAction(
            id: 'reject',
            icon: Icons.cancel,
            label: 'Rejeter',
            color: const Color(0xFFDC2626),
            isVisible: (item) => item['status']?.toString().toUpperCase() == 'PENDING'),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 11: Historique ──────────────────────────────────────────────────

class _HistoryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students',
      params: const {'includeHistory': true},
      titleField: 'lastName',
      tableColumns: const ['firstName', 'matricule', 'className', 'lastDecision'],
      icon: Icons.history,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
      ],
    );
  }
}

// ── Tab 12: Educmaster ──────────────────────────────────────────────────

class _EducmasterTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/identifiers/stats',
      icon: Icons.school,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'sync', icon: Icons.sync, label: 'Synchroniser', color: AHColors.navy),
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
      ],
    );
  }
}

// ── Tab 13: ORION & Stats ────────────────────────────────────────────────

class _OrionTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/students/orion-kpis',
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
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'ack', icon: Icons.check, label: 'Acquitter', color: Color(0xFF10B981)),
        const RowAction(id: 'resolve', icon: Icons.task_alt, label: 'Résoudre', color: Color(0xFF6366F1)),
      ],
    );
  }
}
