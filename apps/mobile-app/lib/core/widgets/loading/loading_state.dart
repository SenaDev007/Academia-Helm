/// ============================================================================
/// LOADING STATE — Academia Hub Mobile
/// ============================================================================
///
/// LoadingState widget matching the web app:
/// - 6 variants: default, orion, sara, compact, linear, wave
/// - RotatingMessage that cycles through contextual messages every 3 seconds
/// - Full-screen or inline modes
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';

import '../../loading/loading_messages.dart';
import '../../theme/ah_colors.dart';
import 'inline_spinner.dart';
import 'orion_loading.dart';
import 'skeleton.dart';

// ─── Loading Variant ─────────────────────────────────────────────────────────

/// The visual variant of the loading indicator.
enum LoadingVariant {
  /// Default orbital spinner with message.
  default_,

  /// Orion-themed loading with phase labels.
  orion,

  /// SARA assistant-themed loading.
  sara,

  /// Compact inline spinner with small text.
  compact,

  /// Linear progress bar only.
  linear,

  /// Wave/shimmer animation.
  wave,
}

// ─── Loading Mode ────────────────────────────────────────────────────────────

/// Display mode for the loading state.
enum LoadingMode {
  /// Full-screen overlay.
  fullscreen,

  /// Inline within existing layout.
  inline,
}

// ─── Rotating Message ────────────────────────────────────────────────────────

/// A widget that cycles through contextual messages every 3 seconds.
class RotatingMessage extends StatefulWidget {
  final List<MessageEntry> messages;
  final TextStyle? titleStyle;
  final TextStyle? subtitleStyle;
  final Duration rotationInterval;
  final CrossAxisAlignment alignment;

  const RotatingMessage({
    super.key,
    required this.messages,
    this.titleStyle,
    this.subtitleStyle,
    this.rotationInterval = const Duration(seconds: 3),
    this.alignment = CrossAxisAlignment.center,
  });

  @override
  State<RotatingMessage> createState() => _RotatingMessageState();
}

