import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';

/// Change password screen — implements the OTP flow:
/// 1. User enters current email (pre-filled from auth state)
/// 2. Send OTP to user's email via POST /auth/forgot-password (Resend)
/// 3. User enters the 6-digit OTP code received by email
/// 4. Verify OTP via POST /auth/verify-reset-otp
/// 5. User enters new password
/// 6. Reset password via POST /auth/reset-password (email + code + newPassword)
///
/// This mirrors the web app's forgot-password → verify-otp → reset-password
/// flow, adapted for the mobile "change password" use case.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();

  int _step = 0; // 0=email, 1=otp, 2=new password
  bool _loading = false;
  String? _error;
  bool _otpSent = false;
  bool _showPassword = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill email from auth state
    final user = ref.read(authNotifierProvider).valueOrNull?.userOrNull;
    if (user != null) {
      _emailCtrl.text = user.email;
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _newPasswordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(
          showBackButton: true, title: 'Changer le mot de passe'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AHSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Progress indicator ──────────────────────────────────
            _ProgressIndicator(step: _step),
            const SizedBox(height: AHSpacing.xl),

            // ── Step content ────────────────────────────────────────
            if (_step == 0) ...[
              const Text(
                'Vérification d\'identité',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AHColors.navy,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Pour changer votre mot de passe, nous allons envoyer un code de vérification à votre adresse email.',
                style: TextStyle(fontSize: 13, color: AHColors.grey500),
              ),
              const SizedBox(height: AHSpacing.lg),
              TextField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Adresse email',
                  prefixIcon:
                      Icon(Icons.email_outlined, color: AHColors.grey400),
                  border: OutlineInputBorder(),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.grey200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.navy, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: AHSpacing.md),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _sendOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AHColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Envoyer le code'),
                ),
              ),
            ],

            if (_step == 1) ...[
              const Text(
                'Code de vérification',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AHColors.navy,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Un code à 6 chiffres a été envoyé à ${_emailCtrl.text}. '
                'Saisissez-le ci-dessous.',
                style: const TextStyle(fontSize: 13, color: AHColors.grey500),
              ),
              const SizedBox(height: AHSpacing.lg),
              TextField(
                controller: _otpCtrl,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 8,
                ),
                decoration: const InputDecoration(
                  hintText: '------',
                  prefixIcon:
                      Icon(Icons.password_outlined, color: AHColors.grey400),
                  border: OutlineInputBorder(),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.grey200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.navy, width: 2),
                  ),
                  counterText: '',
                ),
              ),
              const SizedBox(height: AHSpacing.md),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _verifyOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AHColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Vérifier le code'),
                ),
              ),
              const SizedBox(height: AHSpacing.sm),
              Center(
                child: TextButton(
                  onPressed: _loading ? null : _sendOtp,
                  child: const Text(
                    'Renvoyer le code',
                    style: TextStyle(
                      color: AHColors.navy,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],

            if (_step == 2) ...[
              const Text(
                'Nouveau mot de passe',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AHColors.navy,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choisissez un nouveau mot de passe (minimum 8 caractères).',
                style: TextStyle(fontSize: 13, color: AHColors.grey500),
              ),
              const SizedBox(height: AHSpacing.lg),
              TextField(
                controller: _newPasswordCtrl,
                obscureText: !_showPassword,
                decoration: InputDecoration(
                  labelText: 'Nouveau mot de passe',
                  prefixIcon: const Icon(Icons.lock_outline,
                      color: AHColors.grey400),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _showPassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: AHColors.grey400,
                    ),
                    onPressed: () =>
                        setState(() => _showPassword = !_showPassword),
                  ),
                  border: const OutlineInputBorder(),
                  enabledBorder: const OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.grey200),
                  ),
                  focusedBorder: const OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.navy, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: AHSpacing.md),
              TextField(
                controller: _confirmPasswordCtrl,
                obscureText: !_showPassword,
                decoration: const InputDecoration(
                  labelText: 'Confirmer le mot de passe',
                  prefixIcon:
                      Icon(Icons.lock_outline, color: AHColors.grey400),
                  border: OutlineInputBorder(),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.grey200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: AHColors.navy, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: AHSpacing.md),
              // Password requirements
              _PasswordRequirements(
                  password: _newPasswordCtrl.text),
              const SizedBox(height: AHSpacing.md),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _resetPassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AHColors.navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Changer le mot de passe'),
                ),
              ),
            ],

            // ── Error message ────────────────────────────────────────
            if (_error != null) ...[
              const SizedBox(height: AHSpacing.md),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AHColors.error),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        color: AHColors.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                            fontSize: 12, color: AHColors.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Step 0: Send OTP ──────────────────────────────────────────────────

  Future<void> _sendOtp() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Veuillez saisir votre adresse email');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final result = await apiClient.postRaw(
        '/auth/forgot-password',
        data: {'email': email},
      );

      setState(() => _loading = false);

      if (result is ApiSuccess) {
        setState(() {
          _step = 1;
          _otpSent = true;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Code de vérification envoyé par email'),
              backgroundColor: AHColors.success,
            ),
          );
        }
      } else if (result is ApiFailure) {
        setState(() => _error = result.error.message);
      }
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  // ── Step 1: Verify OTP ───────────────────────────────────────────────

  Future<void> _verifyOtp() async {
    final email = _emailCtrl.text.trim();
    final code = _otpCtrl.text.trim();

    if (code.length != 6) {
      setState(() => _error = 'Le code doit contenir 6 chiffres');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final result = await apiClient.postRaw(
        '/auth/verify-reset-otp',
        data: {'email': email, 'code': code},
      );

      setState(() => _loading = false);

      if (result is ApiSuccess) {
        setState(() => _step = 2);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Code vérifié avec succès'),
              backgroundColor: AHColors.success,
            ),
          );
        }
      } else if (result is ApiFailure) {
        setState(() => _error = result.error.message);
      }
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  // ── Step 2: Reset password ────────────────────────────────────────────

  Future<void> _resetPassword() async {
    final email = _emailCtrl.text.trim();
    final code = _otpCtrl.text.trim();
    final newPassword = _newPasswordCtrl.text;
    final confirmPassword = _confirmPasswordCtrl.text;

    if (newPassword.length < 8) {
      setState(() => _error = 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword != confirmPassword) {
      setState(() => _error = 'Les mots de passe ne correspondent pas');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final result = await apiClient.postRaw(
        '/auth/reset-password',
        data: {
          'email': email,
          'code': code,
          'newPassword': newPassword,
        },
      );

      setState(() => _loading = false);

      if (result is ApiSuccess) {
        // Password changed — logout and redirect to login
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Mot de passe changé avec succès. Veuillez vous reconnecter.'),
              backgroundColor: AHColors.success,
              duration: Duration(seconds: 3),
            ),
          );
          // Logout the user since their session is now invalid
          await ref.read(authNotifierProvider.notifier).logout();
          if (mounted) {
            context.go('/login');
          }
        }
      } else if (result is ApiFailure) {
        setState(() => _error = result.error.message);
      }
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }
}

