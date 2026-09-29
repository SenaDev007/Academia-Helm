// ============================================================================
// GROUP CALL SCREEN — Helm Connect branded full-screen GROUP call overlay (V5)
// ============================================================================
// ⭐ V5 — câblage complet du GroupCallService (le service existait mais
//    n'était relié à AUCUN écran). Trois états, miroir du CallScreen 1-1 :
//
//   - incoming  : avatar + halo or animé + Accepter/Refuser (sonnerie Yeshua)
//   - outgoing  : avatar + halo + « Appel de groupe… » + participants attendus
//   - active    : AUDIO → grille d'avatars (connecté/en attente) ;
//                 VIDEO → grille de tuiles RTCVideoView (2 colonnes) + PiP local
//
// Signalisation REST (parité web) : start/accept/decline/end + polling statut
// 2 s — gérés dans GroupCallService. Média : mesh WebRTC pair-à-pair.
// ============================================================================
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../services/group_call_service.dart';
import '../theme/helm_theme.dart';

class GroupCallScreen extends StatefulWidget {
  const GroupCallScreen({super.key});

  @override
  State<GroupCallScreen> createState() => _GroupCallScreenState();
}

class _GroupCallScreenState extends State<GroupCallScreen>
    with TickerProviderStateMixin {
  GroupCallService get _gcs => GroupCallService.instance;

  late AnimationController _haloPingController;
  late AnimationController _haloPulseController;
  late Animation<double> _haloPingAnimation;
  late Animation<double> _haloPulseAnimation;

  @override
  void initState() {
    super.initState();
    _gcs.addListener(_onGroupCallChanged);

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
    _gcs.removeListener(_onGroupCallChanged);
    _haloPingController.dispose();
    _haloPulseController.dispose();
    super.dispose();
  }

  void _onGroupCallChanged() {
    if (!mounted) return;
    setState(() {});
    if (_gcs.state == GroupCallState.idle) {
      Navigator.of(context).maybePop();
    }
  }

  String get _formattedDuration {
    final d = _gcs.duration;
    return '${(d ~/ 60).toString().padLeft(2, '0')}:${(d % 60).toString().padLeft(2, '0')}';
  }

  String get _title =>
      _gcs.convName ?? _gcs.initiatorName ?? 'Appel de groupe';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
        child: SafeArea(
          child: Stack(
            children: [
              // ─── Grille / avatar central ───
              Positioned.fill(
                child: _gcs.isVideoCall && _gcs.isActive
                    ? _buildVideoGrid()
                    : _buildCenterBlock(),
              ),
              // ─── Barre supérieure ───
              Positioned(
                top: 16,
                left: 0,
                right: 0,
                child: _buildTopBar(),
              ),
              // ─── PiP local (vidéo entrante/sortante, pas en grille active) ───
              if (_gcs.isVideoCall && !_gcs.isActive)
                Positioned(
                  top: 70,
                  right: 16,
                  child: _buildLocalVideoPiP(),
                ),
              // ─── Contrôles ───
              Positioned(
                bottom: 32,
                left: 0,
                right: 0,
                child: _buildBottomControls(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Bloc central (incoming / outgoing / audio actif) ────────────────────
  Widget _buildCenterBlock() {
    final isIncoming = _gcs.isIncoming;
    final isOutgoing = _gcs.isOutgoing;
    final initials = _getInitials(_title);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isIncoming || isOutgoing) _buildHaloAvatar(initials) else const SizedBox(height: 24),
        if (isIncoming || isOutgoing) ...[
          const SizedBox(height: 24),
          Text(
            _title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          _buildStatusText(),
        ] else ...[
          // AUDIO actif : liste des participants (avatars)
          Expanded(child: _buildParticipantsList()),
        ],
      ],
    );
  }

  Widget _buildHaloAvatar(String initials) {
    return SizedBox(
      width: 160,
      height: 160,
      child: Stack(
        alignment: Alignment.center,
        children: [
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
                      color: HelmColors.gold,
                    ),
                  ),
                ),
              );
            },
          ),
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
                      color: HelmColors.goldLight,
                    ),
                  ),
                ),
              );
            },
          ),
          Container(
            width: 112,
            height: 112,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: _getAvatarColors(_title),
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(color: HelmColors.goldLight, width: 4),
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
    );
  }

  Widget _buildStatusText() {
    String text;
    if (_gcs.isIncoming) {
      text = 'Appel de groupe entrant';
    } else if (_gcs.isOutgoing) {
      text = 'Appel de groupe…';
    } else if (_gcs.isActive) {
      text = _formattedDuration;
    } else {
      text = '';
    }
    return Text(
      text,
      style: TextStyle(color: HelmColors.goldLight.withOpacity(0.9), fontSize: 14),
    );
  }

  // ─── Liste des participants (audio actif) ────────────────────────────────
  Widget _buildParticipantsList() {
    final participants = _gcs.participants;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 60, bottom: 8),
          child: Text(
            '${_gcs.connectedCount} connecté(s) · ${participants.length} invité(s)',
            style: TextStyle(color: HelmColors.goldLight.withOpacity(0.8), fontSize: 13),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            itemCount: participants.length,
            itemBuilder: (context, i) {
              final p = participants[i];
              return ListTile(
                leading: Stack(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: _getAvatarColors(p.name).first,
                      child: Text(
                        _getInitials(p.name),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: p.connected ? HelmColors.success : Colors.grey,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                title: Text(
                  p.name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  p.connected ? 'connecté' : 'en attente…',
                  style: TextStyle(
                    color: p.connected ? HelmColors.goldLight : Colors.white54,
                    fontSize: 12,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ─── Grille vidéo (2 colonnes, tuiles distantes) ─────────────────────────
  Widget _buildVideoGrid() {
    final participants = _gcs.participants;
    return Padding(
      padding: const EdgeInsets.only(top: 120, bottom: 130),
      child: GridView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.85,
        ),
        itemCount: participants.length,
        itemBuilder: (context, i) {
          final p = participants[i];
          // Ma propre tuile → rendu vidéo LOCAL (miroir)
          if (p.userId == _gcs.myUserId) return _buildLocalTile(p);
          return _buildRemoteTile(p);
        },
      ),
    );
  }

  Widget _buildLocalTile(GroupCallParticipant p) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: HelmColors.goldLight, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned.fill(
            child: RTCVideoView(
              _gcs.localRenderer,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
              mirror: true,
            ),
          ),
          if (_gcs.videoOff)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Icon(Icons.videocam_off, color: Colors.white70, size: 32),
              ),
            ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              color: Colors.black54,
              child: Row(
                children: [
                  Icon(
                    _gcs.muted ? Icons.mic_off : Icons.mic,
                    color: _gcs.muted ? Colors.red : HelmColors.goldLight,
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text(
                      'Vous',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRemoteTile(GroupCallParticipant p) {
    final renderer = _gcs.getRemoteRenderer(p.userId);
    final hasVideo = renderer != null;
    return Container(
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: p.connected
              ? HelmColors.goldLight.withOpacity(0.5)
              : Colors.white24,
          width: 2,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          if (hasVideo)
            Positioned.fill(
              child: RTCVideoView(
                renderer!,
                objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                mirror: false,
              ),
            ),
          if (!hasVideo)
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: _getAvatarColors(p.name).first,
                    child: Text(
                      _getInitials(p.name),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    p.connected ? 'caméra off' : 'en attente…',
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ),
            ),
          // Nom + micro badge
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              color: Colors.black54,
              child: Row(
                children: [
                  Icon(
                    p.isAudioEnabled ? Icons.mic : Icons.mic_off,
                    color: p.isAudioEnabled ? HelmColors.goldLight : Colors.red,
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      p.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Barre supérieure ─────────────────────────────────────────────────────
  Widget _buildTopBar() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.group, size: 16, color: HelmColors.goldLight),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                _title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          _gcs.isActive
              ? _formattedDuration
              : _gcs.isOutgoing
                  ? 'Appel de groupe…'
                  : 'Appel de groupe entrant',
          style: const TextStyle(color: HelmColors.goldLight, fontSize: 13),
        ),
      ],
    );
  }

  // ─── PiP local ────────────────────────────────────────────────────────────
  Widget _buildLocalVideoPiP() {
    return Container(
      width: 100,
      height: 140,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: HelmColors.goldLight.withOpacity(0.4),
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
          RTCVideoView(
            _gcs.localRenderer,
            objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            mirror: true,
          ),
          if (_gcs.videoOff)
            Container(
              color: Colors.black54,
              child: const Center(
                child: Icon(Icons.videocam_off, color: Colors.white70, size: 28),
              ),
            ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Text(
              'Vous',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: HelmColors.goldLight,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Contrôles inférieurs ────────────────────────────────────────────────
  Widget _buildBottomControls() {
    // Entrant : Accepter / Refuser
    if (_gcs.isIncoming) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildRoundButton(
            icon: Icons.phone,
            iconColor: Colors.white,
            backgroundColor: Colors.red,
            label: 'Refuser',
            iconRotation: 135,
            onTap: () => _gcs.rejectIncomingCall(),
          ),
          const SizedBox(width: 64),
          _buildRoundButton(
            icon: Icons.phone,
            iconColor: HelmColors.primary,
            backgroundColor: HelmColors.goldLight,
            label: 'Accepter',
            pulse: true,
            onTap: () => _gcs.acceptIncomingCall(),
          ),
        ],
      );
    }

    // Sortant / actif : Micro / Vidéo / HP / Raccrocher
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: HelmColors.primary.withOpacity(0.7),
        borderRadius: BorderRadius.circular(40),
        border: Border.all(color: HelmColors.goldLight.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildControlButton(
            icon: _gcs.muted ? Icons.mic_off : Icons.mic,
            label: _gcs.muted ? 'Réactiver' : 'Micro',
            active: _gcs.muted,
            onTap: _gcs.toggleMute,
          ),
          const SizedBox(width: 18),
          if (_gcs.isVideoCall) ...[
            _buildControlButton(
              icon: _gcs.videoOff ? Icons.videocam_off : Icons.videocam,
              label: _gcs.videoOff ? 'Caméra' : 'Éteindre',
              active: _gcs.videoOff,
              onTap: _gcs.toggleVideo,
            ),
            const SizedBox(width: 18),
          ],
          _buildControlButton(
            icon: Icons.volume_up,
            label: _gcs.speakerOn ? 'HP' : 'Oreille',
            active: _gcs.speakerOn,
            onTap: _gcs.toggleSpeaker,
          ),
          const SizedBox(width: 18),
          _buildHangupButton(),
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
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? Colors.white24 : Colors.white10,
              border: Border.all(
                color: active ? HelmColors.goldLight : Colors.white30,
                width: active ? 2 : 1,
              ),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
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

  Widget _buildHangupButton() {
    return GestureDetector(
      onTap: _gcs.hangup,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.red,
              boxShadow: [
                BoxShadow(color: Colors.redAccent, blurRadius: 16, spreadRadius: 1),
              ],
            ),
            child: const Icon(Icons.call_end, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 4),
          const Text(
            'Raccrocher',
            style: TextStyle(color: Colors.white70, fontSize: 10),
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
    bool pulse = false,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: backgroundColor,
              boxShadow: pulse
                  ? [
                      BoxShadow(
                        color: backgroundColor.withOpacity(0.5),
                        blurRadius: 24,
                        spreadRadius: 4,
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 12,
                      ),
                    ],
            ),
            child: Transform.rotate(
              angle: iconRotation * 3.14159265 / 180,
              child: Icon(icon, color: iconColor, size: 32),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  List<Color> _getAvatarColors(String name) {
    final hash = name.hashCode.abs();
    final hue = (hash % 360).toDouble();
    return [
      HSLColor.fromAHSL(1, hue, 0.55, 0.35).toColor(),
      HSLColor.fromAHSL(1, (hue + 40) % 360, 0.6, 0.25).toColor(),
    ];
  }
}
