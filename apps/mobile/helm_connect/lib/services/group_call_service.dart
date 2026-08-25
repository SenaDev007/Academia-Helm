// ============================================================================
// GROUP CALL SERVICE — WebRTC multi-peer mesh (V3-6)
// ============================================================================
// Implements group calls using a mesh topology: each participant establishes
// a 1-à-1 RTCPeerConnection with every other participant. Works well for up
// to 4-5 participants. Beyond that, a SFU (mediasoup/Janus) is needed.
//
// Flow:
//   1. Initiator calls startGroupCall(otherParticipants) — emits
//      group-call:invite to each one.
//   2. Each recipient receives group-call:invite and shows the incoming UI.
//   3. When a recipient accepts, they emit call:offer to the initiator (and
//      to all other already-connected participants, for a true mesh).
//   4. The initiator + all connected participants establish pairwise
//      RTCPeerConnections via call:offer/answer/ice-candidate (existing events).
//   5. Hangup / leave → group-call:leave to all participants + cleanup.
//
// Each remote peer is identified by its userId. The service maintains a
// Map<userId, RTCPeerConnection> + Map<userId, RTCVideoRenderer> for video.
// ============================================================================
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';

import 'ringtone_service.dart';
import 'socket_service.dart';

class GroupCallParticipant {
  final String userId;
  final String name;
  final String? avatarUrl;
  bool isVideoEnabled;
  bool isAudioEnabled;
  bool connected;

  GroupCallParticipant({
    required this.userId,
    required this.name,
    this.avatarUrl,
    this.isVideoEnabled = true,
    this.isAudioEnabled = true,
    this.connected = false,
  });
}

class GroupCallService extends ChangeNotifier {
  GroupCallService(this._socket);

  final SocketService _socket;
  final RingtoneService _ringtone = RingtoneService();

  // ─── State ───────────────────────────────────────────────────────────────
  bool _inCall = false;
  bool _isInitiator = false;
  String? _callId;
  String? _conversationId;
  String _callType = 'AUDIO';
  String? _myUserId;
  String? _myName;
  final Map<String, GroupCallParticipant> _participants = {};
  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, RTCVideoRenderer> _remoteRenderers = {};
  final Map<String, Map<String, dynamic>> _pendingOffers = {}; // userId → offer
  MediaStream? _localStream;
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  bool _renderersInitialized = false;
  bool _muted = false;
  bool _videoOff = false;
  bool _speakerOn = true;
  bool _isIncoming = false; // true when we received an invite
  String? _initiatorName; // for incoming calls — display name of the caller
  int _duration = 0;
  Timer? _timer;

  // ─── Getters ─────────────────────────────────────────────────────────────
  bool get inCall => _inCall;
  bool get isInitiator => _isInitiator;
  bool get isIncoming => _isIncoming;
  String? get callId => _callId;
  String? get conversationId => _conversationId;
  String get callType => _callType;
  String? get initiatorName => _initiatorName;
  List<GroupCallParticipant> get participants => _participants.values.toList();
  int get duration => _duration;
  bool get muted => _muted;
  bool get videoOff => _videoOff;
  bool get speakerOn => _speakerOn;
  RTCVideoRenderer get localRenderer => _localRenderer;
  RTCVideoRenderer? getRemoteRenderer(String userId) => _remoteRenderers[userId];

  // ─── Initialization ──────────────────────────────────────────────────────
  Future<void> _ensureRenderersInitialized() async {
    if (_renderersInitialized) return;
    await _localRenderer.initialize();
    _renderersInitialized = true;
  }

  Future<bool> _requestPermissions({required bool video}) async {
    try {
      final mic = await Permission.microphone.request();
      if (!mic.isGranted) return false;
      if (video) {
        final camera = await Permission.camera.request();
        if (!camera.isGranted) return false;
      }
      return true;
    } catch (e) {
      debugPrint('WARN: Permission request failed: $e');
      return false;
    }
  }

