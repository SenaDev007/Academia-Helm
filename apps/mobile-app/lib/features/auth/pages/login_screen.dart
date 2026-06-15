import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_theme.dart';
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

  Future<void> _handleLogin(String email, String password) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref.read(authNotifierProvider.notifier).login(
            email: email,
            password: password,
          );

      if (!mounted) return;

      final authState = ref.read(authNotifierProvider).valueOrNull;
      if (authState?.isAuthenticated == true) {
        final tenants = authState?.availableTenantsOrNull ?? [];

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
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AHSpacing.xl),
              child: isTablet
                  ? _buildTabletLayout()
                  : _buildPhoneLayout(),
            ),
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
    return Column(
      children: [
        // ── Shield Logo ──────────────────────────────────────────
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

        // ── App Name ────────────────────────────────────────────
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

        // ── Subtitle ────────────────────────────────────────────
        Text(
          'Connectez-vous à votre espace',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AHSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AHRadius.xl),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LoginForm(
        onSubmit: _handleLogin,
        isLoading: _isLoading,
        error: _error,
      ),
    );
  }
}
