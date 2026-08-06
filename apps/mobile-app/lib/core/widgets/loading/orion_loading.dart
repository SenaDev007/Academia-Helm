/// ============================================================================
/// ORION LOADING — Academia Hub Mobile
/// ============================================================================
///
/// OrionLoadingIndicator matching the web app:
/// - Orbital spinner + phase label (scan/analyze/report)
/// - Alert counter
/// - Linear progress bar
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';

import '../../theme/ah_colors.dart';
import 'inline_spinner.dart';

// ─── Orion Phase ─────────────────────────────────────────────────────────────

/// The phases of an Orion analysis cycle.
enum OrionPhase {
  scan('Analyse en cours', 'scan'),
  analyze('Traitement des données', 'analyze'),
  report('Génération du rapport', 'report');

  final String label;
  final String key;
  const OrionPhase(this.label, this.key);
}

// ─── Orion Loading Indicator ─────────────────────────────────────────────────

/// Loading indicator specifically for the Orion AI module.
/// Shows an orbital spinner with phase label, alert counter, and progress.
class OrionLoadingIndicator extends StatefulWidget {
  /// Progress from 0.0 to 1.0. If null, shows indeterminate.
  final double? progress;

  /// Number of active alerts.
  final int alertCount;

  /// Whether to show the phase label.
  final bool showPhaseLabel;

  /// Whether to show the alert counter.
  final bool showAlertCount;

  /// Whether to show the linear progress bar.
  final bool showProgressBar;

  /// Whether to auto-cycle through phases.
  final bool autoCyclePhases;

  const OrionLoadingIndicator({
    super.key,
    this.progress,
    this.alertCount = 0,
    this.showPhaseLabel = true,
    this.showAlertCount = true,
    this.showProgressBar = true,
    this.autoCyclePhases = true,
  });

  @override
  State<OrionLoadingIndicator> createState() => _OrionLoadingIndicatorState();
}

class _OrionLoadingIndicatorState extends State<OrionLoadingIndicator> {
  OrionPhase _currentPhase = OrionPhase.scan;
  Timer? _phaseTimer;

  @override
  void initState() {
    super.initState();
    if (widget.autoCyclePhases) {
      _startPhaseCycle();
    }
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    super.dispose();
  }

  void _startPhaseCycle() {
    _phaseTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      setState(() {
        switch (_currentPhase) {
          case OrionPhase.scan:
            _currentPhase = OrionPhase.analyze;
          case OrionPhase.analyze:
            _currentPhase = OrionPhase.report;
          case OrionPhase.report:
            _currentPhase = OrionPhase.scan;
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AHColors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header: Spinner + Phase
          Row(
            children: [
              const OrbitalSpinner(
                size: SpinnerSize.lg,
                color: SpinnerColor.gold,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Orion title
                    Row(
                      children: [
                        Icon(
                          Icons.auto_awesome,
                          size: 18,
                          color: AHColors.gold,
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'Orion IA',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AHColors.navy,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Phase label
                    if (widget.showPhaseLabel)
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: Text(
                          _currentPhase.label,
                          key: ValueKey(_currentPhase.key),
                          style: TextStyle(
                            fontSize: 13,
                            color: AHColors.mutedForeground,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Alert counter
              if (widget.showAlertCount && widget.alertCount > 0)
                _AlertBadge(count: widget.alertCount),
            ],
          ),

          // Linear progress bar
          if (widget.showProgressBar) ...[
            const SizedBox(height: 16),
            LinearProgress(
              progress: widget.progress,
              height: 4,
              color: SpinnerColor.gold,
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Alert Badge ─────────────────────────────────────────────────────────────

class _AlertBadge extends StatelessWidget {
  final int count;

  const _AlertBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: count > 3 ? AHColors.error.withOpacity(0.1) : AHColors.warning.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: count > 3 ? AHColors.error.withOpacity(0.3) : AHColors.warning.withOpacity(0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            count > 3 ? Icons.warning_amber : Icons.info_outline,
            size: 14,
            color: count > 3 ? AHColors.error : AHColors.warning,
          ),
          const SizedBox(width: 4),
          Text(
            '$count alerte${count > 1 ? 's' : ''}',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: count > 3 ? AHColors.error : AHColors.warning,
            ),
          ),
        ],
      ),
    );
  }
}
