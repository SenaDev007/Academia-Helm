import 'package:flutter/material.dart';

/// AHLogoCircle — Logo circulaire avec jeu lumineux.
///
/// Reproduit fidèlement le composant web `LogoCircle.tsx` :
/// - Halo doré pulsant subtil (pas flouté massif)
/// - Cadre circulaire blanc avec overflow hidden
/// - Logo pulsant à l'intérieur
///
/// Palette Academia Helm :
///   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
class AHLogoCircle extends StatefulWidget {
  const AHLogoCircle({
    super.key,
    this.size = 80,
    this.animated = true,
    this.logoAsset = 'assets/images/logo_academia_helm.png',
  });

  /// Taille du cercle en pixels (défaut : 80).
  final double size;

  /// Active l'animation lumineuse (défaut : true).
  final bool animated;

  /// Chemin de l'asset logo (défaut : logo Academia Helm).
  final String logoAsset;

  @override
  State<AHLogoCircle> createState() => _AHLogoCircleState();
}

class _AHLogoCircleState extends State<AHLogoCircle>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    _pulse = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    if (widget.animated) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Halo doré pulsant subtil (pas flouté massif) — matches web exactly:
    // boxShadow: 0 0 20px 4px ${GOLD}30, 0 0 40px 8px ${GOLD}10
    // GOLD30 = #F5B335 with 30/255 ≈ 12% opacity
    // GOLD10 = #F5B335 with 10/255 ≈ 4% opacity
    final halo = widget.animated
        ? AnimatedBuilder(
            animation: _pulse,
            builder: (context, _) {
              return Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF5B335).withOpacity(0.12 * _pulse.value),
                      blurRadius: 20,
                      spreadRadius: 4,
                    ),
                    BoxShadow(
                      color: const Color(0xFFF5B335).withOpacity(0.04 * _pulse.value),
                      blurRadius: 40,
                      spreadRadius: 8,
                    ),
                  ],
                ),
              );
            },
          )
        : const SizedBox.shrink();

    // Cadre circulaire blanc avec overflow hidden (matches web z-10 white circle)
    final frame = Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: widget.animated
            ? ScaleTransition(
                scale: Tween<double>(begin: 0.97, end: 1.0).animate(
                  CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
                ),
                child: Image.asset(
                  widget.logoAsset,
                  fit: BoxFit.cover,
                  width: widget.size,
                  height: widget.size,
                ),
              )
            : Image.asset(
                widget.logoAsset,
                fit: BoxFit.cover,
                width: widget.size,
                height: widget.size,
              ),
      ),
    );

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          halo,
          frame,
        ],
      ),
    );
  }
}
