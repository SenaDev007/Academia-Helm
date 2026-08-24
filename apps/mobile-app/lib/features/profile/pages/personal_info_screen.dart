import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';

/// Personal information screen — displays the logged-in user's profile data
/// fetched from /auth/me (fresh from DB) with fallback to cached AuthUser.
class PersonalInfoScreen extends ConsumerStatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  ConsumerState<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends ConsumerState<PersonalInfoScreen> {
  Map<String, dynamic>? _freshData;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final apiClient = ref.read(apiClientProvider);
      final result = await apiClient.getRaw('/auth/me');
      result.when(
        success: (data) {
          setState(() {
            _freshData = data;
            _loading = false;
          });
        },
        failure: (e) {
          setState(() {
            _error = e.message;
            _loading = false;
          });
        },
        loading: () {},
      );
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final cachedUser = authState?.userOrNull;

    // Use fresh data if available, else cached user
    final firstName = _freshData?['firstName']?.toString() ??
        cachedUser?.firstName ??
        '';
    final lastName = _freshData?['lastName']?.toString() ??
        cachedUser?.lastName ??
        '';
    final email =
        _freshData?['email']?.toString() ?? cachedUser?.email ?? '';
    final phone = _freshData?['phone']?.toString() ??
        _freshData?['phoneNumber']?.toString() ??
        cachedUser?.phone ??
        '';
    final role = _freshData?['role']?.toString() ??
        cachedUser?.role ??
        '';
    final matricule = _freshData?['matricule']?.toString() ??
        _freshData?['matriculeNumber']?.toString() ??
        '';
    final avatarUrl = _freshData?['avatarUrl']?.toString() ??
        _freshData?['photoUrl']?.toString() ??
        cachedUser?.avatarUrl;
    final isActive = _freshData?['isActive'] ?? cachedUser?.isActive ?? true;
    final lastLoginAt = _freshData?['lastLoginAt']?.toString() ??
        cachedUser?.lastLoginAt?.toString();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(
          showBackButton: true, title: 'Informations personnelles'),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: _fetchProfile,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AHColors.navy))
            : ListView(
                padding: const EdgeInsets.all(AHSpacing.lg),
                children: [
                  // ── Avatar + Name ────────────────────────────────────
                  Center(
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 50,
                          backgroundColor: AHColors.navy,
                          backgroundImage: avatarUrl != null && avatarUrl.isNotEmpty
                              ? NetworkImage(avatarUrl)
                              : null,
                          child: avatarUrl == null || avatarUrl.isEmpty
                              ? Text(
                                  _getInitials('$firstName $lastName'),
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w800,
                                    color: AHColors.gold,
                                  ),
                                )
                              : null,
                        ),
                        const SizedBox(height: AHSpacing.md),
                        Text(
                          '$firstName $lastName',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: isActive
                                ? const Color(0xFFDCFCE7)
                                : const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            isActive ? 'Actif' : 'Inactif',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isActive
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFFDC2626),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xl),

                  // ── Personal Info Section ────────────────────────────
                  _InfoSection(title: 'Identité', children: [
                    _InfoTile(
                      icon: Icons.person_outline,
                      label: 'Prénom',
                      value: firstName,
                    ),
                    _InfoTile(
                      icon: Icons.person_outline,
                      label: 'Nom',
                      value: lastName,
                    ),
                    if (matricule.isNotEmpty)
                      _InfoTile(
                        icon: Icons.badge_outlined,
                        label: 'Matricule',
                        value: matricule,
                      ),
                    _InfoTile(
                      icon: Icons.shield_outlined,
                      label: 'Rôle',
                      value: _getRoleLabel(role),
                    ),
                  ]),

                  const SizedBox(height: AHSpacing.md),

                  // ── Contact Section ──────────────────────────────────
                  _InfoSection(title: 'Contact', children: [
                    _InfoTile(
                      icon: Icons.email_outlined,
                      label: 'Email',
                      value: email,
                    ),
                    _InfoTile(
                      icon: Icons.phone_outlined,
                      label: 'Téléphone',
                      value: phone.isNotEmpty ? phone : 'Non renseigné',
                    ),
                  ]),

                  const SizedBox(height: AHSpacing.md),

                  // ── Account Section ──────────────────────────────────
                  _InfoSection(title: 'Compte', children: [
                    _InfoTile(
                      icon: Icons.verified_user_outlined,
                      label: 'Statut',
                      value: isActive ? 'Compte actif' : 'Compte inactif',
                    ),
                    if (lastLoginAt != null && lastLoginAt.isNotEmpty)
                      _InfoTile(
                        icon: Icons.access_time,
                        label: 'Dernière connexion',
                        value: _formatDate(lastLoginAt),
                      ),
                  ]),

                  if (_error != null) ...[
                    const SizedBox(height: AHSpacing.md),
                    Container(
                      padding: const EdgeInsets.all(AHSpacing.md),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AHColors.error),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AHColors.error, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Erreur: $_error',
                              style: const TextStyle(
                                  fontSize: 12, color: AHColors.error),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: AHSpacing.lg),
                  OutlinedButton.icon(
                    onPressed: _fetchProfile,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Rafraîchir'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AHColors.navy,
                      side: const BorderSide(color: AHColors.navy),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty
        ? name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase()
        : '';
  }

  String _getRoleLabel(String role) {
    switch (role.toUpperCase()) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'Administrateur';
      case 'TEACHER':
      case 'ENSEIGNANT':
        return 'Enseignant';
      case 'PARENT':
      case 'PARENT_PRIMARY':
      case 'LEGAL_GUARDIAN':
        return 'Parent';
      case 'STUDENT':
        return 'Élève';
      case 'DIRECTEUR':
      case 'DIRECTEUR_GENERAL':
      case 'DIRECTEUR_ETABLISSEMENT':
        return 'Directeur';
      case 'SCOLARITE':
        return 'Scolarité';
      case 'COMPTABLE':
        return 'Comptable';
      case 'CENSEUR':
        return 'Censeur';
      case 'SURVEILLANT':
      case 'SURVEILLANT_GENERAL':
        return 'Surveillant';
      case 'SECRETAIRE':
      case 'SECRETAIRE_GENERAL':
        return 'Secrétaire';
      case 'CAISSIER':
        return 'Caissier';
      case 'HR_MANAGER':
        return 'Responsable RH';
      case 'FINANCE_MANAGER':
      case 'CFO':
        return 'Responsable Finance';
      default:
        return role;
    }
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} à ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}

// ── Reusable widgets ────────────────────────────────────────────────────

class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AHColors.grey500,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AHColors.grey400),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AHColors.grey500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
