// ============================================================================
// CALL SERVICE — WebRTC calls (audio + video) for Helm Connect mobile
// ============================================================================
// Mirrors the web WhatsAppChat.tsx WebRTC logic:
//   1. getUserMedia (audio + optional video)
//   2. RTCPeerConnection with STUN servers
//   3. SDP offer/answer exchange via Socket.io (call:offer / call:answer)
//   4. ICE candidate exchange via call:ice-candidate
//   5. Teardown on call:reject / call:hangup / connection state change
//
// ⭐ Branding: the CallScreen uses Academia Helm Royal Blue + gold halo.
// ============================================================================
import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';

import '../services/socket_service.dart';
// ⭐ V3-6: Soft phone ringtone (audioplayers, two distinct tones for caller/callee)
import 'ringtone_service.dart';

/// State of the call lifecycle.
enum CallState { idle, outgoing, incoming, active }

/// Data passed around during a call.
class CallData {
  final String callId;
  final String callType; // 'AUDIO' | 'VIDEO'
  final String otherUserId;
  final String otherUserName;
  final String? otherUserAvatarUrl;
  final String? callerName; // for incoming calls — display name of the caller
  final String? callerAvatarUrl;

  const CallData({
    required this.callId,
    required this.callType,
    required this.otherUserId,
    required this.otherUserName,
    this.otherUserAvatarUrl,
    this.callerName,
    this.callerAvatarUrl,
  });
}

class CallService extends ChangeNotifier {
  CallService(this._socket);

  final SocketService _socket;
  // ⭐ V3-6: Soft phone ringtone (singleton)
  final RingtoneService _ringtone = RingtoneService();

  // ─── State ───────────────────────────────────────────────────────────────
  CallState _state = CallState.idle;
  CallData? _callData;
  int _duration = 0;
  bool _muted = false;
  bool _videoOff = false;
  bool _speakerOn = true;
  Timer? _timer;

  // ─── WebRTC ──────────────────────────────────────────────────────────────
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  bool _renderersInitialized = false;

  // Pending offer received before the user clicks "Accept"
  Map<String, dynamic>? _pendingOffer;

  // ─── Getters ─────────────────────────────────────────────────────────────
  CallState get state => _state;
  CallData? get callData => _callData;
  int get duration => _duration;
  bool get muted => _muted;
  bool get videoOff => _videoOff;
  bool get speakerOn => _speakerOn;
  RTCVideoRenderer get localRenderer => _localRenderer;
  RTCVideoRenderer get remoteRenderer => _remoteRenderer;
  bool get isVideoCall => _callData?.callType == 'VIDEO';

  // ─── Initialization ──────────────────────────────────────────────────────
  Future<void> _ensureRenderersInitialized() async {
    if (_renderersInitialized) return;
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
    _renderersInitialized = true;
  }

