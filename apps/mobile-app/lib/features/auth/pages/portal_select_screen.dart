import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_theme.dart';
import '../providers/portal_provider.dart';

/// Portal selection screen matching the web app's `/portal` page.
///
/// Shows 4 portal cards (PLATFORM, SCHOOL, TEACHER, PARENT) with icons,
/// descriptions, and gradient backgrounds. On tap → store selection and
/// navigate to `/login`.
///
/// Responsive layout:
/// - Phone: 2×2 grid
/// - Tablet: Horizontal cards
class PortalSelectScreen extends ConsumerWidget {
  const PortalSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isTablet = screenWidth >= 600;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AHColors.navyDark, AHColors.navy],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AHSpacing.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildBrandingHeader(),
                    const SizedBox(height: AHSpacing.xxl),
                    isTablet
                        ? _buildTabletCards(ref)
                        : _buildPhoneCards(ref),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Branding Header ─────────────────────────────────────────────────

  Widget _buildBrandingHeader() {
    return Column(
      children: [
        // Shield logo
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.2),
              width: 2,
            ),
          ),
          child: const Icon(
            Icons.shield,
            color: AHColors.gold,
            size: 40,
          ),
        ),
        const SizedBox(height: AHSpacing.lg),

        // App name
        const Text(
          'Academia Helm',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AHSpacing.xs),

        // Subtitle
        Text(
          'Choisissez votre espace',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  // ── Phone Layout: 2×2 Grid ──────────────────────────────────────────

  Widget _buildPhoneCards(WidgetRef ref) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AHSpacing.md,
      crossAxisSpacing: AHSpacing.md,
      childAspectRatio: 0.85,
      children: [
        _PortalCard(
          portalType: PortalType.platform,
          icon: Icons.cloud,
          title: PortalType.platform.displayName,
          description: PortalType.platform.description,
          gradientColors: const [Color(0xFF0B2F73), Color(0xFF1A3F8B)],
          onTap: () => _selectPortal(ref, PortalType.platform),
        ),
        _PortalCard(
          portalType: PortalType.school,
          icon: Icons.school,
          title: PortalType.school.displayName,
          description: PortalType.school.description,
          gradientColors: const [Color(0xFF1D4FA5), Color(0xFF2E60C0)],
          onTap: () => _selectPortal(ref, PortalType.school),
        ),
        _PortalCard(
          portalType: PortalType.teacher,
          icon: Icons.cast_for_education,
          title: PortalType.teacher.displayName,
          description: PortalType.teacher.description,
          gradientColors: const [Color(0xFF0D9488), Color(0xFF14B8A6)],
          onTap: () => _selectPortal(ref, PortalType.teacher),
        ),
        _PortalCard(
          portalType: PortalType.parent,
          icon: Icons.family_restroom,
          title: PortalType.parent.displayName,
          description: PortalType.parent.description,
          gradientColors: const [Color(0xFF92400E), Color(0xFFB45309)],
          onTap: () => _selectPortal(ref, PortalType.parent),
        ),
      ],
    );
  }

  // ── Tablet Layout: Horizontal Cards ─────────────────────────────────

  Widget _buildTabletCards(WidgetRef ref) {
    return Column(
      children: [
        _PortalCardWide(
          portalType: PortalType.platform,
          icon: Icons.cloud,
          title: PortalType.platform.displayName,
          description: PortalType.platform.description,
          gradientColors: const [Color(0xFF0B2F73), Color(0xFF1A3F8B)],
          onTap: () => _selectPortal(ref, PortalType.platform),
        ),
        const SizedBox(height: AHSpacing.md),
        _PortalCardWide(
          portalType: PortalType.school,
          icon: Icons.school,
          title: PortalType.school.displayName,
          description: PortalType.school.description,
          gradientColors: const [Color(0xFF1D4FA5), Color(0xFF2E60C0)],
          onTap: () => _selectPortal(ref, PortalType.school),
        ),
        const SizedBox(height: AHSpacing.md),
        _PortalCardWide(
          portalType: PortalType.teacher,
          icon: Icons.cast_for_education,
          title: PortalType.teacher.displayName,
          description: PortalType.teacher.description,
          gradientColors: const [Color(0xFF0D9488), Color(0xFF14B8A6)],
          onTap: () => _selectPortal(ref, PortalType.teacher),
        ),
        const SizedBox(height: AHSpacing.md),
        _PortalCardWide(
          portalType: PortalType.parent,
          icon: Icons.family_restroom,
          title: PortalType.parent.displayName,
          description: PortalType.parent.description,
          gradientColors: const [Color(0xFF92400E), Color(0xFFB45309)],
          onTap: () => _selectPortal(ref, PortalType.parent),
        ),
      ],
    );
  }

  // ── Portal Selection Handler ────────────────────────────────────────

  void _selectPortal(WidgetRef ref, PortalType portal) {
    ref.read(selectedPortalProvider.notifier).state = portal;
    // Navigate to login with the selected portal context.
    // The login screen can read the portal from the provider.
    GoRouter.of(ref.context).go('/login');
  }
}

// ── Portal Card (Phone: Square) ───────────────────────────────────────

class _PortalCard extends StatelessWidget {
  const _PortalCard({
    required this.portalType,
    required this.icon,
    required this.title,
    required this.description,
    required this.gradientColors,
    required this.onTap,
  });

  final PortalType portalType;
  final IconData icon;
  final String title;
  final String description;
  final List<Color> gradientColors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.r16),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: gradientColors,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AHSpacing.r16),
            boxShadow: [
              BoxShadow(
                color: gradientColors[0].withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.md),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AHSpacing.r12),
                  ),
                  child: Icon(icon, color: Colors.white, size: 28),
                ),
                const SizedBox(height: AHSpacing.sm),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: AHSpacing.xxs),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Portal Card (Tablet: Wide Horizontal) ─────────────────────────────

class _PortalCardWide extends StatelessWidget {
  const _PortalCardWide({
    required this.portalType,
    required this.icon,
    required this.title,
    required this.description,
    required this.gradientColors,
    required this.onTap,
  });

  final PortalType portalType;
  final IconData icon;
  final String title;
  final String description;
  final List<Color> gradientColors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.r16),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: gradientColors,
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(AHSpacing.r16),
            boxShadow: [
              BoxShadow(
                color: gradientColors[0].withOpacity(0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AHSpacing.xl,
              vertical: AHSpacing.lg,
            ),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AHSpacing.r12),
                  ),
                  child: Icon(icon, color: Colors.white, size: 32),
                ),
                const SizedBox(width: AHSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: AHSpacing.xxs),
                      Text(
                        description,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.white54,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
