import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/module_data_tab.dart';

/// Settings module — 12 sub-tabs matching the web's /app/settings structure.
///
/// Tabs (matching web SETTINGS_TAB_IDS):
/// 1. Identité
/// 2. Année scolaire
/// 3. Structure
/// 4. Administration
/// 5. Bilingue
/// 6. Modules
/// 7. Rôles
/// 8. Facturation
/// 9. Sécurité
/// 10. Cachets
/// 11. Appareils autorisés
/// 12. Historique
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Identité',
    'Année scolaire',
    'Structure',
    'Administration',
    'Bilingue',
    'Modules',
    'Rôles',
    'Facturation',
    'Sécurité',
    'Cachets',
    'Appareils',
    'Historique',
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
      appBar: const AHAppBar(showBackButton: true, title: 'Paramètres'),
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
                _IdentityTab(),
                _AcademicYearTab(),
                _StructureTab(),
                _DepartmentsTab(),
                _BilingualTab(),
                _FeaturesTab(),
                _RolesTab(),
                _BillingTab(),
                _SecurityTab(),
                _SealsTab(),
                _DevicesTab(),
                _HistoryTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Identité ──────────────────────────────────────────────────────

class _IdentityTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiClient = ref.watch(apiClientProvider);
    return FutureBuilder(
      future: apiClient.getRaw('/settings/identity'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: AHColors.navy));
        }
        final result = snapshot.data;
        return result?.when(
              success: (data) => _IdentityView(data: data),
              failure: (_) => _buildError(ref),
              loading: () => const Center(
                  child: CircularProgressIndicator(color: AHColors.navy)),
            ) ??
            _buildError(ref);
      },
    );
  }

  Widget _buildError(WidgetRef ref) {
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
            onPressed: () => ref.invalidate(apiClientProvider),
            style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy, foregroundColor: Colors.white),
            child: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }
}

class _IdentityView extends StatelessWidget {
  const _IdentityView({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final fields = <String, String>{};
    for (final entry in data.entries) {
      if (entry.value == null) continue;
      if (entry.value is List || entry.value is Map) continue;
      fields[entry.key] = entry.value.toString();
    }

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(AHSpacing.md),
        children: [
          if (data['logoUrl'] != null)
            Center(
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AHColors.gold, width: 2),
                ),
                child: const Icon(Icons.school, size: 40, color: AHColors.navy),
              ),
            ),
          if (data['logoUrl'] != null) const SizedBox(height: AHSpacing.md),
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
          const SizedBox(height: AHSpacing.md),
          ElevatedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Édition — en cours d\'implémentation'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            icon: const Icon(Icons.edit, size: 16),
            label: const Text('Modifier l\'identité'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AHColors.navy,
              foregroundColor: Colors.white,
            ),
          ),
        ],
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
}

// ── Tab 2: Année scolaire ────────────────────────────────────────────────

class _AcademicYearTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/academic-years',
        titleField: 'label',
        tableColumns: const ['startDate', 'endDate', 'isActive'],
        icon: Icons.calendar_today,
        createLabel: 'Nouvelle année',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(
              id: 'activate',
              icon: Icons.check_circle,
              label: 'Activer',
              color: Color(0xFF10B981)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 3: Structure (classes, levels, cycles, sections, series, rooms) ───

class _StructureTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/classes',
        titleField: 'name',
        tableColumns: const ['level', 'capacity', 'studentsCount', 'isActive'],
        icon: Icons.grid_view,
        createLabel: 'Nouvelle classe',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(id: 'subjects', icon: Icons.book, label: 'Matières', color: Color(0xFF6366F1)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 4: Administration (departments + positions) ──────────────────────

class _DepartmentsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/departments',
        titleField: 'name',
        tableColumns: const ['code', 'head', 'membersCount'],
        icon: Icons.business,
        createLabel: 'Nouveau département',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(id: 'positions', icon: Icons.badge, label: 'Postes', color: Color(0xFF6366F1)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 5: Bilingue ──────────────────────────────────────────────────────

class _BilingualTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiClient = ref.watch(apiClientProvider);
    return FutureBuilder(
      future: apiClient.getRaw('/settings/bilingual'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: AHColors.navy));
        }
        final result = snapshot.data;
        return result?.when(
              success: (data) => _BilingualView(data: data),
              failure: (_) => _buildError(ref),
              loading: () => const Center(
                  child: CircularProgressIndicator(color: AHColors.navy)),
            ) ??
            _buildError(ref);
      },
    );
  }

  Widget _buildError(WidgetRef ref) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
            const SizedBox(height: 8),
            const Text('Erreur de chargement',
                style: TextStyle(fontSize: 13, color: AHColors.grey600)),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => ref.invalidate(apiClientProvider),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy, foregroundColor: Colors.white),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      );
}

class _BilingualView extends StatefulWidget {
  const _BilingualView({required this.data});
  final Map<String, dynamic> data;

  @override
  State<_BilingualView> createState() => _BilingualViewState();
}

