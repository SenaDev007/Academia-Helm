import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/academic_year/academic_year_provider.dart';
import '../../../core/providers/school_identity_provider.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../providers/parent_provider.dart';

/// Parent dashboard — mirrors the web app's `/app/parent/page.tsx`.
///
/// Layout (top → bottom):
/// 1. Welcome header (gradient blue→purple, parent name, school · year)
/// 2. Children list (one card per child with real data from /api/parent/children)
/// 3. Each child card: avatar, name, class, matricule, scolarité status
/// 4. On tap → child detail (grades, payments, attendance, etc.)
class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final parentName = ref.watch(currentUserDisplayNameProvider) ?? 'Parent';

    // Use the real academic year ID from currentAcademicYearProvider
    final academicYear = ref.watch(currentAcademicYearProvider);
    final academicYearId = academicYear?.id;
    final academicYearLabel = academicYear?.name ?? 'Année en cours';

    // School identity from schoolIdentityProvider (cached + fresh)
    final identity = ref.watch(schoolIdentityProvider).valueOrNull;
    final schoolName = identity?.schoolName ?? 'École';

    // Use parentChildrenProvider which calls /api/parent/children (correct API)
    final childrenAsync =
        ref.watch(parentChildrenProvider(academicYearId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar:
          const AHAppBar(showBackButton: true, title: 'Portail Parent'),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: () async {
          ref.invalidate(parentChildrenProvider(academicYearId));
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Welcome banner ──────────────────────────────────────
              _WelcomeBanner(
                parentName: parentName,
                schoolName: schoolName,
                academicYear: academicYearLabel,
              ),
              const SizedBox(height: AHSpacing.lg),

              // ── Children section ────────────────────────────────────
              const Text(
                'Mes Enfants',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: AHSpacing.sm),
              childrenAsync.when(
                data: (children) {
                  if (children.isEmpty) {
                    return _buildEmptyState(context);
                  }
                  return ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: children.length,
                    itemBuilder: (context, index) =>
                        _ChildCard(child: children[index]),
                  );
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(
                    child:
                        CircularProgressIndicator(color: AHColors.navy),
                  ),
                ),
                error: (e, _) => _buildErrorState(context, ref, e.toString()),
              ),
              const SizedBox(height: AHSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.child_care_outlined,
                size: 48, color: AHColors.grey300),
            const SizedBox(height: 12),
            const Text(
              'Aucun enfant lié à votre compte',
              style: TextStyle(fontSize: 14, color: AHColors.grey500),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            const Text(
              'Contactez l\'administration de l\'école pour lier vos enfants',
              style: TextStyle(fontSize: 12, color: AHColors.grey400),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(
      BuildContext context, WidgetRef ref, String error) {
    return Container(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
            const SizedBox(height: 12),
            const Text(
              'Erreur de chargement',
              style: TextStyle(fontSize: 14, color: AHColors.grey600),
            ),
            const SizedBox(height: 4),
            Text(
              error,
              style: const TextStyle(fontSize: 11, color: AHColors.grey400),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () {
                final ay = ref.read(currentAcademicYearProvider);
                ref.invalidate(parentChildrenProvider(ay?.id));
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy,
                foregroundColor: Colors.white,
              ),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Welcome Banner ──────────────────────────────────────────────────────

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({
    required this.parentName,
    required this.schoolName,
    required this.academicYear,
  });

  final String parentName;
  final String schoolName;
  final String academicYear;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.family_restroom,
                    color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bienvenue, $parentName',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '$schoolName · $academicYear',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withOpacity(0.8),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Suivez la scolarité de vos enfants',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withOpacity(0.7),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Child Card ──────────────────────────────────────────────────────────

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child});
  final ParentChild child;

  @override
  Widget build(BuildContext context) {
    final hasDebt = child.account?.hasDebt ?? false;
    final balance = child.account?.balance ?? 0;

    return GestureDetector(
      onTap: () => context.go('/child-detail/${child.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  child.initials,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Name + class
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    child.displayName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    child.className.isNotEmpty
                        ? child.className
                        : 'Classe non assignée',
                    style: const TextStyle(
                        fontSize: 12, color: AHColors.grey500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (child.matricule.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Mat: ${child.matricule}',
                      style: const TextStyle(
                          fontSize: 10, color: AHColors.grey400),
                    ),
                  ],
                ],
              ),
            ),
            // Scolarité status
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: hasDebt
                        ? const Color(0xFFFEF2F2)
                        : const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    hasDebt
                        ? 'Reste: ${balance.toInt()} F'
                        : 'Scolarité à jour',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: hasDebt
                          ? const Color(0xFFDC2626)
                          : const Color(0xFF10B981),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Voir le suivi →',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AHColors.navy,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
