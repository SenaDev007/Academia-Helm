import 'dart:math' show pi;

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
/// - PARENT → Phone/Email (auto-detect) + optional password (email mode only)
///   Matches web LoginPage's parent flow — direct phone+password login,
///   OTP step is currently disabled on the backend.
class LoginForm extends StatefulWidget {
  const LoginForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
    this.error,
    this.portalType,
    this.onGoogleSignIn,
  });

  /// Called when the user submits the form.
  /// First argument is the identifier (email, matricule, or phone/email),
  /// second is password (may be empty for parent phone mode).
  final Future<void> Function(String identifier, String password) onSubmit;
  final bool isLoading;
  final String? error;

  /// Portal type — controls which fields are displayed.
  /// Defaults to null (standard email login).
  final PortalType? portalType;

  /// Called when the user clicks the Google Sign-In button (SCHOOL only).
  /// If null, the Google button is not shown.
  final VoidCallback? onGoogleSignIn;

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
  bool get _isSchoolPortal => widget.portalType == PortalType.school;

  /// For PARENT portal: auto-detects if the input is an email (contains '@')
  /// or a phone number. Returns true if email mode.
  bool get _isParentEmailMode =>
      _isParentPortal && _identifierController.text.contains('@');

  @override
  void initState() {
    super.initState();
    _identifierController.addListener(() {
      if (_isParentPortal) {
        // Rebuild to update label/icon/placeholder when user types '@'
        setState(() {});
      }
    });
  }

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

          // ── Identifier Field (Email, Matricule, or Phone/Email) ──
          _buildIdentifierField(),
          const SizedBox(height: AHSpacing.lg),

          // ── Password Field ───────────────────────────────────────
          // For PARENT phone mode: password is NOT shown (direct phone login)
          // For PARENT email mode: password is OPTIONAL (shown with "optionnel" label)
          // For SCHOOL / TEACHER / PLATFORM: password is required
          if (!_isParentPortal || _isParentEmailMode) ...[
            _buildPasswordField(),
            const SizedBox(height: AHSpacing.sm),
          ],

          // ── Forgot Password (not shown for PARENT) ────────────────
          if (!_isParentPortal)
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
                  : Text(
                      _isParentPortal ? 'Se connecter' : 'Se connecter',
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),

          // ── Google Sign-In (SCHOOL only, matches web) ─────────────
          if (_isSchoolPortal && widget.onGoogleSignIn != null) ...[
            const SizedBox(height: AHSpacing.md),
            Row(
              children: [
                Expanded(child: Divider(color: AHColors.grey300)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md),
                  child: Text(
                    'ou',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: AHColors.grey500,
                    ),
                  ),
                ),
                Expanded(child: Divider(color: AHColors.grey300)),
              ],
            ),
            const SizedBox(height: AHSpacing.md),
            SizedBox(
              height: 48,
              child: OutlinedButton.icon(
                onPressed: widget.isLoading ? null : widget.onGoogleSignIn,
                icon: _buildGoogleIcon(),
                label: const Text(
                  'Continuer avec Google',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AHColors.grey700,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  backgroundColor: Colors.white,
                  side: BorderSide(color: AHColors.grey300),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AHRadius.md),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Builds the identifier field based on portal type.
  Widget _buildIdentifierField() {
    if (_isTeacherPortal) {
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
          prefixIcon: Icon(Icons.badge_outlined, size: 18),
          labelText: 'Matricule / Identifiant',
          hintText: 'EMP001',
          helperText: 'Votre matricule vous a été communiqué par l\'établissement',
          isDense: true,
          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
      );
    }

    if (_isParentPortal) {
      // Parent: auto-detect phone vs email based on '@' character
      final isEmail = _isParentEmailMode;
      return TextFormField(
        controller: _identifierController,
        keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.phone,
        textInputAction: TextInputAction.next,
        autofillHints: [
          isEmail ? AutofillHints.email : AutofillHints.telephoneNumber,
        ],
        validator: (value) {
          if (value == null || value.trim().isEmpty) {
            return isEmail
                ? 'L\'adresse email est requise'
                : 'Le numéro de téléphone est requis';
          }
          if (isEmail) {
            if (!value.contains('@') || !value.contains('.')) {
              return 'Veuillez entrer un email valide';
            }
          } else {
            // Phone validation: extract digits, require min 8
            final digits = value.replaceAll(RegExp(r'[^\d]'), '');
            if (digits.length < 8) {
              return 'Veuillez entrer un numéro valide (ex: +229 90 00 00 00)';
            }
          }
          return null;
        },
        decoration: InputDecoration(
          prefixIcon: Icon(
            isEmail ? Icons.email_outlined : Icons.phone_outlined,
            size: 18,
          ),
          labelText: isEmail ? 'Adresse email' : 'Numéro de téléphone',
          hintText: isEmail ? 'parent@exemple.com' : '+229 90 00 00 00',
          helperText: isEmail
              ? 'Email utilisé lors de l\'inscription de votre enfant'
              : 'Numéro ou email utilisé lors de l\'inscription de votre enfant',
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.email_outlined, size: 18),
        labelText: 'Adresse email',
        hintText: widget.portalType == PortalType.platform
            ? 'admin@academiahelm.com'
            : 'votre.email@etablissement.com',
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    );
  }

  /// Builds the password field — required for SCHOOL/TEACHER/PLATFORM,
  /// optional for PARENT (email mode only).
  Widget _buildPasswordField() {
    final isOptional = _isParentPortal && _isParentEmailMode;
    return TextFormField(
      controller: _passwordController,
      obscureText: _obscurePassword,
      textInputAction: TextInputAction.done,
      autofillHints: const [AutofillHints.password],
      onFieldSubmitted: (_) => _submit(),
      validator: (value) {
        // Password is optional for parent email mode
        if (isOptional) return null;
        if (value == null || value.isEmpty) {
          return 'Le mot de passe est requis';
        }
        if (value.length < 6) {
          return 'Le mot de passe doit contenir au moins 6 caractères';
        }
        return null;
      },
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.lock_outline, size: 18),
        labelText: isOptional ? 'Mot de passe (optionnel)' : 'Mot de passe',
        hintText: isOptional ? '•••••••• (laisser vide pour OTP)' : '••••••••',
        helperText: isOptional
            ? 'Optionnel : si vous avez un mot de passe, saisissez-le. Sinon, laissez vide.'
            : null,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: 18,
            color: AHColors.gray400,
          ),
          onPressed: () {
            setState(() {
              _obscurePassword = !_obscurePassword;
            });
          },
        ),
      ),
    );
  }

  /// Builds the official 4-color Google "G" logo using a custom widget.
  /// Renders the G as 4 colored arcs forming the classic Google logo:
  ///   blue (top-right), red (top-left), yellow (bottom-left), green (bottom-right)
  Widget _buildGoogleIcon() {
    return SizedBox(
      width: 18,
      height: 18,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

/// Paints the official Google "G" logo with its 4 brand colors.
/// The G is composed of 4 arcs that together form the iconic Google logo.
class _GoogleLogoPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFEA4335);
  static const _yellow = Color(0xFFFBBC05);
  static const _green = Color(0xFF34A853);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final outerRadius = size.width / 2;
    final strokeWidth = size.width * 0.22;
    final ringRadius = outerRadius - strokeWidth / 2;

    // Draw 4 arcs forming the Google G
    // Top-right quadrant (blue): 0° to -90°
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: ringRadius),
      -pi / 2, // start at top
      pi / 2, // sweep 90° clockwise
      false,
      Paint()
        ..color = _blue
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );
    // Top-left quadrant (red): -90° to -180°
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: ringRadius),
      pi, // start at left
      pi / 2, // sweep 90° clockwise
      false,
      Paint()
        ..color = _red
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );
    // Bottom-left quadrant (yellow): 180° to 270°
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: ringRadius),
      pi / 2, // start at bottom
      pi / 2, // sweep 90° clockwise
      false,
      Paint()
        ..color = _yellow
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );
    // Bottom-right quadrant (green): 270° to 360°
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: ringRadius),
      0, // start at right
      pi / 2, // sweep 90° clockwise
      false,
      Paint()
        ..color = _green
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round,
    );

    // Draw the horizontal bar (the G's inner horizontal stroke, blue)
    canvas.drawRect(
      Rect.fromCenter(
        center: Offset(center.dx + ringRadius * 0.35, center.dy),
        width: ringRadius * 0.65,
        height: strokeWidth,
      ),
      Paint()..color = _blue,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