class _RotatingMessageState extends State<RotatingMessage> {
  int _currentIndex = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startRotation();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startRotation() {
    if (widget.messages.length <= 1) return;
    _timer = Timer.periodic(widget.rotationInterval, (_) {
      if (!mounted) return;
      setState(() {
        _currentIndex = (_currentIndex + 1) % widget.messages.length;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.messages.isEmpty) return const SizedBox.shrink();

    final message = widget.messages[_currentIndex % widget.messages.length];

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 400),
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.1),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: Column(
        key: ValueKey('msg_$_currentIndex'),
        crossAxisAlignment: widget.alignment,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            message.title,
            style: widget.titleStyle ??
                const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AHColors.textPrimary,
                ),
          ),
          if (message.subtitle.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              message.subtitle,
              style: widget.subtitleStyle ??
                  TextStyle(
                    fontSize: 13,
                    color: AHColors.textSecondary,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Message Entry ───────────────────────────────────────────────────────────

/// A title + subtitle pair for rotating messages.
class MessageEntry {
  final String title;
  final String subtitle;

  const MessageEntry(this.title, this.subtitle);
}

// ─── Loading State Widget ────────────────────────────────────────────────────

/// Versatile loading state widget with multiple variants.
///
/// Usage:
/// ```dart
/// LoadingState(
///   variant: LoadingVariant.orion,
///   mode: LoadingMode.fullscreen,
///   context: LoadingContext.postLogin,
/// )
/// ```
class LoadingState extends StatefulWidget {
  /// Visual variant of the loading indicator.
  final LoadingVariant variant;

  /// Display mode (fullscreen or inline).
  final LoadingMode mode;

  /// Loading context for contextual messages.
  final LoadingContext? context;

  /// Custom messages (overrides context-based messages).
  final List<MessageEntry>? messages;

  /// Progress from 0.0 to 1.0 (for linear variant).
  final double? progress;

  /// Alert count (for orion variant).
  final int alertCount;

  /// Inline spinner color.
  final SpinnerColor spinnerColor;

  /// Inline spinner size.
  final SpinnerSize spinnerSize;

  const LoadingState({
    super.key,
    this.variant = LoadingVariant.default_,
    this.mode = LoadingMode.inline,
    this.context,
    this.messages,
    this.progress,
    this.alertCount = 0,
    this.spinnerColor = SpinnerColor.navy,
    this.spinnerSize = SpinnerSize.md,
  });

  @override
  State<LoadingState> createState() => _LoadingStateState();
}

class _LoadingStateState extends State<LoadingState> {
  List<MessageEntry> _messages = [];

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void didUpdateWidget(LoadingState oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.context != widget.context ||
        oldWidget.messages != widget.messages) {
      _loadMessages();
    }
  }

  void _loadMessages() {
    if (widget.messages != null) {
      _messages = widget.messages!;
    } else if (widget.context != null) {
      _messages = getContextualMessages(widget.context!);
    } else {
      _messages = const [
        MessageEntry('Chargement', 'Veuillez patienter...'),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = _buildVariant();

    if (widget.mode == LoadingMode.fullscreen) {
      return _buildFullscreen(content);
    }
    return content;
  }

  Widget _buildVariant() {
    switch (widget.variant) {
      case LoadingVariant.default_:
        return _buildDefault();
      case LoadingVariant.orion:
        return _buildOrion();
      case LoadingVariant.sara:
        return _buildSara();
      case LoadingVariant.compact:
        return _buildCompact();
      case LoadingVariant.linear:
        return _buildLinear();
      case LoadingVariant.wave:
        return _buildWave();
    }
  }

  Widget _buildDefault() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        OrbitalSpinner(
          size: widget.spinnerSize,
          color: widget.spinnerColor,
        ),
        const SizedBox(height: 16),
        RotatingMessage(
          messages: _messages,
          alignment: CrossAxisAlignment.center,
        ),
      ],
    );
  }

  Widget _buildOrion() {
    return OrionLoadingIndicator(
      progress: widget.progress,
      alertCount: widget.alertCount,
      showPhaseLabel: true,
      showProgressBar: true,
      autoCyclePhases: true,
    );
  }

  Widget _buildSara() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AHColors.navy.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AHColors.navy.withOpacity(0.1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // SARA avatar with pulse
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [AHColors.navy, AHColors.blue],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.2),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Center(
              child: Text(
                'S',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'SARA',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AHColors.navy,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Assistant intelligent',
            style: TextStyle(
              fontSize: 12,
              color: AHColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 12),
          RotatingMessage(
            messages: _messages.isNotEmpty
                ? _messages
                : const [
                    MessageEntry(
                      'Je prépare votre réponse...',
                      'Analyse en cours',
                    ),
                  ],
            titleStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AHColors.navy,
            ),
            subtitleStyle: TextStyle(
              fontSize: 12,
              color: AHColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompact() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        OrbitalSpinner(
          size: SpinnerSize.sm,
          color: widget.spinnerColor,
        ),
        const SizedBox(width: 8),
        if (_messages.isNotEmpty)
          Flexible(
            child: Text(
              _messages.first.title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: widget.spinnerColor.value,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
    );
  }

  Widget _buildLinear() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_messages.isNotEmpty) ...[
          RotatingMessage(
            messages: _messages,
            alignment: CrossAxisAlignment.start,
            titleStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AHColors.textPrimary,
            ),
            subtitleStyle: TextStyle(
              fontSize: 11,
              color: AHColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 8),
        ],
        LinearProgress(
          progress: widget.progress,
          height: 3,
          color: widget.spinnerColor,
        ),
      ],
    );
  }

  Widget _buildWave() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Shimmer wave placeholder
        ShimmerEffect(
          child: Container(
            width: 200,
            height: 8,
            decoration: BoxDecoration(
              color: AHColors.shimmerBase,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        const SizedBox(height: 12),
        RotatingMessage(
          messages: _messages,
          alignment: CrossAxisAlignment.center,
        ),
      ],
    );
  }

  Widget _buildFullscreen(Widget content) {
    return Container(
      color: AHColors.background,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: content,
        ),
      ),
    );
  }
}
