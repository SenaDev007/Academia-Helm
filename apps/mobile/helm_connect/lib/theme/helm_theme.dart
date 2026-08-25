// ============================================================================
// HELM CONNECT — Flutter Mobile App Theme (V3-10)
// ============================================================================
// Identité visuelle : Royal Blue + Living Gold (Academia Helm palette)
//   Primary:      #0A2A5E (Royal Blue night)
//   Primary Mid:  #114FC4 (Royal Blue mid)
//   Primary Vivid: #1C6FE8 (Royal Blue vivid)
//   Gold:         #CFA63A (Academia Helm gold)
//   Gold Light:   #FFE08A (bright gold)
//   Background:   #F5F7FA
//   Surface:      #FFFFFF
//   Text:         #172033
//
// Dark Mode :
//   Background: #0B1220
//   Surface:    #111827
//   Primary:    #1C6FE8
//   Gold:       #F5B335
// ============================================================================

import 'package:flutter/material.dart';

class HelmColors {
  // Light theme — Academia Helm Royal Blue + Gold
  static const Color primary = Color(0xFF0A2A5E);     // Royal Blue night
  static const Color primaryMid = Color(0xFF114FC4);   // Royal Blue mid
  static const Color primaryVivid = Color(0xFF1C6FE8); // Royal Blue vivid
  static const Color gold = Color(0xFFCFA63A);         // Academia Helm gold
  static const Color goldLight = Color(0xFFFFE08A);   // Bright gold
  static const Color goldBright = Color(0xFFF5B335);   // Bright gold (alt)
  static const Color accent = Color(0xFF1C6FE8);       // Same as primaryVivid
  static const Color background = Color(0xFFF5F7FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color text = Color(0xFF172033);
  static const Color textMuted = Color(0xFF667085);

  // Dark theme
  static const Color darkPrimary = Color(0xFF1C6FE8);
  static const Color darkGold = Color(0xFFF5B335);
  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF111827);
  static const Color darkSurface2 = Color(0xFF182235);
  static const Color darkText = Color(0xFFF8FAFC);
  static const Color darkTextMuted = Color(0xFF94A3B8);

  // Functional colors
  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);

  // Bubble colors
  static const Color bubbleReceived = surface;
  static const Color bubbleSent = Color(0xFFE6F4FF);
}

/// ⭐ V3-11: Branded gradient used by AppBar / Drawer / Splash / Call screen
class HelmGradients {
  /// 3-stop Royal Blue gradient (used by AppBar, FAB, splash, call screen background)
  static const LinearGradient royalBlue = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      HelmColors.primary,    // #0A2A5E
      HelmColors.primaryMid, // #114FC4
      HelmColors.primaryVivid, // #1C6FE8
    ],
  );

  /// Top-to-bottom Royal Blue gradient (used by drawer)
  static const LinearGradient royalBlueVertical = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      HelmColors.primary,    // #0A2A5E
      HelmColors.primaryMid, // #114FC4
    ],
  );

  /// Gold gradient for accents (new discussion button ring, action buttons)
  static const LinearGradient gold = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      HelmColors.goldLight, // #FFE08A
      HelmColors.gold,      // #CFA63A
    ],
  );

  /// Sent message bubble — subtle blue tint with gold accent border
  static const LinearGradient bubbleSent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFE6F4FF),
      Color(0xFFD6EBFF),
    ],
  );
}

/// ⭐ V3-11: Branded FAB (Royal Blue + gold ring)
class HelmBrandedFab extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;

  const HelmBrandedFab({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            gradient: HelmGradients.royalBlue,
            shape: BoxShape.circle,
            border: Border.all(color: HelmColors.goldLight, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: HelmColors.primary.withOpacity(0.35),
                blurRadius: 14,
                spreadRadius: 1,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 28),
        ),
      ),
    );
  }
}

/// ⭐ V3-11: Branded section header — gradient + Helm Connect logo + gold underline
class HelmSectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? actionIcon;
  final VoidCallback? onAction;

  const HelmSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionIcon,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Image.asset('assets/icons/helm_connect.png', width: 20, height: 20, fit: BoxFit.contain),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          color: HelmColors.goldLight,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                  ],
                ),
              ),
              if (actionIcon != null)
                IconButton(
                  icon: Icon(actionIcon, color: HelmColors.goldLight, size: 22),
                  onPressed: onAction,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: 48,
            height: 3,
            decoration: BoxDecoration(
              gradient: HelmGradients.gold,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    );
  }
}

/// ⭐ V3-11: Branded empty state — Helm Connect logo + tagline
class HelmEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? ctaLabel;
  final VoidCallback? onCta;

  const HelmEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.ctaLabel,
    this.onCta,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: HelmGradients.royalBlueVertical),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon in a gold-ringed circle
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.1),
                    border: Border.all(color: HelmColors.goldLight, width: 2),
                  ),
                  child: Icon(icon, color: HelmColors.goldLight, size: 44),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: HelmColors.goldLight,
                      fontSize: 13,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
                if (ctaLabel != null && onCta != null) ...[
                  const SizedBox(height: 24),
                  GestureDetector(
                    onTap: onCta,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        gradient: HelmGradients.gold,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: HelmColors.gold.withOpacity(0.4),
                            blurRadius: 12,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.add, color: HelmColors.primary, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            ctaLabel!,
                            style: const TextStyle(
                              color: HelmColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// ⭐ V3-11: Branded send button — Royal Blue with gold ring
class HelmSendButton extends StatelessWidget {
  final VoidCallback onPressed;
  final bool disabled;
  final bool isLoading;

  const HelmSendButton({
    super.key,
    required this.onPressed,
    this.disabled = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: disabled ? null : onPressed,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          gradient: HelmGradients.royalBlue,
          shape: BoxShape.circle,
          border: Border.all(color: HelmColors.goldLight.withOpacity(0.4), width: 1.5),
          boxShadow: disabled
              ? null
              : [
                  BoxShadow(
                    color: HelmColors.primaryVivid.withOpacity(0.35),
                    blurRadius: 8,
                    spreadRadius: 0,
                  ),
                ],
        ),
        child: isLoading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Icon(
                Icons.send,
                color: disabled ? Colors.white38 : Colors.white,
                size: 20,
              ),
      ),
    );
  }
}

class HelmThemes {
  static ThemeData lightTheme() {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: HelmColors.primary,
      onPrimary: Colors.white,
      secondary: HelmColors.accent,
      onSecondary: Colors.white,
      surface: HelmColors.surface,
      onSurface: HelmColors.text,
      error: HelmColors.danger,
      onError: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: HelmColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.primary,    // Royal Blue #0A2A5E
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.primaryVivid, // #1C6FE8
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: HelmColors.primary,     // Royal Blue
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: HelmColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: HelmColors.primary, width: 2),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.surface,
      ),
    );
  }

  static ThemeData darkTheme() {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: HelmColors.darkPrimary,     // #1C6FE8
      onPrimary: Colors.white,
      secondary: HelmColors.darkGold,      // #F5B335
      onSecondary: Color(0xFF0A2A5E),
      surface: HelmColors.darkSurface,
      onSurface: HelmColors.darkText,
      error: HelmColors.danger,
      onError: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: HelmColors.darkBackground,
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.darkSurface,
        foregroundColor: HelmColors.darkText,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.darkPrimary,
        foregroundColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.darkSurface,
      ),
    );
  }
}
