import 'package:flutter/material.dart';

import '../theme/ah_theme.dart';

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
class AHAdaptiveScaffold extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 840) {
          return _buildDesktopLayout(context);
        } else if (constraints.maxWidth >= 600) {
          return _buildTabletLayout(context);
        } else {
          return _buildPhoneLayout(context);
        }
      },
    );
  }

  // ── Phone: Bottom Navigation ──────────────────────────────────────
  Widget _buildPhoneLayout(BuildContext context) {
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
  Widget _buildTabletLayout(BuildContext context) {
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
            trailing: _buildRailTrailing(context),
            labelType: NavigationRailLabelType.all,
          ),
          const VerticalDivider(thickness: 1, width: 1),
          Expanded(child: child),
        ],
      ),
    );
  }

  // ── Desktop: Extended Navigation Rail ─────────────────────────────
  Widget _buildDesktopLayout(BuildContext context) {
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

  Widget _buildRailTrailing(BuildContext context) {
    return Expanded(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.only(bottom: AHSpacing.lg),
          child: IconButton(
            icon: const Icon(Icons.logout, color: AHColors.gray400),
            onPressed: () {
              // Logout handled through provider in parent
            },
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
                      color: AHColors.gray500,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
