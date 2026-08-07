import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_logo_circle.dart';
import '../../../domain/entities/tenant_school.dart';
import '../providers/portal_provider.dart';
import '../providers/school_provider.dart';

/// School selection screen.
///
/// Mirrors the web app's `SchoolSearch` modal behavior:
/// - Fetches ALL schools once via [schoolsListProvider]
/// - Client-side filtering on name/city/slug/country
/// - Each item shows logo (or fallback icon), name, city, school type
/// - On tap → stores school in [selectedSchoolProvider] + navigates to /login
///
/// This screen is shown when the user clicks "École" on portal-select.
/// Flow: portal-select → school-select → login (with school context)
class SchoolSelectScreen extends ConsumerStatefulWidget {
  const SchoolSelectScreen({super.key});

  @override
  ConsumerState<SchoolSelectScreen> createState() => _SchoolSelectScreenState();
}

class _SchoolSelectScreenState extends ConsumerState<SchoolSelectScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    ref.read(schoolSearchQueryProvider.notifier).state = value;
  }

  void _selectSchool(TenantSchool school) {
    final selectedPortal = ref.read(selectedPortalProvider);

    // PUBLIC portal: no login required — open the web pre-enrollment page
    // directly (3-step wizard too complex to replicate natively for now).
    // Matches web behavior: /portal → click Public → school-select →
    // redirect to /public/pre-enrollment?school=<slug> (no auth).
    if (selectedPortal == PortalType.public) {
      final slug = school.slug.isNotEmpty ? school.slug : school.id;
      final url = 'https://app.academiahelm.com/public/pre-enrollment?school=$slug';
      debugPrint('[Public] Opening URL: $url');
      // Launch directly without canLaunchUrl check — on Android, canLaunchUrl
      // requires a <queries> declaration in AndroidManifest.xml and often
      // returns false even for valid https URLs.
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      return;
    }

    // Other portals: store the selected school + navigate to login
    ref.read(selectedSchoolProvider.notifier).state = school;
    context.push('/login');
  }

  @override
  Widget build(BuildContext context) {
    final schoolsAsync = ref.watch(schoolsListProvider);
    final filteredSchools = ref.watch(filteredSchoolsProvider);
    final query = ref.watch(schoolSearchQueryProvider);
    final selectedPortal = ref.watch(selectedPortalProvider);

    // Adaptive title based on selected portal
    final String screenTitle = selectedPortal == PortalType.teacher
        ? 'Sélectionnez votre établissement'
        : selectedPortal == PortalType.parent
            ? 'Sélectionnez l\'établissement de votre enfant'
            : 'Sélectionnez votre école';

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar with back button + refresh button + title ──
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: AHColors.navy),
                  onPressed: () {
                    if (Navigator.of(context).canPop()) {
                      Navigator.of(context).pop();
                    } else {
                      context.go('/portal-select');
                    }
                  },
                ),
                Expanded(
                  child: Text(
                    screenTitle,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AHColors.navy,
                    ),
                  ),
                ),
                // Refresh button — always visible so user can retry on failure
                IconButton(
                  icon: const Icon(Icons.refresh, color: AHColors.navy),
                  onPressed: () {
                    ref.invalidate(schoolsListProvider);
                  },
                ),
              ],
            ),

            // ── Search bar ───────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.xl,
                vertical: AHSpacing.sm,
              ),
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: AHColors.navy.withOpacity(0.2)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  decoration: InputDecoration(
                    hintText: 'Rechercher une école...',
                    hintStyle: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: AHColors.grey400,
                    ),
                    prefixIcon: Icon(Icons.search, color: AHColors.navy, size: 20),
                    suffixIcon: schoolsAsync.isLoading
                        ? Padding(
                            padding: const EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AHColors.navy,
                              ),
                            ),
                          )
                        : query.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.clear, color: AHColors.grey400, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  _onSearchChanged('');
                                },
                              )
                            : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 14,
                    ),
                  ),
                ),
              ),
            ),

            // ── Results counter ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '${filteredSchools.length} établissement${filteredSchools.length > 1 ? 's' : ''}',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: AHColors.grey500,
                  ),
                ),
              ),
            ),

            const SizedBox(height: AHSpacing.sm),

            // ── Schools list ─────────────────────────────────────────
            Expanded(
              child: schoolsAsync.when(
                data: (allSchools) {
                  if (allSchools.isEmpty) {
                    return _buildEmptyState(
                      query: query,
                      isFiltered: false,
                    );
                  }
                  if (filteredSchools.isEmpty) {
                    return _buildEmptyState(
                      query: query,
                      isFiltered: true,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AHSpacing.xl,
                      vertical: AHSpacing.sm,
                    ),
                    itemCount: filteredSchools.length,
                    separatorBuilder: (_, __) => const SizedBox(height: AHSpacing.sm),
                    itemBuilder: (context, index) {
                      final school = filteredSchools[index];
                      return _buildSchoolCard(school);
                    },
                  );
                },
                loading: () => Center(
                  child: CircularProgressIndicator(
                    color: AHColors.navy,
                    strokeWidth: 2.5,
                  ),
                ),
                error: (error, _) => _buildErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(schoolsListProvider),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── School Card ────────────────────────────────────────────────────────

  Widget _buildSchoolCard(TenantSchool school) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _selectSchool(school),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AHColors.navy.withOpacity(0.04),
                AHColors.blue.withOpacity(0.02),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AHColors.navy.withOpacity(0.1)),
          ),
          child: Row(
            children: [
              // Logo (40x40) or fallback icon
              _buildSchoolLogo(school),
              const SizedBox(width: AHSpacing.md),
              // Name + city + type
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      school.name,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AHColors.navy,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (school.city != null && school.city!.isNotEmpty) ...[
                          Icon(Icons.location_on, size: 12, color: AHColors.grey400),
                          const SizedBox(width: 2),
                          Flexible(
                            child: Text(
                              school.city!,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                color: AHColors.grey500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                        if (school.city != null &&
                            school.city!.isNotEmpty &&
                            school.schoolType != null &&
                            school.schoolType!.isNotEmpty)
                          Text(
                            ' • ',
                            style: TextStyle(
                              fontSize: 11,
                              color: AHColors.grey400,
                            ),
                          ),
                        if (school.schoolType != null &&
                            school.schoolType!.isNotEmpty) ...[
                          Icon(Icons.school, size: 12, color: AHColors.grey400),
                          const SizedBox(width: 2),
                          Flexible(
                            child: Text(
                              school.schoolType!,
                              style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                color: AHColors.grey500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: AHColors.grey300,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSchoolLogo(TenantSchool school) {
    if (school.logoUrl != null && school.logoUrl!.isNotEmpty) {
      final logoUrl = school.logoUrl!;
      // Handle both full URLs and base64 data URLs
      final isUrl = logoUrl.startsWith('http://') || logoUrl.startsWith('https://');
      final isBase64 = logoUrl.startsWith('data:image');
      if (isUrl) {
        return ClipOval(
          child: Image.network(
            logoUrl,
            width: 40,
            height: 40,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildLogoFallback(),
          ),
        );
      }
      if (isBase64) {
        // For base64, we'd need to decode — but for simplicity, show fallback
        // (the web app handles this via <Image src="data:image/...">)
        return _buildLogoFallback();
      }
    }
    return _buildLogoFallback();
  }

  Widget _buildLogoFallback() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AHColors.navy.withOpacity(0.14), AHColors.blue.withOpacity(0.08)],
        ),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(Icons.business, color: AHColors.navy, size: 20),
    );
  }

  // ── Empty State ───────────────────────────────────────────────────────

  Widget _buildEmptyState({required String query, required bool isFiltered}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isFiltered ? Icons.search_off : Icons.school_outlined,
              size: 48,
              color: AHColors.grey300,
            ),
            const SizedBox(height: AHSpacing.md),
            Text(
              isFiltered
                  ? 'Aucun établissement trouvé pour "$query"'
                  : 'Aucun établissement disponible',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: AHColors.grey500,
              ),
            ),
            if (isFiltered) ...[
              const SizedBox(height: AHSpacing.md),
              TextButton(
                onPressed: () {
                  _searchController.clear();
                  _onSearchChanged('');
                },
                child: Text(
                  'Réinitialiser la recherche',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: AHColors.navy,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Error State ───────────────────────────────────────────────────────

  Widget _buildErrorState({required String message, required VoidCallback onRetry}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AHSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.wifi_off, size: 48, color: AHColors.error),
            const SizedBox(height: AHSpacing.md),
            const Text(
              'Impossible de charger la liste des écoles',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AHColors.grey600,
              ),
            ),
            const SizedBox(height: AHSpacing.sm),
            // Show the actual error message for debugging
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AHColors.grey100,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 10,
                  color: AHColors.grey500,
                ),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: AHSpacing.sm),
            Text(
              'Vérifiez votre connexion internet et réessayez.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AHColors.grey400,
              ),
            ),
            const SizedBox(height: AHSpacing.lg),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: Icon(Icons.refresh, size: 16),
              label: Text('Réessayer'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