  /// Request the required runtime permissions (RECORD_AUDIO + CAMERA for video).
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
      debugPrint('⚠️ Permission request failed: $e');
      return false;
    }
  }

  // ─── Outgoing call ───────────────────────────────────────────────────────
  /// Start an outgoing call (caller side).
  /// [otherUserId] is the callee's user id.
  /// [otherUserName] is the display name shown in the UI.
  Future<void> startCall({
    required String otherUserId,
    required String otherUserName,
    required String callType, // 'AUDIO' | 'VIDEO'
    required String myName,
    String? myAvatarUrl,
  }) async {
    if (_state != CallState.idle) {
      debugPrint('⚠️ Already in a call — ignoring startCall');
      return;
    }

    final video = callType == 'VIDEO';
    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) {
      debugPrint('⚠️ Permissions denied — cannot start call');
      notifyListeners();
      return;
    }

    await _ensureRenderersInitialized();

    try {
      // 1. Get local media
      final localStream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': video
            ? {
                'facingMode': 'user',
                'width': 640,
                'height': 480,
              }
            : false,
      });
      _localStream = localStream;
      _localRenderer.srcObject = localStream;

      // 2. Create peer connection
      final pc = await createPeerConnection({
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
          {'urls': 'stun:stun1.l.google.com:19302'},
        ],
      });
      _peerConnection = pc;

      // 3. Add local tracks
      localStream.getTracks().forEach((track) {
        pc.addTrack(track, localStream);
      });

      // 4. Listen for remote tracks
      pc.onTrack = (event) {
        if (event.streams.isNotEmpty) {
          _remoteStream = event.streams[0];
          _remoteRenderer.srcObject = _remoteStream;
        }
      };

      // 5. ICE candidate → send to remote peer via Socket.io
      pc.onIceCandidate = (candidate) {
        _socket.emit('call:ice-candidate', {
          'toUserId': otherUserId,
          'callId': _callData?.callId,
          'candidate': candidate.toMap(),
        });
      };

      // 6. Connection state changes
      pc.onConnectionState = (state) {
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
          hangup();
        }
      };

      // 7. Create offer + set local description
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Generate a callId (UUID-ish)
      final callId = DateTime.now().millisecondsSinceEpoch.toString();

      // 9. Update state before emitting (so the UI shows "outgoing" immediately)
      _callData = CallData(
        callId: callId,
        callType: callType,
        otherUserId: otherUserId,
        otherUserName: otherUserName,
      );
      _state = CallState.outgoing;
      notifyListeners();
      // ⭐ V3-6: Start the outgoing ringtone (single gentle beep every 2s)
      _ringtone.start(mode: 'outgoing');

      // 10. Emit call:offer with callerName + avatar (parity with web)
      _socket.emit('call:offer', {
        'toUserId': otherUserId,
        'callId': callId,
        'callType': callType,
        'offer': offer.toMap(),
        'callerName': myName,
        'callerAvatarUrl': myAvatarUrl,
      });
    } catch (e) {
      debugPrint('❌ startCall failed: $e');
      await _cleanup();
      notifyListeners();
    }
  }

  // ─── Incoming call ───────────────────────────────────────────────────────
  /// Called when a `call:offer` event arrives from the socket.
  /// Stores the offer for later use when the user clicks Accept.
  void onIncomingCallOffer(Map<String, dynamic> data) {
    if (_state != CallState.idle) {
      // Already in a call — auto-reject
      _socket.emit('call:reject', {
        'toUserId': data['fromUserId'],
        'callId': data['callId'],
      });
      return;
    }

    _pendingOffer = data;
    _callData = CallData(
      callId: data['callId'] as String,
      callType: data['callType'] as String,
      otherUserId: data['fromUserId'] as String,
      otherUserName: (data['callerName'] as String?) ?? 'Utilisateur',
      callerName: data['callerName'] as String?,
      callerAvatarUrl: data['callerAvatarUrl'] as String?,
    );
    _state = CallState.incoming;
    notifyListeners();
    // ⭐ V3-6: Start the incoming ringtone (double C5+E5 chord every 3s)
    _ringtone.start(mode: 'incoming');
  }

  /// Accept an incoming call (callee side).
  Future<void> acceptIncomingCall() async {
    if (_state != CallState.incoming || _pendingOffer == null) return;
    final data = _pendingOffer!;
    final video = (data['callType'] as String?) == 'VIDEO';

    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) {
      rejectIncomingCall();
      return;
    }

    await _ensureRenderersInitialized();

    try {
      // 1. Get local media
      final localStream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': video
            ? {
                'facingMode': 'user',
                'width': 640,
                'height': 480,
              }
            : false,
      });
      _localStream = localStream;
      _localRenderer.srcObject = localStream;

      // 2. Create peer connection
      final pc = await createPeerConnection({
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
          {'urls': 'stun:stun1.l.google.com:19302'},
        ],
      });
      _peerConnection = pc;

      // 3. Add local tracks
      localStream.getTracks().forEach((track) {
        pc.addTrack(track, localStream);
      });

      // 4. Listen for remote tracks
      pc.onTrack = (event) {
        if (event.streams.isNotEmpty) {
          _remoteStream = event.streams[0];
          _remoteRenderer.srcObject = _remoteStream;
        }
      };

      // 5. ICE candidate → send back to caller
      pc.onIceCandidate = (candidate) {
        _socket.emit('call:ice-candidate', {
          'toUserId': _callData?.otherUserId,
          'callId': _callData?.callId,
          'candidate': candidate.toMap(),
        });
      };

      // 6. Connection state changes
      pc.onConnectionState = (state) {
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected ||
            state == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
          hangup();
        }
      };

      // 7. Set remote description (the offer from the caller)
      final offer = RTCSessionDescription(
        data['offer']['sdp'] as String?,
        data['offer']['type'] as String?,
      );
      await pc.setRemoteDescription(offer);

      // 8. Create answer + set local description
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 9. Send answer back to caller
      _socket.emit('call:answer', {
        'toUserId': _callData?.otherUserId,
        'callId': _callData?.callId,
        'answer': answer.toMap(),
      });

      _state = CallState.active;
      _startTimer();
      _pendingOffer = null;
      notifyListeners();
      // ⭐ V3-6: Stop the ringtone when the call becomes active
      _ringtone.stop();
    } catch (e) {
      debugPrint('❌ acceptIncomingCall failed: $e');
      await _cleanup();
      notifyListeners();
    }
  }

  /// Reject an incoming call (callee side).
  void rejectIncomingCall() {
    if (_callData != null) {
      _socket.emit('call:reject', {
        'toUserId': _callData!.otherUserId,
        'callId': _callData!.callId,
      });
    }
    _cleanup();
    notifyListeners();
  }

  // ─── Remote events ───────────────────────────────────────────────────────
  /// Called when `call:answer` arrives (caller side) — the callee accepted.
  Future<void> onCallAnswer(Map<String, dynamic> data) async {
    if (_peerConnection == null || _callData?.callId != data['callId']) return;
    try {
      final answer = RTCSessionDescription(
        data['answer']['sdp'] as String?,
        data['answer']['type'] as String?,
      );
      await _peerConnection!.setRemoteDescription(answer);
      _state = CallState.active;
      _startTimer();
      notifyListeners();
      // ⭐ V3-6: Stop the ringtone when the call becomes active (caller side)
      _ringtone.stop();
    } catch (e) {
      debugPrint('❌ onCallAnswer failed: $e');
    }
  }

  /// Called when `call:ice-candidate` arrives.
  Future<void> onIceCandidate(Map<String, dynamic> data) async {
    if (_peerConnection == null || _callData?.callId != data['callId']) return;
    try {
      final candidateMap = data['candidate'] as Map<dynamic, dynamic>;
      final candidate = RTCIceCandidate(
        candidateMap['candidate'] as String?,
        candidateMap['sdpMid'] as String?,
        candidateMap['sdpMLineIndex'] as int?,
      );
      await _peerConnection!.addCandidate(candidate);
    } catch (e) {
      debugPrint('⚠️ onIceCandidate failed (non-blocking): $e');
    }
  }

  /// Called when `call:reject` arrives — the callee declined.
  void onCallReject() {
    _cleanup();
    notifyListeners();
  }

  /// Called when `call:hangup` arrives — the other side ended the call.
  void onCallHangup() {
    _cleanup();
    notifyListeners();
  }

  // ─── Local controls ──────────────────────────────────────────────────────
  /// Hang up (either side).
  void hangup() {
    if (_callData != null && _state != CallState.idle) {
      _socket.emit('call:hangup', {
        'toUserId': _callData!.otherUserId,
        'callId': _callData!.callId,
      });
    }
    _cleanup();
    notifyListeners();
  }

  /// Toggle microphone mute.
  void toggleMute() {
    final audioTrack = _localStream?.getAudioTracks().isNotEmpty == true ? _localStream!.getAudioTracks().first : null;
    if (audioTrack != null) {
      audioTrack.enabled = !audioTrack.enabled;
      _muted = !audioTrack.enabled;
      notifyListeners();
    }
  }

  /// Toggle camera on/off (video calls only).
  void toggleVideo() {
    final videoTrack = _localStream?.getVideoTracks().isNotEmpty == true ? _localStream!.getVideoTracks().first : null;
    if (videoTrack != null) {
      videoTrack.enabled = !videoTrack.enabled;
      _videoOff = !videoTrack.enabled;
      notifyListeners();
    }
  }

  /// Toggle speaker (audio routing). On mobile, this is handled by the OS
  /// audio routing; we just toggle a flag for the UI.
  void toggleSpeaker() {
    _speakerOn = !_speakerOn;
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

  Future<void> _cleanup() async {
    _timer?.cancel();
    _timer = null;
    _duration = 0;
    _muted = false;
    _videoOff = false;
    _speakerOn = true;
    _state = CallState.idle;
    _callData = null;
    _pendingOffer = null;
    // ⭐ V3-6: Stop the ringtone on cleanup (call ended or rejected)
    _ringtone.stop();

    if (_peerConnection != null) {
      try {
        await _peerConnection!.close();
      } catch (_) {}
      _peerConnection = null;
    }
    if (_localStream != null) {
      _localStream!.getTracks().forEach((t) => t.stop());
      _localStream!.dispose();
      _localStream = null;
    }
    if (_remoteStream != null) {
      _remoteStream!.getTracks().forEach((t) => t.stop());
      _remoteStream!.dispose();
      _remoteStream = null;
    }
    _localRenderer.srcObject = null;
    _remoteRenderer.srcObject = null;
  }

  /// Dispose the service (called when the screen is destroyed).
  @override
  void dispose() {
    _cleanup();
    if (_renderersInitialized) {
      _localRenderer.dispose();
      _remoteRenderer.dispose();
      _renderersInitialized = false;
    }
    super.dispose();
  }
}
