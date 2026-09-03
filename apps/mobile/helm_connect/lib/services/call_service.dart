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

import '../services/api_service.dart';
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
  // ⭐ V5 — SINGLETON partagé (comme SocketService/GroupCallService) : les
  //    appels 1-1 entrants fonctionnent depuis N'IMPORTE QUEL écran, pas
  //    seulement depuis ConversationDetailScreen de la conversation.
  static final CallService instance = CallService._internal(SocketService());
  CallService._internal(this._socket);

  /// Ancien constructeur public (compat) — retourne le singleton.
  factory CallService(SocketService socket) => instance;

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

  // ⭐ V5 — signalisation REST (parité web V4) : le callId vient du serveur
  //    (POST /chat/calls/signal) → accept/decline/end passent aussi par REST
  //    + polling de statut 2 s pour détecter refus/manqué/annulé côté distant.
  bool _restSignaled = false;
  String? _conversationId;
  Timer? _statusPollTimer;
  final Set<String> _declinedCallIds = {};

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
      debugPrint('WARN: Permission request failed: $e');
      return false;
    }
  }

  // ─── Outgoing call ───────────────────────────────────────────────────────
  /// Start an outgoing call (caller side).
  /// [otherUserId] is the callee's user id.
  /// [otherUserName] is the display name shown in the UI.
  /// ⭐ V5 : [conversationId] active la signalisation REST (création du
  ///    signal côté serveur → sonnerie instantanée du destinataire via
  ///    call:incoming + polling + push FCM, comme le web V4).
  Future<void> startCall({
    required String otherUserId,
    required String otherUserName,
    required String callType, // 'AUDIO' | 'VIDEO'
    required String myName,
    String? myAvatarUrl,
    String? conversationId,
  }) async {
    if (_state != CallState.idle) {
      debugPrint('WARN: Already in a call — ignoring startCall');
      return;
    }

    final video = callType == 'VIDEO';
    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) {
      debugPrint('WARN: Permissions denied — cannot start call');
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

      // 8. Générer un callId :
      //    ⭐ V5 — signalisation REST : POST /chat/calls/signal {start}
      //    crée le signal côté serveur (sonnerie instantanée + polling + push
      //    du destinataire) et renvoie le VRAI callId. En cas d'échec REST,
      //    repli sur l'ancien id local (mesh pur, compatibilité V3).
      var callId = DateTime.now().millisecondsSinceEpoch.toString();
      _restSignaled = false;
      _conversationId = conversationId;
      if (conversationId != null) {
        try {
          final sig = await ApiService.startCallSignal(
            conversationId: conversationId,
            type: callType == 'VIDEO' ? 'video' : 'audio',
          );
          final serverCallId = sig['callId'];
          if (serverCallId is String && serverCallId.isNotEmpty) {
            callId = serverCallId;
            _restSignaled = true;
          }
        } catch (e) {
          debugPrint('WARN: REST signal start failed (mesh pur) : $e');
        }
      }

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
      // ⭐ V5 — polling de statut (2 s) : détecte refus/manqué/annulé distant
      _startStatusPolling();

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
      debugPrint('ERROR: startCall failed: $e');
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
    // ⭐ V5 — appels déjà refusés localement : ne jamais re-sonner
    final callId = data['callId'] as String?;
    if (callId != null && _declinedCallIds.contains(callId)) {
      _socket.emit('call:reject', {
        'toUserId': data['fromUserId'],
        'callId': callId,
      });
      return;
    }

    _pendingOffer = data;
    _restSignaled = callId != null && callId.contains('-') && callId.length >= 30;
    _conversationId = data['conversationId'] as String?;
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

      // ⭐ V5 — signalisation REST : marquer l'appel accepté côté serveur
      //    (best effort — silencieux si l'appel vient du flux mesh pur)
      final cid = _callData?.callId;
      if (cid != null && _restSignaled) {
        ApiService.acceptCallSignal(cid).catchError((e) {
          debugPrint('WARN: REST accept failed (non bloquant) : $e');
          return <String, dynamic>{};
        });
      }

      _state = CallState.active;
      _startTimer();
      _pendingOffer = null;
      notifyListeners();
      // ⭐ V3-6: Stop the ringtone when the call becomes active
      _ringtone.stop();
    } catch (e) {
      debugPrint('ERROR: acceptIncomingCall failed: $e');
      await _cleanup();
      notifyListeners();
    }
  }

  /// ⭐ V5 — polling de statut REST (2 s) : détecte un appel terminé/refusé/
  ///    manqué/annulé par l'autre partie (le web V4 ne diffuse PAS d'événement
  ///    socket call:reject quand il refuse depuis l'overlay — seul le statut
  ///    serveur change). Arrêté dès que l'appel devient actif.
  void _startStatusPolling() {
    _statusPollTimer?.cancel();
    _statusPollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      final cid = _callData?.callId;
      if (_state == CallState.idle || cid == null || !_restSignaled) {
        _statusPollTimer?.cancel();
        return;
      }
      // Dès que la connexion est active, les événements mesh prennent le relais
      if (_state == CallState.active) {
        _statusPollTimer?.cancel();
        return;
      }
      try {
        final status = await ApiService.getCallSignalStatus(cid);
        final s = status['status'] as String?;
        if (s == 'declined' || s == 'missed' || s == 'cancelled' || s == 'ended') {
          debugPrint('CallService: statut REST=$s → raccrochage');
          await _cleanup();
          notifyListeners();
        }
      } catch (_) {
        // silencieux
      }
    });
  }

  /// Reject an incoming call (callee side).
  void rejectIncomingCall() {
    if (_callData != null) {
      _socket.emit('call:reject', {
        'toUserId': _callData!.otherUserId,
        'callId': _callData!.callId,
      });
      // ⭐ V5 — mémoriser le refus (ne jamais re-sonner) + signal REST
      if (_callData!.callId != null) {
        _declinedCallIds.add(_callData!.callId!);
        if (_restSignaled) {
          ApiService.declineCallSignal(_callData!.callId!).catchError((e) {
            debugPrint('WARN: REST decline failed : $e');
            return <String, dynamic>{};
          });
        }
      }
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
      debugPrint('ERROR: onCallAnswer failed: $e');
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
      debugPrint('WARN: onIceCandidate failed (non-blocking): $e');
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
      // ⭐ V5 — signalisation REST : terminer l'appel côté serveur
      //    (journal CALL_LOG dans la conversation + historique Appels)
      if (_restSignaled && _callData!.callId != null) {
        ApiService.endCallSignal(_callData!.callId!).catchError((e) {
          debugPrint('WARN: REST end failed : $e');
          return <String, dynamic>{};
        });
      }
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
    _statusPollTimer?.cancel();
    _statusPollTimer = null;
    _duration = 0;
    _muted = false;
    _videoOff = false;
    _speakerOn = true;
    _state = CallState.idle;
    _callData = null;
    _pendingOffer = null;
    _restSignaled = false;
    _conversationId = null;
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
