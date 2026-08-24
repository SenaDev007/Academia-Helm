// ============================================================================
// CALL SCREEN — Helm Connect branded full-screen call overlay
// ============================================================================
// Mirrors the web WhatsAppChat.tsx call overlays with:
//   - Royal Blue gradient background (Academia Helm palette)
//   - Gold pulsing halo around the avatar (#CFA63A + #FFE08A)
//   - Animated icon badge (Phone/Video) instead of emoji
//   - Branded control bar (dark royal blue + gold border)
//
// Three states: incoming, outgoing, active.
// For VIDEO calls in 'active' state, the remote video fills the screen
// and the local video is a small PiP rectangle (bottom-right).
// ============================================================================
import 'package:flutter/material.dart';
import '../services/call_service.dart';

class CallScreen extends StatefulWidget {
  final CallService callService;

  const CallScreen({super.key, required this.callService});

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> with TickerProviderStateMixin {
  // Halo animation controllers
  late AnimationController _haloPingController;
  late AnimationController _haloPulseController;
  late Animation<double> _haloPingAnimation;
  late Animation<double> _haloPulseAnimation;

  @override
  void initState() {
    super.initState();
    widget.callService.addListener(_onCallStateChanged);

    // ⭐ V3-6: Gold halo pulsing animations — outer ring (ping) every 1.8s,
    //    middle ring (pulse) every 1.2s. Faster rhythm for a more lively feel.
    _haloPingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
    _haloPulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _haloPingAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _haloPingController, curve: Curves.easeOut),
    );
    _haloPulseAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _haloPulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    widget.callService.removeListener(_onCallStateChanged);
    _haloPingController.dispose();
    _haloPulseController.dispose();
    super.dispose();
  }

  void _onCallStateChanged() {
    if (mounted) setState(() {});
    // If the call ended, pop the screen
    if (widget.callService.state == CallState.idle) {
      Navigator.of(context).maybePop();
    }
  }

  String get _formattedDuration {
    final d = widget.callService.duration;
    return '${(d ~/ 60).toString().padLeft(2, '0')}:${(d % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final cs = widget.callService;
    final callData = cs.callData;
    if (callData == null) return const SizedBox.shrink();

    return Scaffold(
      body: Container(
        // ⭐ V3-4: Helm Connect Royal Blue gradient background
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0A2A5E), // Royal Blue night
              Color(0xFF114FC4), // Royal Blue mid
              Color(0xFF1C6FE8), // Royal Blue vivid
            ],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // ─── For VIDEO calls in 'active' state, full-screen remote video ───
              if (cs.isVideoCall && cs.state == CallState.active)
                Positioned.fill(
                  child: RTCVideoView(
                    cs.remoteRenderer,
                    objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    mirror: false,
                  ),
                ),

              // ─── Center: avatar + name + halo (for AUDIO calls or outgoing/incoming) ───
              if (!cs.isVideoCall || cs.state != CallState.active)
                Positioned.fill(
                  child: _buildCenterAvatarBlock(callData),
                ),

              // ─── Top bar: name + encrypted indicator ───
              Positioned(
                top: 16,
                left: 0,
                right: 0,
                child: _buildTopBar(callData),
              ),

              // ─── For VIDEO calls in 'active' state, local video PiP (bottom-right) ───
              if (cs.isVideoCall && cs.state == CallState.active)
                Positioned(
                  bottom: 140,
                  right: 16,
                  child: _buildLocalVideoPiP(),
                ),

              // ─── Bottom controls ───
              Positioned(
                bottom: 32,
                left: 0,
                right: 0,
                child: _buildBottomControls(callData),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Center avatar block with gold pulsing halo ──────────────────────────
  Widget _buildCenterAvatarBlock(CallData callData) {
    final cs = widget.callService;
    final isVideo = cs.isVideoCall;
    final initials = _getInitials(callData.otherUserName);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // ⭐ V3-4: Avatar with pulsing gold halo — outer ping + middle pulse
        SizedBox(
          width: 160,
          height: 160,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer ping halo (gold #CFA63A)
              AnimatedBuilder(
                animation: _haloPingAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: 1.0 + (_haloPingAnimation.value * 0.25),
                    child: Opacity(
                      opacity: (1.0 - _haloPingAnimation.value) * 0.4,
                      child: Container(
                        width: 130,
                        height: 130,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFCFA63A), // Academia Helm gold
                        ),
                      ),
                    ),
                  );
                },
              ),
              // Middle pulse halo (gold #FFE08A)
              AnimatedBuilder(
                animation: _haloPulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: 1.0 + ((_haloPulseAnimation.value - 0.3) * 0.2),
                    child: Opacity(
                      opacity: _haloPulseAnimation.value,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFFFE08A), // Academia Helm bright gold
                        ),
                      ),
                    ),
                  );
                },
              ),
              // Avatar circle (colored by name hash) with gold ring
              Container(
                width: 112,
                height: 112,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: _getAvatarColors(callData.otherUserName),
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(color: const Color(0xFFFFE08A), width: 4),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.4),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // Name
        Text(
          callData.otherUserName,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        // Status text (outgoing / duration / incoming label)
        _buildStatusText(),
        const SizedBox(height: 16),
        // ⭐ V3-4: Animated icon badge (replaces 📞/📹 emoji)
        _buildAnimatedIconBadge(isVideo),
      ],
    );
  }

  Widget _buildStatusText() {
    final cs = widget.callService;
    String text;
    Color color = const Color(0xFFFFE08A).withOpacity(0.9);

    if (cs.state == CallState.incoming) {
      text = 'Appel entrant';
    } else if (cs.state == CallState.outgoing) {
      text = 'Appel en cours…';
    } else if (cs.state == CallState.active) {
      text = _formattedDuration;
    } else {
      text = '';
    }

    return Text(
      text,
      style: TextStyle(color: color, fontSize: 14),
    );
  }

  // ─── Animated icon badge (Phone / Video lucide-equivalent) ──────────────
  Widget _buildAnimatedIconBadge(bool isVideo) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFE08A).withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Animated ping icon background
          SizedBox(
            width: 28,
            height: 28,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Outer ping (gold pulsing)
                AnimatedBuilder(
                  animation: _haloPingAnimation,
                  builder: (context, child) {
                    return Opacity(
                      opacity: (1.0 - _haloPingAnimation.value) * 0.5,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFFFE08A),
                        ),
                      ),
                    );
                  },
                ),
                // Inner solid icon
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFFFFE08A),
                  ),
                  child: Icon(
                    isVideo ? Icons.videocam : Icons.phone,
                    color: const Color(0xFF0A2A5E),
                    size: 16,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            isVideo ? 'Appel vidéo' : 'Appel audio',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '— Helm Connect',
            style: TextStyle(
              color: const Color(0xFFFFE08A).withOpacity(0.7),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Top bar (name + encrypted indicator) ─────────────────────────────────
  Widget _buildTopBar(CallData callData) {
    final cs = widget.callService;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              callData.otherUserName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (cs.state == CallState.active) ...[
              const SizedBox(width: 8),
              const Icon(Icons.lock, size: 12, color: Color(0xFFFFE08A)),
              const SizedBox(width: 4),
              const Text(
                'Chiffré de bout en bout',
                style: TextStyle(color: Color(0xFFFFE08A), fontSize: 12),
              ),
            ],
          ],
        ),
        // For VIDEO active state, show the duration here (since the avatar block is hidden)
        if (cs.isVideoCall && cs.state == CallState.active)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _formattedDuration,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  // ─── Local video PiP (for VIDEO calls in 'active' state) ───────────────────
  Widget _buildLocalVideoPiP() {
    final cs = widget.callService;
    return Container(
      width: 140,
      height: 200,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFFFE08A).withOpacity(0.4),
          width: 2.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 12,
            spreadRadius: 1,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // ⭐ FIX: Local camera preview — RTCVideoView mirrored (selfie)
          RTCVideoView(
            cs.localRenderer,
            objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            mirror: true,
          ),
          if (cs.videoOff)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Icon(Icons.videocam_off, color: Colors.white70, size: 32),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Bottom controls (branded pill) ───────────────────────────────────────
  Widget _buildBottomControls(CallData callData) {
    final cs = widget.callService;

    // Incoming call: only Accept + Reject
    if (cs.state == CallState.incoming) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Reject
          _buildRoundButton(
            icon: Icons.phone,
            iconColor: Colors.white,
            backgroundColor: Colors.red,
            label: 'Refuser',
            iconRotation: 135,
            onTap: () => cs.rejectIncomingCall(),
          ),
          const SizedBox(width: 64),
          // Accept
          _buildRoundButton(
            icon: Icons.phone,
            iconColor: const Color(0xFF0A2A5E),
            backgroundColor: const Color(0xFFFFE08A),
            label: 'Accepter',
            pulse: true,
            onTap: () => cs.acceptIncomingCall(),
          ),
        ],
      );
    }

    // Outgoing / active: Mute / Video (if video) / Speaker / Hangup
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0A2A5E).withOpacity(0.7),
        borderRadius: BorderRadius.circular(40),
        border: Border.all(
          color: const Color(0xFFFFE08A).withOpacity(0.2),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Mute
          _buildControlButton(
            icon: cs.muted ? Icons.mic_off : Icons.mic,
            label: cs.muted ? 'Activer' : 'Micro',
            active: cs.muted,
            onTap: cs.toggleMute,
          ),
          if (cs.isVideoCall && cs.state == CallState.active) ...[
            const SizedBox(width: 8),
            _buildControlButton(
              icon: cs.videoOff ? Icons.videocam_off : Icons.videocam,
              label: cs.videoOff ? 'Caméra' : 'Vidéo',
              active: cs.videoOff,
              onTap: cs.toggleVideo,
            ),
          ],
          const SizedBox(width: 8),
          // Speaker
          _buildControlButton(
            icon: Icons.volume_up,
            label: cs.speakerOn ? 'Haut-parleur' : 'Muet',
            active: !cs.speakerOn,
            onTap: cs.toggleSpeaker,
          ),
          const SizedBox(width: 8),
          // Hangup
          _buildRoundButton(
            icon: Icons.phone,
            iconColor: Colors.white,
            backgroundColor: Colors.red,
            label: 'Terminer',
            iconRotation: 135,
            size: 56,
            onTap: () => cs.hangup(),
          ),
        ],
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? const Color(0xFFFFE08A) : Colors.white.withOpacity(0.2),
            ),
            child: Icon(
              icon,
              color: active ? const Color(0xFF0A2A5E) : Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 10),
          ),
        ],
      ),
    );
  }

  Widget _buildRoundButton({
    required IconData icon,
    required Color iconColor,
    required Color backgroundColor,
    required String label,
    double iconRotation = 0,
    double size = 64,
    bool pulse = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: backgroundColor,
              boxShadow: [
                BoxShadow(
                  color: backgroundColor.withOpacity(0.4),
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: pulse
                ? AnimatedBuilder(
                    animation: _haloPulseAnimation,
                    builder: (context, child) {
                      return Opacity(
                        opacity: 0.7 + (_haloPulseAnimation.value * 0.3),
                        child: Transform.rotate(
                          angle: iconRotation * 3.14159 / 180,
                          child: Icon(icon, color: iconColor, size: 28),
                        ),
                      );
                    },
                  )
                : Transform.rotate(
                    angle: iconRotation * 3.14159 / 180,
                    child: Icon(icon, color: iconColor, size: 28),
                  ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
        ],
      ),
    );
  }

  // ─── Avatar helpers ──────────────────────────────────────────────────────
  String _getInitials(String name) {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return '?';
  }

  List<Color> _getAvatarColors(String name) {
    const palettes = [
      [Color(0xFF3B9EFF), Color(0xFF0958D9)],
      [Color(0xFF8B5CF6), Color(0xFF6366F1)],
      [Color(0xFFEC4899), Color(0xFFBE185D)],
      [Color(0xFF10B981), Color(0xFF047857)],
      [Color(0xFFF59E0B), Color(0xFFB45309)],
      [Color(0xFF06B6D4), Color(0xFF0E7490)],
    ];
    final hash = name.codeUnits.fold(0, (a, c) => a + c);
    return palettes[hash % palettes.length];
  }
}
