// ============================================================================
// LOGIN PAGE — Connexion (multi-portail)
// ============================================================================
// L'utilisateur sélectionne son type de portail (PARENT / TEACHER / SCHOOL)
// puis saisit ses identifiants.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../services/school_service.dart';

// Providers
final authServiceProvider = Provider<AuthService>((ref) => AuthService());
final selectedSchoolProvider = FutureProvider<SchoolInfo?>((ref) async {
  return SchoolService().getSavedSchool();
});

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  String _selectedPortal = 'PARENT';
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final school = ref.read(selectedSchoolProvider).maybeWhen(
          data: (s) => s,
          orElse: () => null,
        );

    if (school == null) {
      setState(() => _errorMessage = 'Aucune école sélectionnée');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final authService = ref.read(authServiceProvider);
    AuthResult result;

    if (_selectedPortal == 'PARENT') {
      result = await authService.loginParent(
        tenantId: school.id,
        identifier: _identifierController.text.trim(),
        password: _passwordController.text.isNotEmpty
            ? _passwordController.text
            : null,
      );
    } else if (_selectedPortal == 'TEACHER') {
      result = await authService.loginTeacher(
        tenantId: school.id,
        teacherIdentifier: _identifierController.text.trim(),
        password: _passwordController.text,
      );
    } else {
      result = await authService.loginSchool(
        tenantId: school.id,
        email: _identifierController.text.trim(),
        password: _passwordController.text,
      );
    }

    setState(() => _isLoading = false);

    if (result.success && mounted) {
      context.go('/dashboard');
    } else if (result.requiresOtp) {
      // TODO: gérer le flux OTP si PARENT_OTP_ENABLED=true
      setState(() => _errorMessage = result.message ?? 'Code OTP requis');
    } else {
      setState(() => _errorMessage = result.error ?? 'Erreur de connexion');
    }
  }

  @override
  Widget build(BuildContext context) {
    final schoolAsync = ref.watch(selectedSchoolProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Connexion'),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await SchoolService().clearSavedSchool();
              if (mounted) context.go('/');
            },
            icon: Icon(Icons.swap_horiz, color: Colors.white),
            label: Text('Changer d\'école', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // ── École sélectionnée ──
              schoolAsync.when(
                data: (school) => school == null
                    ? SizedBox.shrink()
                    : Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(Icons.school, color: AppTheme.blue),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      school.name,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                    if (school.city != null)
                                      Text(
                                        school.city!,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                loading: () => CircularProgressIndicator(),
                error: (_, __) => SizedBox.shrink(),
              ),

              const SizedBox(height: 24),

              // ── Sélecteur de portail ──
              Text(
                'Type de connexion',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(
                    value: 'PARENT',
                    label: Text('Parent'),
                    icon: Icon(Icons.family_restroom),
                  ),
                  ButtonSegment(
                    value: 'TEACHER',
                    label: Text('Enseignant'),
                    icon: Icon(Icons.person),
                  ),
                  ButtonSegment(
                    value: 'SCHOOL',
                    label: Text('École'),
                    icon: Icon(Icons.business),
                  ),
                ],
                selected: {_selectedPortal},
                onSelectionChanged: (selection) {
                  setState(() {
                    _selectedPortal = selection.first;
                    _identifierController.clear();
                    _passwordController.clear();
                    _errorMessage = null;
                  });
                },
              ),

              const SizedBox(height: 24),

              // ── Identifiant ──
              TextFormField(
                controller: _identifierController,
                decoration: InputDecoration(
                  labelText: _selectedPortal == 'PARENT'
                      ? 'Téléphone ou email'
                      : _selectedPortal == 'TEACHER'
                          ? 'Matricule enseignant'
                          : 'Email',
                  prefixIcon: Icon(_selectedPortal == 'PARENT'
                      ? Icons.phone
                      : Icons.email),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ce champ est requis';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 16),

              // ── Mot de passe ──
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: _selectedPortal == 'PARENT'
                      ? 'Mot de passe (optionnel)'
                      : 'Mot de passe',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (_selectedPortal != 'PARENT') {
                    if (value == null || value.isEmpty) {
                      return 'Mot de passe requis';
                    }
                  }
                  return null;
                },
              ),

              // ── Message d'erreur ──
              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    border: Border.all(color: Colors.red.shade200),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // ── Bouton de connexion ──
              ElevatedButton(
                onPressed: _isLoading ? null : _handleLogin,
                child: _isLoading
                    ? SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text('Se connecter'),
              ),

              const SizedBox(height: 16),

              // ── Aide ──
              Text(
                _selectedPortal == 'PARENT'
                    ? 'Utilisez le numéro de téléphone ou l\'email fourni lors de l\'inscription de votre enfant.'
                    : 'Contactez l\'administration si vous avez oublié vos identifiants.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade500,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
