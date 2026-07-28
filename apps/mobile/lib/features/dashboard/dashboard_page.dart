// ============================================================================
// DASHBOARD PAGE — Tableau de bord après connexion
// ============================================================================
// Affiche un dashboard différent selon le portalType :
//   - PARENT : liste des enfants, scolarité, suivi
//   - TEACHER : classes, évaluations, cahier journal
//   - SCHOOL : pilotage (effectifs, finances, alertes)
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/storage_utils.dart';
import '../../services/auth_service.dart';

final userPortalTypeProvider = FutureProvider<String?>((ref) async {
  return await StorageUtils.getString('auth_portal_type');
});

final userInfoProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  return await StorageUtils.getObject('auth_user');
});

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portalTypeAsync = ref.watch(userPortalTypeProvider);
    final userAsync = ref.watch(userInfoProvider);

    return portalTypeAsync.when(
      data: (portalType) {
        if (portalType == 'PARENT') {
          return _ParentDashboard();
        } else if (portalType == 'TEACHER') {
          return _TeacherDashboard();
        } else {
          return _SchoolDashboard();
        }
      },
      loading: () => Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => Scaffold(
        body: Center(child: Text('Erreur de chargement')),
      ),
    );
  }
}

// ── Dashboard Parent ──

class _ParentDashboard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userInfoProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Portail Parent'),
        actions: [
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await AuthService().logout();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: userAsync.when(
        data: (user) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Carte de bienvenue
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppTheme.emerald,
                      child: Icon(Icons.person, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Bonjour,',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                          Text(
                            user?['firstName'] ?? 'Parent',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Menu rapide
            Text(
              'Mes enfants',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),

            // TODO: charger la vraie liste des enfants depuis /api/parent/children
            Card(
              child: ListTile(
                leading: Icon(Icons.child_care, color: AppTheme.blue),
                title: Text('Chargement des enfants...'),
                trailing: Icon(Icons.chevron_right),
              ),
            ),

            const SizedBox(height: 24),

            // Actions rapides
            Text(
              'Actions rapides',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            GridView.count(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.2,
              children: [
                _ActionCard(
                  icon: Icons.payments,
                  label: 'Paiements',
                  color: AppTheme.emerald,
                  onTap: () {
                    // TODO: naviguer vers /parent/payments
                  },
                ),
                _ActionCard(
                  icon: Icons.assignment,
                  label: 'Bulletins',
                  color: Colors.purple,
                  onTap: () {
                    // TODO: naviguer vers /parent/results
                  },
                ),
                _ActionCard(
                  icon: Icons.calendar_today,
                  label: 'Présences',
                  color: AppTheme.amber,
                  onTap: () {
                    // TODO: naviguer vers /parent/attendance
                  },
                ),
                _ActionCard(
                  icon: Icons.book,
                  label: 'Cahier journal',
                  color: AppTheme.blue,
                  onTap: () {
                    // TODO: naviguer vers /parent/cahier-journal
                  },
                ),
              ],
            ),
          ],
        ),
        loading: () => Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text('Erreur')),
      ),
    );
  }
}

// ── Dashboard Enseignant ──

class _TeacherDashboard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Portail Enseignant'),
        actions: [
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await AuthService().logout();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: Center(
        child: Text('Dashboard Enseignant — à implémenter'),
      ),
    );
  }
}

// ── Dashboard École ──

class _SchoolDashboard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Portail École'),
        actions: [
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () async {
              await AuthService().logout();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: Center(
        child: Text('Dashboard École — à implémenter'),
      ),
    );
  }
}

// ── Widget: Carte d'action ──

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 32, color: color),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