// ── Progress indicator ──────────────────────────────────────────────────

class _ProgressIndicator extends StatelessWidget {
  const _ProgressIndicator({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StepDot(active: step >= 0, label: '1', title: 'Email'),
        const Expanded(child: Divider(color: AHColors.grey200)),
        _StepDot(active: step >= 1, label: '2', title: 'Code'),
        const Expanded(child: Divider(color: AHColors.grey200)),
        _StepDot(active: step >= 2, label: '3', title: 'Mot de passe'),
      ],
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({
    required this.active,
    required this.label,
    required this.title,
  });
  final bool active;
  final String label;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: active ? AHColors.navy : AHColors.grey200,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: active ? Colors.white : AHColors.grey400,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: active ? AHColors.navy : AHColors.grey400,
          ),
        ),
      ],
    );
  }
}

// ── Password requirements ───────────────────────────────────────────────

class _PasswordRequirements extends StatelessWidget {
  const _PasswordRequirements({required this.password});
  final String password;

  @override
  Widget build(BuildContext context) {
    final checks = <_Check>[
      _Check('Au moins 8 caractères', password.length >= 8),
      _Check('Une lettre majuscule',
          RegExp(r'[A-Z]').hasMatch(password)),
      _Check('Une lettre minuscule',
          RegExp(r'[a-z]').hasMatch(password)),
      _Check('Un chiffre', RegExp(r'[0-9]').hasMatch(password)),
      _Check(
          'Un caractère spécial', RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)),
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: checks.map((c) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Icon(
                  c.passed ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 16,
                  color: c.passed ? AHColors.success : AHColors.grey300,
                ),
                const SizedBox(width: 8),
                Text(
                  c.label,
                  style: TextStyle(
                    fontSize: 12,
                    color: c.passed ? AHColors.grey600 : AHColors.grey400,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _Check {
  final String label;
  final bool passed;
  const _Check(this.label, this.passed);
}
