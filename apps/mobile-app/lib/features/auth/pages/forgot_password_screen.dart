import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/theme/ah_theme.dart';

/// Forgot password screen with:
/// - Email input field
/// - "Envoyer le code" button
/// - Success message with transition to OTP entry
/// - "Retour à la connexion" link
/// - Navy gradient background, white card (same style as login)
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  bool _codeSent = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref
          .read(authNotifierProvider.notifier)
          .forgotPassword(_emailController.text.trim());

      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _codeSent = true;
      });

      // Navigate to reset password after a short delay
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) {
        context.go('/reset-password?email=${Uri.encodeComponent(_emailController.text.trim())}');
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
          _error = 'Erreur lors de l\'envoi. Veuillez réessayer.';
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
                  ? ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: _buildContent(),
                    )
                  : _buildContent(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildBrandingHeader(),
        const SizedBox(height: AHSpacing.xxl),
        _buildCard(),
      ],
    );
  }

  Widget _buildBrandingHeader() {
    return Column(
      children: [
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
            Icons.lock_reset,
            color: AHColors.gold,
            size: 40,
          ),
        ),
        const SizedBox(height: AHSpacing.lg),
        const Text(
          'Mot de passe oublié',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: AHSpacing.xs),
        Text(
          'Entrez votre email pour recevoir un code de réinitialisation',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildCard() {
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
      child: _codeSent ? _buildSuccessContent() : _buildFormContent(),
    );
  }

  Widget _buildFormContent() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Error Display ────────────────────────────────────────
          if (_error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: AHSpacing.lg,
                vertical: AHSpacing.md,
              ),
              margin: const EdgeInsets.only(bottom: AHSpacing.lg),
              decoration: BoxDecoration(
                color: AHColors.errorLight,
                borderRadius: BorderRadius.circular(AHRadius.md),
                border: Border.all(
                    color: AHColors.error.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: AHColors.error, size: 20),
                  const SizedBox(width: AHSpacing.sm),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: AHColors.error,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // ── Email Field ──────────────────────────────────────────
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
            onFieldSubmitted: (_) => _handleSubmit(),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'L\'email est requis';
              }
              if (!value.contains('@')) {
                return 'Veuillez entrer un email valide';
              }
              return null;
            },
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.email_outlined, size: 20),
              labelText: 'Adresse email',
              hintText: 'votre@email.com',
            ),
          ),
          const SizedBox(height: AHSpacing.xl),

          // ── Submit Button ───────────────────────────────────────
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AHRadius.md),
                ),
                disabledBackgroundColor:
                    AHColors.navy.withValues(alpha: 0.5),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Text(
                      'Envoyer le code',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: AHSpacing.lg),

          // ── Back to Login ───────────────────────────────────────
          Center(
            child: TextButton(
              onPressed: () => context.go('/login'),
              child: const Text(
                'Retour à la connexion',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessContent() {
    return Column(
      children: [
        const Icon(
          Icons.mark_email_read,
          size: 48,
          color: AHColors.success,
        ),
        const SizedBox(height: AHSpacing.lg),
        const Text(
          'Code envoyé !',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AHColors.gray900,
          ),
        ),
        const SizedBox(height: AHSpacing.sm),
        Text(
          'Un code de vérification a été envoyé à ${_emailController.text.trim()}',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            color: AHColors.gray500,
          ),
        ),
        const SizedBox(height: AHSpacing.lg),
        const CircularProgressIndicator(color: AHColors.navy),
        const SizedBox(height: AHSpacing.sm),
        Text(
          'Redirection vers la vérification...',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            color: AHColors.gray400,
          ),
        ),
      ],
    );
  }
}
