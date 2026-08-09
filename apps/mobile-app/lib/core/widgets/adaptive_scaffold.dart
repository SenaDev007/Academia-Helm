import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';
import '../auth/logout_state.dart';
import '../providers/school_identity_provider.dart';

/// A destination for the adaptive navigation.
class AdaptiveDestination {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String path;

  const AdaptiveDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.path,
  });
}

/// Adaptive scaffold that switches between:
/// - Phone: BottomNavigationBar with 5 primary destinations + "Plus" button
/// - Tablet: NavigationRail
/// - Desktop: NavigationDrawer (side panel)
class AHAdaptiveScaffold extends ConsumerWidget {
  const AHAdaptiveScaffold({
    super.key,
    required this.destinations,
    required this.currentPath,
    required this.onDestinationSelected,
    required this.child,
  });

  final List<AdaptiveDestination> destinations;
  final String currentPath;
  final ValueChanged<String> onDestinationSelected;
  final Widget child;

  int get _currentIndex {
    for (int i = 0; i < destinations.length; i++) {
      if (currentPath.startsWith(destinations[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 840) {
          return _buildDesktopLayout(context, ref);
        } else if (constraints.maxWidth >= 600) {
          return _buildTabletLayout(context, ref);
        } else {
          return _buildPhoneLayout(context, ref);
        }
      },
    );
  }

  // ── Phone: Bottom Navigation with "Plus" button ───────────────────
  Widget _buildPhoneLayout(BuildContext context, WidgetRef ref) {
    // Primary destinations shown in the bottom bar (max 4 to leave room for "Plus")
    final primary = destinations.take(4).toList();
    final hasMore = destinations.length > 4;

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex < 4 ? _currentIndex : 4,
        onDestinationSelected: (index) {
          if (index == 4 && hasMore) {
            _showMoreModulesSheet(context);
            return;
          }
          if (index < primary.length) {
            onDestinationSelected(primary[index].path);
          }
        },
        destinations: [
          ...primary.map((d) => NavigationDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.selectedIcon),
                label: d.label,
              )),
          if (hasMore)
            const NavigationDestination(
              icon: Icon(Icons.apps_outlined),
              selectedIcon: Icon(Icons.apps),
              label: 'Plus',
            ),
        ],
        backgroundColor: Colors.white,
        indicatorColor: AHColors.navy.withOpacity(0.1),
        height: 64,
      ),
    );
  }

  /// Shows a modal bottom sheet with the remaining modules.
  void _showMoreModulesSheet(BuildContext context) {
    final remaining = destinations.skip(4).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AHSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AHColors.grey300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    margin: const EdgeInsets.only(bottom: AHSpacing.md),
                  ),
                ),
                Text(
                  'Tous les modules',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AHColors.navy,
                  ),
                ),
                const SizedBox(height: AHSpacing.md),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: AHSpacing.md,
                    crossAxisSpacing: AHSpacing.md,
                    childAspectRatio: 0.9,
                  ),
                  itemCount: remaining.length,
                  itemBuilder: (context, index) {
                    final d = remaining[index];
                    final isActive = currentPath.startsWith(d.path);
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        onDestinationSelected(d.path);
                      },
                      child: Column(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: isActive
                                  ? AHColors.navy
                                  : AHColors.navy.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              isActive ? d.selectedIcon : d.icon,
                              color: isActive
                                  ? AHColors.gold
                                  : AHColors.navy,
                              size: 24,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            d.label,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: isActive
                                  ? AHColors.navy
                                  : AHColors.grey600,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: AHSpacing.md),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── Tablet: Navigation Rail ───────────────────────────────────────
  Widget _buildTabletLayout(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _currentIndex,
            onDestinationSelected: (index) =>
                onDestinationSelected(destinations[index].path),
            destinations: destinations
                .map((d) => NavigationRailDestination(
                      icon: Icon(d.icon),
                      selectedIcon: Icon(d.selectedIcon),
                      label: Text(d.label),
                    ))
                .toList(),
            backgroundColor: Colors.white,
            indicatorColor: AHColors.navy.withOpacity(0.1),
            leading: _buildRailLeading(context, ref),
            trailing: _buildRailTrailing(context, ref),
            labelType: NavigationRailLabelType.all,
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }

  // ── Desktop: Extended Navigation Drawer ───────────────────────────
  Widget _buildDesktopLayout(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Row(
        children: [
          NavigationDrawer(
            selectedIndex: _currentIndex,
            onDestinationSelected: (index) =>
                onDestinationSelected(destinations[index].path),
            children: [
              _buildDrawerHeader(context, ref),
              ...destinations.map((d) => NavigationDrawerDestination(
                    icon: Icon(d.icon),
                    selectedIcon: Icon(d.selectedIcon),
                    label: Text(d.label),
                  )),
              const Divider(),
              NavigationDrawerDestination(
                icon: const Icon(Icons.settings_outlined),
                selectedIcon: const Icon(Icons.settings),
                label: const Text('Paramètres'),
              ),
              const Divider(),
              _buildDrawerLogoutTile(context, ref),
            ],
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }

  // ── Rail Leading/Trailing ─────────────────────────────────────────

  Widget _buildRailLeading(BuildContext context, WidgetRef ref) {
    final identity = ref.watch(schoolIdentityProvider).valueOrNull;
    final logoUrl = identity?.absoluteLogoUrl;

    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: AHSpacing.lg,
        horizontal: AHSpacing.sm,
      ),
      child: _LogoCircle(logoUrl: logoUrl, size: 36),
    );
  }

  Widget _buildRailTrailing(BuildContext context, WidgetRef ref) {
    return Expanded(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.lg),
          child: IconButton(
            icon: const Icon(Icons.logout, color: AHColors.grey400),
            onPressed: () => _showLogoutConfirmation(context),
            tooltip: 'Déconnexion',
          ),
        ),
      ),
    );
  }

  // ── Drawer Header ─────────────────────────────────────────────────

  Widget _buildDrawerHeader(BuildContext context, WidgetRef ref) {
    final identity = ref.watch(schoolIdentityProvider).valueOrNull;
    final logoUrl = identity?.absoluteLogoUrl;
    final name = identity?.schoolName ?? 'Academia Helm';
    final acronym = identity?.displayAcronym ?? 'AH';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.lg,
        AHSpacing.xl,
        AHSpacing.lg,
        AHSpacing.lg,
      ),
      child: Row(
        children: [
          _LogoCircle(logoUrl: logoUrl, size: 40),
          const SizedBox(width: AHSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AHColors.navy,
                      ),
                ),
                Text(
                  acronym,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AHColors.grey500,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Drawer Logout Tile ────────────────────────────────────────────

  Widget _buildDrawerLogoutTile(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.md,
        vertical: AHSpacing.sm,
      ),
      child: ListTile(
        leading: const Icon(Icons.logout, color: AHColors.grey500),
        title: Text(
          'Déconnexion',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AHColors.grey700,
          ),
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
        ),
        onTap: () {
          Navigator.of(context).pop();
          _showLogoutConfirmation(context);
        },
      ),
    );
  }

  // ── Logout Confirmation Dialog ────────────────────────────────────

  void _showLogoutConfirmation(BuildContext context) {
    showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Déconnexion'),
          content: const Text(
            'Êtes-vous sûr de vouloir vous déconnecter ? '
            'Vos données hors-ligne seront préservées.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AHColors.error,
                foregroundColor: Colors.white,
              ),
              child: const Text('Se déconnecter'),
            ),
          ],
        );
      },
    ).then((confirmed) {
      if (confirmed == true && context.mounted) {
        context.go('/logout');
      }
    });
  }
}

/// Circular school logo — uses real image if URL is available, falls back
/// to a gold-shielded "AH" badge.
class _LogoCircle extends StatelessWidget {
  const _LogoCircle({required this.logoUrl, required this.size});

  final String? logoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (logoUrl == null || logoUrl!.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AHColors.navy,
          borderRadius: BorderRadius.circular(size * 0.25),
        ),
        child: Icon(
          Icons.shield,
          color: AHColors.gold,
          size: size * 0.55,
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.25),
        border: Border.all(color: AHColors.gold, width: 1.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.25),
        child: CachedNetworkImage(
          imageUrl: logoUrl!,
          fit: BoxFit.cover,
          errorWidget: (context, url, error) => Container(
            color: AHColors.navy,
            child: Icon(
              Icons.shield,
              color: AHColors.gold,
              size: size * 0.55,
            ),
          ),
        ),
      ),
    );
  }
}
