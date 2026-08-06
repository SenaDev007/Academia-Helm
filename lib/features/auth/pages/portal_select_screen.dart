import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/portal_provider.dart';

/// Portal selection screen matching the web app's TenantPortalSelection.
///
/// Design (1:1 with web):
/// - Light background (white)
/// - Branded header: logo + "Academia Helm" wordmark + subtitle
/// - 4 portal cards in a vertical list (not 2x2 grid)
/// - Unified Helm palette (navy/blue/gold), not per-portal colored cards
/// - Each card: icon container + title + description + chevron arrow
/// - On tap → store selection and navigate to /login
class PortalSelectScreen extends ConsumerWidget {
  const PortalSelectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Container(
        color: Colors.white,
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AHSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: AHSpacing.xxl),
                  _buildBrandingHeader(),
                  const SizedBox(height: AHSpacing.xxl),
                  _buildBadge(),
                  const SizedBox(height: AHSpacing.lg),
                  Text(
                    'Accéder à votre espace',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AHColors.navy,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.sm),
                  Text(
                    'Sélectionnez le portail correspondant à votre profil pour vous connecter.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: AHColors.grey500,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xxl),
                  _buildPortalCard(
                    ref: ref,
                    portalType: PortalType.platform,
                    icon: Icons.shield_outlined,
                    title: 'Plateforme',
                    description: 'Administration SaaS globale',
                    onTap: () => _selectPortal(ref, PortalType.platform),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  _buildPortalCard(
                    ref: ref,
                    portalType: PortalType.school,
                    icon: Icons.business_outlined,
                    title: 'École',
                    description: 'Direction et administration',
                    onTap: () => _selectPortal(ref, PortalType.school),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  _buildPortalCard(
                    ref: ref,
                    portalType: PortalType.teacher,
                    icon: Icons.school_outlined,
                    title: 'Enseignant',
                    description: 'Pédagogie et suivi',
                    onTap: () => _selectPortal(ref, PortalType.teacher),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  _buildPortalCard(
                    ref: ref,
                    portalType: PortalType.parent,
                    icon: Icons.people_outline,
                    title: 'Parent / Élève',
                    description: 'Suivi et communication',
                    onTap: () => _selectPortal(ref, PortalType.parent),
                  ),
                  const SizedBox(height: AHSpacing.xxl),
                  _buildFooter(),
                ],
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
        // Logo with gold halo
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AHColors.gold.withOpacity(0.3),
                blurRadius: 20,
                spreadRadius: 4,
              ),
              BoxShadow(
                color: AHColors.gold.withOpacity(0.1),
                blurRadius: 40,
                spreadRadius: 8,
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/images/logo_academia_helm.png',
              fit: BoxFit.cover,
            ),
          ),
        ),
        const SizedBox(height: AHSpacing.lg),
        // Wordmark
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Academia',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AHColors.navy,
              ),
            ),
            SizedBox(width: 5),
            Text(
              'Helm',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AHColors.gold,
              ),
            ),
          ],
        ),
        const SizedBox(height: AHSpacing.xs),
        Text(
          'Plateforme de pilotage éducatif',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontStyle: FontStyle.italic,
            color: AHColors.grey500,
          ),
        ),
      ],
    );
  }

  // ── Badge ───────────────────────────────────────────────────────────

  Widget _buildBadge() {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: AHColors.navy.withOpacity(0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AHColors.navy.withOpacity(0.2), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield, size: 14, color: AHColors.navy),
            const SizedBox(width: 6),
            Text(
              'PORTAIL OFFICIEL — ACADEMIA HELM',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: AHColors.navy,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Portal Card ────────────────────────────────────────────────────

  Widget _buildPortalCard({
    required WidgetRef ref,
    required PortalType portalType,
    required IconData icon,
    required String title,
    required String description,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
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
            border: Border.all(
              color: AHColors.navy.withOpacity(0.15),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AHColors.navy.withOpacity(0.06),
                blurRadius: 2,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            children: [
              // Icon container
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AHColors.navy.withOpacity(0.14),
                      AHColors.blue.withOpacity(0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: AHColors.navy, size: 20),
              ),
              const SizedBox(width: 12),
              // Title + description
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AHColors.navy,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: AHColors.grey500,
                      ),
                    ),
                  ],
                ),
              ),
              // Arrow
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

  // ── Footer ─────────────────────────────────────────────────────────

  Widget _buildFooter() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shield_outlined, size: 12, color: AHColors.grey400),
          const SizedBox(width: 4),
          Text(
            'Portail officiel sécurisé Academia Helm',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 10,
              color: AHColors.grey400,
            ),
          ),
        ],
      ),
    );
  }

  // ── Portal Selection Handler ───────────────────────────────────────

  void _selectPortal(WidgetRef ref, PortalType portal) {
    ref.read(selectedPortalProvider.notifier).state = portal;
    GoRouter.of(ref.context).go('/login');
  }
}
