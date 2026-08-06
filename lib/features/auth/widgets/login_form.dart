import '../../../core/theme/ah_spacing.dart';
import '../../../core/theme/ah_colors.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_theme.dart';
import '../providers/portal_provider.dart';

/// Reusable login form widget.
///
/// Adapts its fields based on the selected portal type:
/// - PLATFORM / SCHOOL → Email + Password (standard login)
/// - TEACHER → Matricule + Password (matches web LoginPage's teacher flow)
/// - PARENT → handled separately (phone/email + OTP — will be added in step 4)
class LoginForm extends StatefulWidget {
  const LoginForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
    this.error,
    this.portalType,
  });

  /// Called when the user submits the form.
  /// First argument is the identifier (email or matricule), second is password.
  final Future<void> Function(String identifier, String password) onSubmit;
  final bool isLoading;
  final String? error;

  /// Portal type — controls which fields are displayed.
  /// Defaults to null (standard email login).
  final PortalType? portalType;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  bool get _isTeacherPortal => widget.portalType == PortalType.teacher;
  bool get _isParentPortal => widget.portalType == PortalType.parent;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    widget.onSubmit(
      _identifierController.text.trim(),
      _passwordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Error Display ────────────────────────────────────────
          if (widget.error != null)
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
                border: Border.all(color: AHColors.error.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AHColors.error, size: 20),
                  const SizedBox(width: AHSpacing.sm),
                  Expanded(
                    child: Text(
                      widget.error!,
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

          // ── Identifier Field (Email or Matricule) ────────────────
          _buildIdentifierField(),
          const SizedBox(height: AHSpacing.lg),

          // ── Password Field ───────────────────────────────────────
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onFieldSubmitted: (_) => _submit(),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Le mot de passe est requis';
              }
              if (value.length < 6) {
                return 'Le mot de passe doit contenir au moins 6 caractères';
              }
              return null;
            },
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              labelText: 'Mot de passe',
              hintText: '••••••••',
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: AHColors.gray400,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: AHSpacing.sm),

          // ── Forgot Password ──────────────────────────────────────
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: widget.isLoading
                  ? null
                  : () {
                      context.go('/forgot-password');
                    },
              child: const Text(
                'Mot de passe oublié ?',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          const SizedBox(height: AHSpacing.lg),

          // ── Login Button ─────────────────────────────────────────
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: widget.isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.navy,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AHRadius.md),
                ),
                disabledBackgroundColor: AHColors.navy.withOpacity(0.5),
              ),
              child: widget.isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : const Text(
                      'Se connecter',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the identifier field — Email for SCHOOL/PLATFORM,
  /// Matricule for TEACHER, Phone for PARENT.
  Widget _buildIdentifierField() {
    if (_isTeacherPortal) {
      // Teacher portal: Matricule field (matches web LoginPage's teacher flow)
      return TextFormField(
        controller: _identifierController,
        keyboardType: TextInputType.text,
        textInputAction: TextInputAction.next,
        textCapitalization: TextCapitalization.characters,
        autofillHints: const [AutofillHints.username],
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return 'Le matricule est requis';
          }
          if (value.trim().length < 3) {
            return 'Veuillez entrer un matricule valide';
          }
          return null;
        },
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.badge_outlined, size: 20),
          labelText: 'Matricule / Identifiant',
          hintText: 'EMP001',
          helperText: 'Votre identifiant professionnel fourni par l\'établissement',
        ),
      );
    }

    if (_isParentPortal) {
      // Parent portal: Phone field (matches web LoginPage's parent flow —
      // direct phone+password login, OTP step currently disabled)
      return TextFormField(
        controller: _identifierController,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.telephoneNumber],
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return 'Le numéro de téléphone est requis';
          }
          // Accept +229 90 00 00 00 or 90000000 — min 8 digits
          final digits = value.replaceAll(RegExp(r'[^\d]'), '');
          if (digits.length < 8) {
            return 'Veuillez entrer un numéro de téléphone valide';
          }
          return null;
        },
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.phone_outlined, size: 20),
          labelText: 'Numéro de téléphone',
          hintText: '+229 90 00 00 00',
          helperText: 'Le numéro associé à votre compte parent',
        ),
      );
    }

    // Standard portal (SCHOOL / PLATFORM): Email field
    return TextFormField(
      controller: _identifierController,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      autofillHints: const [AutofillHints.email],
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
    );
  }
}