  Future<MediaStream> _getUserMedia({bool? video}) async {
    final videoEnabled = video ?? (_callType == 'VIDEO');
    return await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': videoEnabled
          ? {'facingMode': 'user', 'width': 640, 'height': 480}
          : false,
    });
  }

  Future<RTCPeerConnection> _createPeerConnection(String peerUserId) async {
    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'},
      ],
    });

    // Add local tracks
    if (_localStream != null) {
      _localStream!.getTracks().forEach((track) {
        pc.addTrack(track, _localStream!);
      });
    }

    // Listen for remote tracks
    pc.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        final stream = event.streams[0];
        // Get or create a renderer for this peer
        if (!_remoteRenderers.containsKey(peerUserId)) {
          final renderer = RTCVideoRenderer();
          renderer.initialize().then((_) {
            renderer.srcObject = stream;
            _remoteRenderers[peerUserId] = renderer;
            notifyListeners();
          });
        } else {
          _remoteRenderers[peerUserId]!.srcObject = stream;
        }
      }
    };

    // ICE candidate → send to peer
    pc.onIceCandidate = (candidate) {
      _socket.emit('call:ice-candidate', {
        'toUserId': peerUserId,
        'callId': _callId,
        'candidate': candidate.toMap(),
      });
    };

    pc.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected ||
          state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        _removeParticipant(peerUserId);
      }
    };

    return pc;
  }

  // ─── Outgoing group call (initiator) ───────────────────────────────────
  Future<void> startGroupCall({
    required String conversationId,
    required String myUserId,
    required String myName,
    required String callType,
    required List<({String userId, String name, String? avatarUrl})> invitees,
  }) async {
    if (_inCall) return;
    final video = callType == 'VIDEO';
    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) return;

    await _ensureRenderersInitialized();

    _myUserId = myUserId;
    _myName = myName;
    _callType = callType;
    _conversationId = conversationId;
    _isInitiator = true;
    _inCall = true;
    _callId = 'group-${DateTime.now().millisecondsSinceEpoch}';

    // Register participants
    final participantNames = <String, String>{myUserId: myName};
    for (final invitee in invitees) {
      _participants[invitee.userId] = GroupCallParticipant(
        userId: invitee.userId,
        name: invitee.name,
        avatarUrl: invitee.avatarUrl,
        connected: false,
      );
      participantNames[invitee.userId] = invitee.name;
    }
    // Add myself as a participant
    _participants[myUserId] = GroupCallParticipant(
      userId: myUserId,
      name: myName,
      connected: true,
    );

    // Get local media
    _localStream = await _getUserMedia(video: video);
    _localRenderer.srcObject = _localStream;

    // Emit group-call:invite to all invitees
    _socket.emit('group-call:invite', {
      'toUserIds': invitees.map((i) => i.userId).toList(),
      'callId': _callId,
      'callType': _callType,
      'conversationId': _conversationId,
      'callerName': _myName,
      'callerAvatarUrl': null,
      'participantNames': participantNames,
    });

    // Start ringtone for the initiator (single beep while waiting)
    _ringtone.start(mode: 'outgoing');
    _startTimer();
    notifyListeners();
  }

  // ─── Incoming group call invite (recipient) ─────────────────────────────
  void onGroupCallInvite(Map<String, dynamic> data) async {
    if (_inCall) {
      // Auto-reject — already in a call
      _socket.emit('group-call:leave', {
        'toUserIds': [data['fromUserId']],
        'callId': data['callId'],
      });
      return;
    }

    _callId = data['callId'] as String;
    _callType = data['callType'] as String;
    _conversationId = data['conversationId'] as String;
    _myUserId = await _getMyUserId();
    _isInitiator = false;
    _isIncoming = true;
    _inCall = true;
    _initiatorName = data['callerName'] as String?;

    // Register the initiator as a participant
    final initiatorId = data['fromUserId'] as String;
    _participants[initiatorId] = GroupCallParticipant(
      userId: initiatorId,
      name: (data['callerName'] as String?) ?? 'Utilisateur',
      connected: false,
    );

    // Register other participants from participantNames
    final participantNames = data['participantNames'] as Map<dynamic, dynamic>?;
    if (participantNames != null) {
      participantNames.forEach((key, value) {
        final uid = key.toString();
        if (uid != _myUserId && !_participants.containsKey(uid)) {
          _participants[uid] = GroupCallParticipant(
            userId: uid,
            name: value.toString(),
            connected: false,
          );
        }
      });
    }

    // Start ringtone for the recipient (double ring)
    _ringtone.start(mode: 'incoming');
    notifyListeners();
  }

  // ─── Accept incoming group call (recipient) ────────────────────────────
  Future<void> acceptIncomingCall() async {
    if (!_isIncoming) return;
    final video = _callType == 'VIDEO';
    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) {
      rejectIncomingCall();
      return;
    }

    await _ensureRenderersInitialized();
    _myName = await _getMyName();
    _myUserId = await _getMyUserId();

    _localStream = await _getUserMedia(video: video);
    _localRenderer.srcObject = _localStream;

    _isIncoming = false;
    _ringtone.stop();
    _startTimer();

    // For each connected participant (initially just the initiator),
    // establish a peer connection as the caller (we send the offer)
    for (final participant in _participants.values) {
      if (participant.userId != _myUserId && !participant.connected) {
        await _initiatePeerConnection(participant.userId);
      }
    }

    notifyListeners();
  }

  Future<void> _initiatePeerConnection(String peerUserId) async {
    final pc = await _createPeerConnection(peerUserId);
    _peerConnections[peerUserId] = pc;
    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    _socket.emit('call:offer', {
      'toUserId': peerUserId,
      'callId': _callId,
      'callType': _callType,
      'offer': offer.toMap(),
      'callerName': _myName,
      'callerAvatarUrl': null,
    });
  }

  // ─── Reject incoming group call (recipient) ────────────────────────────
  void rejectIncomingCall() {
    if (_participants.isNotEmpty) {
      _socket.emit('group-call:leave', {
        'toUserIds': _participants.keys.where((id) => id != _myUserId).toList(),
        'callId': _callId,
      });
    }
    _cleanup();
    notifyListeners();
  }

  // ─── Handle incoming call:offer (when another participant connects to us) ─
  Future<void> onCallOffer(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String;

    // If we don't know this participant yet, register them
    if (!_participants.containsKey(peerUserId)) {
      _participants[peerUserId] = GroupCallParticipant(
        userId: peerUserId,
        name: (data['callerName'] as String?) ?? 'Utilisateur',
        connected: false,
      );
    }

    // If we already have a peer connection with this user, just handle the offer
    if (_peerConnections.containsKey(peerUserId)) {
      final pc = _peerConnections[peerUserId]!;
      final offer = RTCSessionDescription(
        data['offer']['sdp'] as String?,
        data['offer']['type'] as String?,
      );
      await pc.setRemoteDescription(offer);
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      _socket.emit('call:answer', {
        'toUserId': peerUserId,
        'callId': _callId,
        'answer': answer.toMap(),
      });
    } else {
      // Store the offer pending — we'll process it when we accept
      _pendingOffers[peerUserId] = data;
    }
  }

  // ─── Handle call:answer (when our offer is answered) ───────────────────
  Future<void> onCallAnswer(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String;
    final pc = _peerConnections[peerUserId];
    if (pc == null) return;
    final answer = RTCSessionDescription(
      data['answer']['sdp'] as String?,
      data['answer']['type'] as String?,
    );
    await pc.setRemoteDescription(answer);
    _participants[peerUserId]?.connected = true;
    notifyListeners();
  }

  // ─── Handle ICE candidate ──────────────────────────────────────────────
  Future<void> onIceCandidate(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String;
    final pc = _peerConnections[peerUserId];
    if (pc == null) return;
    final candidateMap = data['candidate'] as Map<dynamic, dynamic>;
    final candidate = RTCIceCandidate(
      candidateMap['candidate'] as String?,
      candidateMap['sdpMid'] as String?,
      candidateMap['sdpMLineIndex'] as int?,
    );
    try {
      await pc.addCandidate(candidate);
    } catch (e) {
      debugPrint('WARN: addCandidate failed (non-blocking): $e');
    }
  }

  // ─── Handle group-call:leave (another participant left) ─────────────────
  void onGroupCallLeave(Map<String, dynamic> data) {
    if (!_inCall || data['callId'] != _callId) return;
    final leavingUserId = data['fromUserId'] as String;
    _removeParticipant(leavingUserId);

    // If the initiator left and we're a recipient, end the call
    if (!_isInitiator && leavingUserId == (_participants.keys.isNotEmpty ? _participants.keys.first : null)) {
      _cleanup();
    }
    notifyListeners();
  }

  // ─── Local controls ──────────────────────────────────────────────────────
  void toggleMute() {
    final audioTrack = _localStream?.getAudioTracks().isNotEmpty == true ? _localStream!.getAudioTracks().first : null;
    if (audioTrack != null) {
      audioTrack.enabled = !audioTrack.enabled;
      _muted = !audioTrack.enabled;
      notifyListeners();
    }
  }

  void toggleVideo() {
    final videoTrack = _localStream?.getVideoTracks().isNotEmpty == true ? _localStream!.getVideoTracks().first : null;
    if (videoTrack != null) {
      videoTrack.enabled = !videoTrack.enabled;
      _videoOff = !videoTrack.enabled;
      notifyListeners();
    }
  }

  void toggleSpeaker() {
    _speakerOn = !_speakerOn;
    notifyListeners();
  }

  /// Hang up — notify all other participants and cleanup
  void hangup() {
    if (_participants.isNotEmpty) {
      _socket.emit('group-call:leave', {
        'toUserIds': _participants.keys.where((id) => id != _myUserId).toList(),
        'callId': _callId,
      });
    }
    _cleanup();
    notifyListeners();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _duration++;
      notifyListeners();
    });
  }

  void _removeParticipant(String userId) {
    _peerConnections[userId]?.close();
    _peerConnections.remove(userId);
    _remoteRenderers[userId]?.dispose();
    _remoteRenderers.remove(userId);
    _participants.remove(userId);
    if (_participants.isEmpty && _isInitiator) {
      _cleanup();
    }
  }

  Future<String?> _getMyUserId() async {
    // Placeholder — the screen should set _myUserId before calling startGroupCall
    return _myUserId;
  }

  Future<String?> _getMyName() async {
    return _myName;
  }

  void _cleanup() {
    _timer?.cancel();
    _timer = null;
    _ringtone.stop();
    _duration = 0;
    _muted = false;
    _videoOff = false;
    _speakerOn = true;
    _inCall = false;
    _isInitiator = false;
    _isIncoming = false;
    _callId = null;
    _conversationId = null;
    _initiatorName = null;

    _peerConnections.forEach((_, pc) => pc.close());
    _peerConnections.clear();
    _remoteRenderers.forEach((_, r) => r.dispose());
    _remoteRenderers.clear();
    _participants.clear();
    _pendingOffers.clear();

    _localStream?.getTracks().forEach((t) => t.stop());
    _localStream?.dispose();
    _localStream = null;
    _localRenderer.srcObject = null;
  }

  @override
  void dispose() {
    _cleanup();
    if (_renderersInitialized) {
      _localRenderer.dispose();
      _renderersInitialized = false;
    }
    super.dispose();
  }
}
