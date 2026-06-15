import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/ah_theme.dart';
import '../auth/logout_state.dart';

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
/// - Phone: BottomNavigationBar
/// - Tablet: NavigationRail
/// - Desktop: NavigationDrawer (side panel)
///
/// Breakpoints:
/// - < 600: Phone (BottomNavigationBar)
/// - 600–839: Tablet (NavigationRail)
/// - ≥ 840: Desktop (NavigationDrawer / extended rail)
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

  // ── Phone: Bottom Navigation ──────────────────────────────────────
  Widget _buildPhoneLayout(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) =>
            onDestinationSelected(destinations[index].path),
        destinations: destinations
            .map((d) => NavigationDestination(
                  icon: Icon(d.icon),
                  selectedIcon: Icon(d.selectedIcon),
                  label: d.label,
                ))
            .toList(),
        backgroundColor: Colors.white,
        indicatorColor: AHColors.navy.withValues(alpha: 0.1),
        height: 64,
      ),
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
            indicatorColor: AHColors.navy.withValues(alpha: 0.1),
            leading: _buildRailLeading(context),
            trailing: _buildRailTrailing(context, ref),
            labelType: NavigationRailLabelType.all,
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }

  // ── Desktop: Extended Navigation Rail ─────────────────────────────
  Widget _buildDesktopLayout(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Row(
        children: [
          NavigationDrawer(
            selectedIndex: _currentIndex,
            onDestinationSelected: (index) =>
                onDestinationSelected(destinations[index].path),
            children: [
              _buildDrawerHeader(context),
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

  Widget _buildRailLeading(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: AHSpacing.lg,
        horizontal: AHSpacing.sm,
      ),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AHColors.navy,
              borderRadius: BorderRadius.circular(AHRadius.md),
            ),
            child: const Icon(
              Icons.shield,
              color: AHColors.gold,
              size: 20,
            ),
          ),
        ],
      ),
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

  Widget _buildDrawerHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.lg,
        AHSpacing.xl,
        AHSpacing.lg,
        AHSpacing.lg,
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AHColors.navy,
              borderRadius: BorderRadius.circular(AHRadius.md),
            ),
            child: const Icon(
              Icons.shield,
              color: AHColors.gold,
              size: 24,
            ),
          ),
          const SizedBox(width: AHSpacing.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Academia Helm',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AHColors.navy,
                    ),
              ),
              Text(
                'Gestion Scolaire',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AHColors.grey500,
                    ),
              ),
            ],
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
          // Close drawer first, then show confirmation.
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
        // Navigate to the logout screen which handles the 5-step process.
        context.go('/logout');
      }
    });
  }
}