class _BilingualViewState extends State<_BilingualView> {
  late bool _enabled = widget.data['bilingualEnabled'] == true;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Mode bilingue (FR/EN)',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AHColors.navy)),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Activer le bilinguisme'),
                subtitle: const Text(
                    'Permet aux élèves de suivre les cours en français ou en anglais'),
                value: _enabled,
                onChanged: (v) => setState(() => _enabled = v),
              ),
              const SizedBox(height: AHSpacing.sm),
              ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Sauvegarde — en cours d\'implémentation'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                icon: const Icon(Icons.save, size: 16),
                label: const Text('Enregistrer'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Tab 6: Modules (features) ────────────────────────────────────────────

class _FeaturesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/feature-flags',
        titleField: 'name',
        tableColumns: const ['code', 'description', 'isEnabled'],
        icon: Icons.toggle_on,
        showCreateButton: false,
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'enable', icon: Icons.toggle_on, label: 'Activer', color: Color(0xFF10B981)),
          RowAction(id: 'disable', icon: Icons.toggle_off, label: 'Désactiver', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 7: Rôles ────────────────────────────────────────────────────────

class _RolesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/roles',
        titleField: 'name',
        tableColumns: const ['description', 'usersCount', 'isSystem'],
        icon: Icons.shield,
        createLabel: 'Nouveau rôle',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
          RowAction(id: 'permissions', icon: Icons.lock, label: 'Permissions', color: Color(0xFF6366F1)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 8: Facturation ────────────────────────────────────────────────────

class _BillingTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiClient = ref.watch(apiClientProvider);
    return FutureBuilder(
      future: apiClient.getRaw('/settings/billing'),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
              child: CircularProgressIndicator(color: AHColors.navy));
        }
        final result = snapshot.data;
        return result?.when(
              success: (data) => _BillingView(data: data),
              failure: (_) => _buildError(ref),
              loading: () => const Center(
                  child: CircularProgressIndicator(color: AHColors.navy)),
            ) ??
            _buildError(ref);
      },
    );
  }

  Widget _buildError(WidgetRef ref) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
            const SizedBox(height: 8),
            const Text('Erreur de chargement',
                style: TextStyle(fontSize: 13, color: AHColors.grey600)),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => ref.invalidate(apiClientProvider),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy, foregroundColor: Colors.white),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      );
}

class _BillingView extends StatelessWidget {
  const _BillingView({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final fields = <String, String>{};
    for (final entry in data.entries) {
      if (entry.value == null) continue;
      if (entry.value is List || entry.value is Map) continue;
      fields[entry.key] = entry.value.toString();
    }

    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Abonnement & Facturation',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AHColors.navy)),
              const SizedBox(height: AHSpacing.sm),
              ...fields.entries.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 130,
                          child: Text(e.key,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AHColors.grey500)),
                        ),
                        Expanded(
                          child: Text(e.value,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A))),
                        ),
                      ],
                    ),
                  )),
              const SizedBox(height: AHSpacing.md),
              ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Renouvellement FedaPay — à implémenter'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                icon: const Icon(Icons.payment, size: 16),
                label: const Text('Renouveler (FedaPay)'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AHColors.navy,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Tab 9: Sécurité ──────────────────────────────────────────────────────

class _SecurityTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/security',
        icon: Icons.lock,
        showCreateButton: false,
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        ],
        );
}

// ── Tab 10: Cachets ──────────────────────────────────────────────────────

class _SealsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/seals',
        titleField: 'name',
        tableColumns: const ['type', 'createdAt'],
        icon: Icons.verified,
        showCreateButton: true,
        createLabel: 'Ajouter cachet',
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'download', icon: Icons.download, label: 'Télécharger', color: Color(0xFF10B981)),
          RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 11: Appareils autorisés ──────────────────────────────────────────

class _DevicesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/devices',
        titleField: 'deviceName',
        tableColumns: const ['deviceType', 'userAgent', 'lastLogin', 'status'],
        icon: Icons.devices,
        showCreateButton: false,
        statusFilters: const [
          StatusFilter(id: 'ALL', label: 'Tous'),
          StatusFilter(id: 'APPROVED', label: 'Approuvés'),
          StatusFilter(id: 'PENDING', label: 'En attente'),
          StatusFilter(id: 'REVOKED', label: 'Révoqués'),
        ],
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(
              id: 'approve',
              icon: Icons.check_circle,
              label: 'Approuver',
              color: Color(0xFF10B981)),
          RowAction(id: 'revoke', icon: Icons.block, label: 'Révoquer', color: Color(0xFFDC2626)),
        ],
        );
}

// ── Tab 12: Historique ────────────────────────────────────────────────────

class _HistoryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) => ModuleDataTab(
        endpoint: '/settings/history',
        titleField: 'action',
        tableColumns: const ['user', 'ip', 'device', 'createdAt'],
        icon: Icons.history,
        showCreateButton: false,
        statusFilters: const [
          StatusFilter(id: 'ALL', label: 'Tous'),
          StatusFilter(id: 'LOGIN', label: 'Connexions'),
          StatusFilter(id: 'LOGOUT', label: 'Déconnexions'),
          StatusFilter(id: 'LOGIN_FAILED', label: 'Échecs'),
          StatusFilter(id: 'DEVICE_REVOKED', label: 'Révocations'),
          StatusFilter(id: 'LOCKOUT', label: 'Verrouillages'),
        ],
        rowActions: const [
          RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
          RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF10B981)),
        ],
        );
}
