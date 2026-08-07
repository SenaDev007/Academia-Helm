import '../../../core/theme/ah_spacing.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/ah_logo_circle.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_theme.dart';
import '../providers/portal_provider.dart';
import '../providers/school_provider.dart';
import '../widgets/login_form.dart';

/// Login screen with:
/// - Email field
/// - Password field
/// - "Se connecter" button
/// - "Mot de passe oublié ?" link
/// - AH branding header
/// - Error display
/// - Loading state
/// - Responsive layout (centered card on tablet)
/// - Uses real auth notifier provider
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _isLoading = false;
  String? _error;

  Future<void> _handleLogin(String identifier, String password) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final selectedPortal = ref.read(selectedPortalProvider);
      final selectedSchool = ref.read(selectedSchoolProvider);
      final tenantId = selectedSchool?.id;
      final tenantSubdomain = selectedSchool?.slug;

      await ref.read(authNotifierProvider.notifier).login(
            identifier: identifier,
            password: password,
            portalType: selectedPortal,
            tenantId: tenantId,
            tenantSubdomain: tenantSubdomain,
          );

      if (!mounted) return;

      final authState = ref.read(authNotifierProvider).valueOrNull;
      if (authState?.isAuthenticated == true) {
        final tenants = authState?.availableTenantsOrNull ?? [];
        final selectedPortal = ref.read(selectedPortalProvider);

        // Route based on portal type (matches web's getEffectivePortal logic)
        if (selectedPortal == PortalType.teacher) {
          if (mounted) context.go('/teacher-dashboard');
          return;
        }
        if (selectedPortal == PortalType.parent) {
          if (mounted) context.go('/parent-dashboard');
          return;
        }

        if (tenants.length == 1) {
          // Auto-select the only tenant and go to dashboard.
          await ref
              .read(authNotifierProvider.notifier)
              .selectTenant(tenants.first.id);
          if (mounted) {
            context.go('/dashboard');
          }
        } else if (tenants.length > 1) {
          // Multiple tenants → tenant selection screen.
          context.go('/tenant-select');
        } else {
          // No tenants → go directly to dashboard.
          context.go('/dashboard');
        }
      } else {
        setState(() {
          _error = 'Identifiants incorrects';
          _isLoading = false;
        });
      }
    } on AuthException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Erreur de connexion. Veuillez réessayer.';
          _isLoading = false;
        });
      }
    }
  }

  /// Handles Google Sign-In for the SCHOOL portal.
  /// Opens the web Google OAuth flow in an external browser.
  Future<void> _handleGoogleSignIn() async {
    final selectedSchool = ref.read(selectedSchoolProvider);
    final slug = selectedSchool?.slug;
    final url = slug != null
        ? 'https://app.academiahelm.com/login?portal=school&tenant=$slug'
        : 'https://app.academiahelm.com/login?portal=school';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
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
          child: Stack(
            children: [
              // ── Back button (top-left, returns to /portal-select) ──
              Positioned(
                top: 8,
                left: 8,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () {
                    if (Navigator.of(context).canPop()) {
                      Navigator.of(context).pop();
                    } else {
                      context.go('/portal-select');
                    }
                  },
                ),
              ),
              // ── Centered scrollable content ─────────────────────────
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AHSpacing.xl),
                  child: isTablet
                      ? _buildTabletLayout()
                      : _buildPhoneLayout(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneLayout() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildBrandingHeader(),
        const SizedBox(height: AHSpacing.xxl),
        _buildLoginCard(),
      ],
    );
  }

  Widget _buildTabletLayout() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildBrandingHeader(),
          const SizedBox(height: AHSpacing.xxl),
          _buildLoginCard(),
        ],
      ),
    );
  }

  Widget _buildBrandingHeader() {
    // Read selected school (null if user came directly without school selection)
    final selectedSchool = ref.watch(selectedSchoolProvider);
    final selectedPortal = ref.watch(selectedPortalProvider);
    final hasSchoolContext = selectedSchool != null;

    return Column(
      children: [
        // ── School logo or Academia Helm logo ──────────────────
        // If a school is selected, show the school's logo (like web LoginPage).
        // Otherwise, show the default Academia Helm logo.
        if (hasSchoolContext && selectedSchool.logoUrl != null && selectedSchool.logoUrl!.isNotEmpty)
          _buildSchoolLogo(selectedSchool.logoUrl!)
        else
          const AHLogoCircle(size: 80),
        const SizedBox(height: AHSpacing.lg),

        // ── Portal badge (matches web's portal badge) ──────────
        if (selectedPortal != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.white.withOpacity(0.25)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _portalIcon(selectedPortal),
                  size: 12,
                  color: Colors.white,
                ),
                const SizedBox(width: 4),
                Text(
                  'Portail ${selectedPortal.displayName}',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        if (selectedPortal != null) const SizedBox(height: AHSpacing.md),

        // ── School name or wordmark ────────────────────────────
        if (hasSchoolContext)
          Text(
            selectedSchool.name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          )
        else
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
                  color: Colors.white,
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

        // ── Slogan or subtitle ─────────────────────────────────
        if (hasSchoolContext && selectedSchool.slogan != null && selectedSchool.slogan!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl),
            child: Text(
              selectedSchool.slogan!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: Colors.white.withOpacity(0.8),
              ),
            ),
          )
        else
          Text(
            'Connectez-vous à votre espace',
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: Colors.white.withOpacity(0.7),
            ),
          ),

        // ── City / phone info (if school selected, like web) ──
        if (hasSchoolContext &&
            (selectedSchool.city != null || selectedSchool.phone != null)) ...[
          const SizedBox(height: AHSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (selectedSchool.city != null && selectedSchool.city!.isNotEmpty) ...[
                Icon(Icons.location_on, size: 11, color: AHColors.gold),
                const SizedBox(width: 2),
                Text(
                  selectedSchool.city!,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    color: Colors.white.withOpacity(0.6),
                  ),
                ),
              ],
              if (selectedSchool.city != null &&
                  selectedSchool.city!.isNotEmpty &&
                  selectedSchool.phone != null &&
                  selectedSchool.phone!.isNotEmpty)
                Text(
                  ' • ',
                  style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.4)),
                ),
              if (selectedSchool.phone != null && selectedSchool.phone!.isNotEmpty) ...[
                Icon(Icons.phone, size: 11, color: AHColors.gold),
                const SizedBox(width: 2),
                Text(
                  selectedSchool.phone!,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    color: Colors.white.withOpacity(0.6),
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }

  /// Returns the icon for a portal type (matches web's PORTAL_LOGIN_DEFS).
  IconData _portalIcon(PortalType portal) {
    switch (portal) {
      case PortalType.platform:
        return Icons.shield_outlined;
      case PortalType.school:
        return Icons.business_outlined;
      case PortalType.teacher:
        return Icons.school_outlined;
      case PortalType.parent:
        return Icons.people_outline;
      case PortalType.public:
        return Icons.public_outlined;
    }
  }

  /// Builds a circular school logo with gold halo (matches web LogoCircle).
  Widget _buildSchoolLogo(String logoUrl) {
    final isUrl = logoUrl.startsWith('http://') || logoUrl.startsWith('https://');
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AHColors.gold.withOpacity(0.12),
            blurRadius: 20,
            spreadRadius: 4,
          ),
          BoxShadow(
            color: AHColors.gold.withOpacity(0.04),
            blurRadius: 40,
            spreadRadius: 8,
          ),
        ],
      ),
      child: ClipOval(
        child: Container(
          color: Colors.white,
          child: isUrl
              ? Image.network(
                  logoUrl,
                  fit: BoxFit.cover,
                  width: 80,
                  height: 80,
                  errorBuilder: (_, __, ___) => const AHLogoCircle(size: 80, animated: false),
                )
              : const AHLogoCircle(size: 80, animated: false),
        ),
      ),
    );
  }

  Widget _buildLoginCard() {
    final selectedPortal = ref.watch(selectedPortalProvider);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AHRadius.xl),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LoginForm(
        onSubmit: _handleLogin,
        isLoading: _isLoading,
        error: _error,
        portalType: selectedPortal,
        onGoogleSignIn: _handleGoogleSignIn,
      ),
    );
  }
}
