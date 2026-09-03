// ============================================================================
// HELM CONNECT — Login Screen
// ============================================================================
// ⭐ V3-9: Portal-aware login — adapts fields + API endpoint per portal:
//   - school:   POST /auth/login          {email, password, tenant_id}
//   - teacher:  POST /portal/auth/teacher   {teacherIdentifier, password, tenantId}
//   - parent:   POST /portal/auth/parent    {identifierType, email|phone, password?, tenantId}
//
// After connexion : redirection vers la ChatScreen principale.
// Session persiste (auto-login au prochain lancement).
// ============================================================================

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../services/api_service.dart';
import 'chat_screen.dart';

class LoginScreen extends StatefulWidget {
  final String tenantSlug;
  final String tenantName;
  final String portal; // 'parent', 'teacher', or 'school'

  const LoginScreen({
    super.key,
    required this.tenantSlug,
    required this.tenantName,
    required this.portal,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _loading = false;
  String? _error;

  // ⭐ Portal-specific config
  bool get _isTeacher => widget.portal == 'teacher';
  bool get _isParent => widget.portal == 'parent';

  // For parent: auto-detect email vs phone
  bool get _isPhoneMode {
    if (!_isParent) return false;
    final text = _identifierController.text.trim();
    return text.isNotEmpty && !text.contains('@');
  }

  String get _identifierLabel {
    if (_isTeacher) return 'Matricule / Identifiant';
    if (_isParent) return _isPhoneMode ? 'Numéro de téléphone' : 'Adresse email';
    return 'Adresse email';
  }

  String get _identifierHint {
    if (_isTeacher) return 'EMP001';
    if (_isParent) return _isPhoneMode ? '+229 XX XX XX XX' : 'votre@email.com';
    return 'votre@email.com';
  }

  TextInputType get _identifierKeyboard {
    if (_isTeacher) return TextInputType.text;
    if (_isParent && _isPhoneMode) return TextInputType.phone;
    return TextInputType.emailAddress;
  }

  bool get _passwordRequired {
    if (_isParent) {
      // Parent: password required for email mode, hidden for phone mode
      return !_isPhoneMode;
    }
    return true; // school + teacher: always required
  }

  bool get _showPasswordField {
    if (_isParent && _isPhoneMode) return false;
    return true;
  }

  String get _passwordLabel {
    if (_isParent && !_isPhoneMode) return 'Mot de passe (optionnel)';
    return 'Mot de passe';
  }

  String get _portalDisplayName {
    if (_isTeacher) return 'Enseignant';
    if (_isParent) return 'Parent / Élève';
    return 'Administration';
  }

  IconData get _portalIcon {
    if (_isTeacher) return Icons.cast_for_education;
    if (_isParent) return Icons.family_restroom;
    return Icons.business;
  }

  Color get _portalColor {
    if (_isTeacher) return const Color(0xFF1677FF);
    if (_isParent) return const Color(0xFF10B981);
    return const Color(0xFF7C3AED);
  }

  @override
  void initState() {
    super.initState();
    // ⭐ For parent: re-render on text change to toggle email/phone mode
    _identifierController.addListener(() {
      if (_isParent && mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    // Validation
    if (identifier.isEmpty) {
      setState(() => _error = _isTeacher
          ? 'Veuillez saisir votre matricule'
          : 'Veuillez saisir votre ${_isPhoneMode ? 'numéro de téléphone' : 'adresse email'}');
      return;
    }
    if (_passwordRequired && password.isEmpty) {
      setState(() => _error = 'Veuillez saisir votre mot de passe');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      // ⭐ Call the portal-aware login API
      final data = await ApiService.loginByPortal(
        portal: widget.portal,
        identifier: identifier,
        password: _showPasswordField ? password : null,
        tenantSlug: widget.tenantSlug,
      );

      // ⭐ Persist the portal type for session restoration
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_portal', widget.portal);

      // ⭐ V6 — ENREGISTREMENT FCM dès la connexion (avant : uniquement au
      //    chemin d'AUTO-CONNEXION dans le splash → les utilisateurs qui se
      //    connectent pour la première fois n'avaient AUCUNE notification
      //    push jusqu'au redémarrage de l'application).
      try {
        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(alert: true, badge: true, sound: true);
        final fcmToken = await messaging.getToken();
        if (fcmToken != null) {
          await ApiService.registerFcmToken(
            fcmToken: fcmToken,
            platform: 'ANDROID',
            deviceInfo: 'Helm Connect Flutter',
          );
        }
      } catch (_) {
        // Silencieux : les notifications ne doivent JAMAIS bloquer la connexion
      }

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const ChatScreen()),
        );
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Erreur de connexion : $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Connexion'),
        backgroundColor: _portalColor,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tenant banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4FF),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBAE0FF)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.school, color: Color(0xFF0958D9)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Établissement sélectionné',
                            style: TextStyle(fontSize: 11, color: Color(0xFF667085), fontWeight: FontWeight.w500),
                          ),
                          Text(
                            widget.tenantName,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0958D9)),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Changer', style: TextStyle(color: Color(0xFF1677FF))),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Portal badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _portalColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _portalColor.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_portalIcon, color: _portalColor, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'Portail $_portalDisplayName',
                      style: TextStyle(
                        color: _portalColor,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // Helm Connect branding
              const Text(
                'Helm Connect',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF172033)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Connectez-vous avec votre compte Academia Helm',
                style: TextStyle(color: Color(0xFF667085), fontSize: 14),
              ),
              const SizedBox(height: 32),
              // Identifier field (email / matricule / phone)
              TextField(
                controller: _identifierController,
                keyboardType: _identifierKeyboard,
                textCapitalization: _isTeacher ? TextCapitalization.characters : TextCapitalization.none,
                decoration: InputDecoration(
                  labelText: _identifierLabel,
                  hintText: _identifierHint,
                  prefixIcon: Icon(_isTeacher ? Icons.badge : Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 16),
              // Password field (hidden for parent phone mode)
              if (_showPasswordField) ...[
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: _passwordLabel,
                    helperText: _isParent && !_isPhoneMode
                        ? 'Laisser vide pour recevoir un code OTP'
                        : null,
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  onSubmitted: (_) => _login(),
                ),
                const SizedBox(height: 16),
              ],
              // Error
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFF991B1B)))),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              // Login button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _loading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _portalColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Se connecter', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 24),
              // Forgot password (hidden for parent)
              if (!_isParent)
                Center(
                  child: TextButton(
                    onPressed: () {},
                    child: const Text('Mot de passe oublié ?'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
