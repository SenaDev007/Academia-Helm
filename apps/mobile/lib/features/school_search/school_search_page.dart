// ============================================================================
// SCHOOL SEARCH PAGE — Portail public (recherche d'école)
// ============================================================================
// C'est l'écran d'entrée de l'app mobile.
// Tout le monde y a accès (pas d'auth requise).
// L'utilisateur recherche son école → la sélectionne → passe au login.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../services/school_service.dart';
import '../../core/theme/app_theme.dart';

// Provider pour SchoolService
final schoolServiceProvider = Provider<SchoolService>((ref) => SchoolService());

// Provider pour la liste des écoles
final schoolsProvider = FutureProvider<List<SchoolInfo>>((ref) async {
  final service = ref.read(schoolServiceProvider);
  return service.searchSchools();
});

// Provider pour l'école sauvegardée
final savedSchoolProvider = FutureProvider<SchoolInfo?>((ref) async {
  final service = ref.read(schoolServiceProvider);
  return service.getSavedSchool();
});

class SchoolSearchPage extends ConsumerStatefulWidget {
  const SchoolSearchPage({super.key});

  @override
  ConsumerState<SchoolSearchPage> createState() => _SchoolSearchPageState();
}

class _SchoolSearchPageState extends ConsumerState<SchoolSearchPage> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<SchoolInfo> _filter(List<SchoolInfo> schools) {
    if (_searchQuery.isEmpty) return schools;
    final q = _searchQuery.toLowerCase();
    return schools
        .where((s) =>
            s.name.toLowerCase().contains(q) ||
            (s.city?.toLowerCase().contains(q) ?? false) ||
            (s.country?.toLowerCase().contains(q) ?? false) ||
            s.slug.toLowerCase().contains(q))
        .toList();
  }

  Future<void> _selectSchool(SchoolInfo school) async {
    final service = ref.read(schoolServiceProvider);
    await service.saveSelectedSchool(school);
    if (mounted) {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final schoolsAsync = ref.watch(schoolsProvider);
    final savedSchoolAsync = ref.watch(savedSchoolProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── En-tête ──
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.navy, AppTheme.blue],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                children: [
                  Icon(Icons.school, size: 48, color: Colors.white),
                  const SizedBox(height: 12),
                  Text(
                    'Academia Helm',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Trouvez votre école',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),

            // ── École sauvegardée ──
            savedSchoolAsync.when(
              data: (saved) {
                if (saved == null) return const SizedBox.shrink();
                return Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    border: Border.all(color: Colors.green.shade200),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.history, color: Colors.green.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Dernière école',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.green.shade700,
                              ),
                            ),
                            Text(
                              saved.name,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.green.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () => _selectSchool(saved),
                        child: Text('Continuer'),
                      ),
                    ],
                  ),
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            // ── Barre de recherche ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _searchQuery = value),
                decoration: InputDecoration(
                  hintText: 'Nom, ville ou pays...',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // ── Liste des écoles ──
            Expanded(
              child: schoolsAsync.when(
                data: (schools) {
                  final filtered = _filter(schools);
                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.school_outlined,
                              size: 64, color: Colors.grey.shade300),
                          const SizedBox(height: 16),
                          Text(
                            _searchQuery.isEmpty
                                ? 'Aucune école disponible'
                                : 'Aucune école trouvée pour "$_searchQuery"',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final school = filtered[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: school.logoUrl != null
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(
                                    school.logoUrl!,
                                    width: 48,
                                    height: 48,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => _schoolAvatar(),
                                  ),
                                )
                              : _schoolAvatar(),
                          title: Text(
                            school.name,
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            [school.city, school.country]
                                .where((s) => s != null && s.isNotEmpty)
                                .join(', '),
                            style: TextStyle(fontSize: 12),
                          ),
                          trailing: Icon(Icons.chevron_right, color: Colors.grey),
                          onTap: () => _selectSchool(school),
                        ),
                      );
                    },
                  );
                },
                loading: () => Center(
                  child: CircularProgressIndicator(color: AppTheme.blue),
                ),
                error: (error, stack) => Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline,
                          size: 48, color: Colors.red.shade300),
                      const SizedBox(height: 16),
                      Text('Erreur de chargement'),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () => ref.refresh(schoolsProvider),
                        child: Text('Réessayer'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _schoolAvatar() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: AppTheme.blue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(Icons.school, color: AppTheme.blue),
    );
  }
}
