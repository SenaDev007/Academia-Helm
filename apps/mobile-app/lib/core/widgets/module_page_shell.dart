/// ============================================================================
/// MODULE PAGE SHELL — Academia Hub Mobile
/// ============================================================================
///
/// Reusable shell widget for all module screens.
/// Provides the AppBar, tab bar, and tab content switching.
/// Two variants:
///   - ModulePageShell: StatelessWidget version
///   - StatefulModulePage: StatefulWidget with tab switching state
/// ============================================================================

import 'package:flutter/material.dart';
import '../enums/module_config.dart';
import '../theme/ah_colors.dart';
import '../theme/ah_spacing.dart';

// ─── ModulePageShell (Stateless) ───────────────────────────────────────────

/// A stateless shell that displays a module's content with a consistent
/// AppBar. Used for simple single-content modules.
class ModulePageShell extends StatelessWidget {
  final ModuleConfig module;
  final Widget child;
  final List<Widget>? actions;

  const ModulePageShell({
    super.key,
    required this.module,
    required this.child,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AHColors.background,
      appBar: AppBar(
        title: Text(
          module.label,
          style: const TextStyle(
            color: AHColors.navy,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        backgroundColor: AHColors.surface,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: AHColors.navy),
        actions: actions,
      ),
      body: child,
    );
  }
}

// ─── StatefulModulePage (Tabbed) ──────────────────────────────────────────

/// A stateful shell with sub-tab switching for modules with multiple views.
/// Each tab content is built by [subTabBuilder].
class StatefulModulePage extends StatefulWidget {
  final ModuleConfig module;
  final List<SubTab> visibleSubTabs;
  final String initialSubTabId;
  final Widget Function(SubTab subTab) subTabBuilder;
  final List<Widget>? actions;

  const StatefulModulePage({
    super.key,
    required this.module,
    required this.visibleSubTabs,
    required this.initialSubTabId,
    required this.subTabBuilder,
    this.actions,
  });

  @override
  State<StatefulModulePage> createState() => _StatefulModulePageState();
}

class _StatefulModulePageState extends State<StatefulModulePage>
    with SingleTickerProviderStateMixin {
  late int _currentTabIndex;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _currentTabIndex = widget.visibleSubTabs.indexWhere(
      (t) => t.id == widget.initialSubTabId,
    );
    if (_currentTabIndex < 0) _currentTabIndex = 0;
    _tabController = TabController(
      length: widget.visibleSubTabs.length,
      vsync: this,
      initialIndex: _currentTabIndex,
    );
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() => _currentTabIndex = _tabController.index);
      }
    });
  }

  @override
  void didUpdateWidget(covariant StatefulModulePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.visibleSubTabs.length != widget.visibleSubTabs.length) {
      _tabController.dispose();
      _currentTabIndex = 0;
      _tabController = TabController(
        length: widget.visibleSubTabs.length,
        vsync: this,
      );
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tabs = widget.visibleSubTabs;
    return Scaffold(
      backgroundColor: AHColors.background,
      appBar: AppBar(
        title: Text(
          widget.module.label,
          style: const TextStyle(
            color: AHColors.navy,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        backgroundColor: AHColors.surface,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: AHColors.navy),
        actions: widget.actions,
        bottom: tabs.length > 1
            ? TabBar(
                controller: _tabController,
                isScrollable: tabs.length > 4,
                labelColor: AHColors.navy,
                unselectedLabelColor: AHColors.muted,
                indicatorColor: AHColors.gold,
                indicatorWeight: AHSpacing.tabIndicatorHeight,
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                unselectedLabelStyle: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 13,
                ),
                tabAlignment: tabs.length > 4
                    ? TabAlignment.start
                    : TabAlignment.fill,
                tabs: tabs
                    .map((tab) => Tab(
                          text: tab.label,
                        ))
                    .toList(),
              )
            : null,
      ),
      body: tabs.length > 1
          ? TabBarView(
              controller: _tabController,
              children: tabs.map((tab) => widget.subTabBuilder(tab)).toList(),
            )
          : widget.subTabBuilder(tabs.first),
    );
  }
}
