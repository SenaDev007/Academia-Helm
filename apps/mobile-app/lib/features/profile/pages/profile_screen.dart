import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/ah_theme.dart';
import '../../../core/widgets/ah_app_bar.dart';

/// Profile screen with:
/// - User avatar
/// - Name, email, role
/// - School info
/// - Settings links
/// - Logout button
/// - Version info
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState?.userOrNull;
    final fullName = user?.displayName ?? 'Utilisateur';
    final email = user?.email ?? 'email@exemple.com';
    final role = user?.role ?? '';
    final tenantId = authState?.selectedTenantIdOrNull;
    final tenants = authState?.availableTenantsOrNull ?? [];
    final tenant = tenantId != null
        ? tenants.where((t) => t.id == tenantId).firstOrNull
        : null;
    final tenantName = tenant?.name ?? 'Aucun établissement';
    final tenantAcronym = tenant?.acronym ?? '';
    final initials = _getInitials(fullName);

    return Scaffold(
      appBar: const AHAppBar(showBackButton: true),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: AHSpacing.xxl),
        child: Column(
          children: [
            // ── Profile Header ─────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AHSpacing.xl),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AHColors.navy, AHColors.navyLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(AHRadius.xl),
                  bottomRight: Radius.circular(AHRadius.xl),
                ),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 44,
                    backgroundColor: AHColors.gold,
                    child: Text(
                      initials,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AHColors.gray900,
                      ),
                    ),
                  ),
                  const SizedBox(height: AHSpacing.lg),
                  Text(
                    fullName,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.xs),
                  Text(
                    email,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AHSpacing.md,
                      vertical: AHSpacing.sm,
                    ),
                    decoration: BoxDecoration(
                      color: AHColors.gold.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(AHRadius.full),
                    ),
                    child: Text(
                      _getRoleLabel(role),
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AHColors.gold,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: AHSpacing.lg),

            // ── School Info ────────────────────────────────────────
            _ProfileSection(
              title: 'Établissement',
              children: [
                _ProfileTile(
                  icon: Icons.school,
                  iconColor: AHColors.navy,
                  title: tenantName,
                  subtitle: tenantAcronym.isNotEmpty
                      ? 'Acronyme: $tenantAcronym'
                      : null,
                ),
              ],
            ),

            // ── Account Section ────────────────────────────────────
            _ProfileSection(
              title: 'Compte',
              children: [
                _ProfileTile(
                  icon: Icons.person_outline,
                  iconColor: AHColors.navy,
                  title: 'Informations personnelles',
                  subtitle: 'Nom, email, téléphone',
                  onTap: () {},
                ),
                _ProfileTile(
                  icon: Icons.lock_outline,
                  iconColor: AHColors.navy,
                  title: 'Changer le mot de passe',
                  subtitle: 'Modifier votre mot de passe',
                  onTap: () {},
                ),
                _ProfileTile(
                  icon: Icons.notifications_outlined,
                  iconColor: AHColors.navy,
                  title: 'Notifications',
                  subtitle: 'Gérer vos préférences',
                  onTap: () => context.go('/notifications'),
                ),
              ],
            ),

            // ── Preferences Section ─────────────────────────────────
            _ProfileSection(
              title: 'Préférences',
              children: [
                _ProfileTile(
                  icon: Icons.language,
                  iconColor: AHColors.info,
                  title: 'Langue',
                  subtitle: 'Français',
                  onTap: () {},
                ),
                _ProfileTile(
                  icon: Icons.dark_mode_outlined,
                  iconColor: AHColors.gray600,
                  title: 'Thème',
                  subtitle: 'Automatique',
                  onTap: () {},
                ),
              ],
            ),

            // ── Support Section ─────────────────────────────────────
            _ProfileSection(
              title: 'Support',
              children: [
                _ProfileTile(
                  icon: Icons.help_outline,
                  iconColor: AHColors.navy,
                  title: 'Centre d\'aide',
                  subtitle: 'FAQ et documentation',
                  onTap: () {},
                ),
                _ProfileTile(
                  icon: Icons.bug_report_outlined,
                  iconColor: AHColors.warning,
                  title: 'Signaler un problème',
                  subtitle: 'Aidez-nous à améliorer l\'application',
                  onTap: () {},
                ),
              ],
            ),

            const SizedBox(height: AHSpacing.lg),

            // ── Logout Button ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AHSpacing.xl),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final confirmed = await _showLogoutConfirmation(context);
                    if (confirmed == true) {
                      await ref.read(authNotifierProvider.notifier).logout();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    }
                  },
                  icon: const Icon(Icons.logout, size: 20),
                  label: const Text(
                    'Se déconnecter',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AHColors.error,
                    side: const BorderSide(color: AHColors.error),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AHRadius.md),
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: AHSpacing.xl),

            // ── Version Info ───────────────────────────────────────
            Text(
              'Academia Helm v1.0.0',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AHColors.gray400,
              ),
            ),
            Text(
              '© ${DateTime.now().year} YEHI OR Tech',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: AHColors.gray300,
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
    return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
  }

  String _getRoleLabel(String role) {
    switch (role) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'Administrateur';
      case 'TEACHER':
        return 'Enseignant';
      case 'PARENT':
        return 'Parent';
      case 'STUDENT':
        return 'Élève';
      default:
        return role;
    }
  }

  Future<bool?> _showLogoutConfirmation(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text(
          'Voulez-vous vraiment vous déconnecter de votre compte ?',
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHRadius.lg),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AHColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
  }
}

// ── Profile Section ───────────────────────────────────────────────────

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.xl,
        vertical: AHSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(
              left: AHSpacing.sm,
              bottom: AHSpacing.sm,
            ),
            child: Text(
              title,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AHColors.gray500,
              ),
            ),
          ),
          Card(
            margin: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AHRadius.lg),
            ),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

// ── Profile Tile ──────────────────────────────────────────────────────

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AHRadius.md),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AHColors.gray900,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                color: AHColors.gray500,
              ),
            )
          : null,
      trailing: onTap != null
          ? const Icon(Icons.chevron_right, color: AHColors.gray400, size: 20)
          : null,
      onTap: onTap,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHRadius.lg),
      ),
    );
  }
}
