// ============================================================================
// GROUP CALL SERVICE — WebRTC multi-peer mesh + signalisation REST (V5)
// ============================================================================
// ⭐ V5 — CÂBLAGE COMPLET (le service existait mais n'était importé nulle part) :
//
//   1. SINGLETON partagé (comme SocketService) — les invitations de groupe
//      sont reçues QUEL QUE SOIT l'écran actif, pas seulement depuis l'écran
//      de la conversation concernée.
//
//   2. SIGNALISATION REST (parité web /api/chat/calls/signal) :
//        start   → POST { action:'start', conversationId, type } → callId
//                  réel du serveur + sonnerie de TOUS les membres (socket
//                  call:incoming + polling 3 s + FCM pour les directs).
//        accept  → POST { action:'accept', callId }
//        decline → POST { action:'decline', callId } (groupe : refus LOCAL,
//                  l'appel continue de sonner pour les autres)
//        end     → POST { action:'end', callId }
//      + POLLING de statut (2 s) pendant l'appel → raccroche proprement
//      quand le serveur passe l'appel en ended/missed/cancelled/declined.
//
//   3. MESH WebRTC (média) : chaque participant établit une connexion 1-à-1
//      avec les autres. Offres gérées avec la règle de négociation
//      « polite/impolite peer » (celui dont l'userId est le plus petit
//      cède son offre en cas de glare) — robuste web ↔ mobile.
//
//   4. ROUTEUR d'événements : les événements call:* du socket sont routés
//      vers CE service si un appel de groupe est actif (callId correspondant),
//      sinon ils sont transmis au CallService 1-1 enregistré par l'écran
//      de conversation (setOneToOneService) — plus d'écrasement de callbacks.
//
// Topologie : jusqu'à 4-5 participants. Au-delà, un SFU est nécessaire
// (le web bascule alors sur Jitsi — room déterministe).
// ============================================================================
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_service.dart';
import 'ringtone_service.dart';
import 'socket_service.dart';
import 'call_service.dart' show CallService, CallState;

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

/// Cycle de vie d'un appel de groupe (miroir du CallState 1-1).
enum GroupCallState { idle, outgoing, incoming, active }

class GroupCallService extends ChangeNotifier {
  // ⭐ V5 — singleton : une seule instance pour toute l'app
  static final GroupCallService instance = GroupCallService._internal();
  GroupCallService._internal() {
    // ⭐ V5 — le service 1-1 par défaut du routeur est le CallService
    //    singleton (les appels 1-1 entrants marchent depuis tout écran).
    _oneToOneService = CallService.instance;
    _bindSocket();
  }

  /// Ancien constructeur public (compat) — retourne le singleton.
  factory GroupCallService(SocketService socket) => instance;

  final SocketService _socket = SocketService();
  final RingtoneService _ringtone = RingtoneService();

  // ─── État ───────────────────────────────────────────────────────────────
  GroupCallState _state = GroupCallState.idle;
  bool _inCall = false;
  bool _isInitiator = false;
  String? _callId; // ⭐ V5 : id du signal REST (source de vérité serveur)
  bool _restSignaled = false; // ⭐ V5 : true si le callId vient du serveur REST
  String? _conversationId;
  String _callType = 'AUDIO';
  String? _myUserId;
  String? _myName;
  String? _initiatorId; // ⭐ V5 : initiateur réel (fin d'appel s'il part)
  String? _initiatorName;
  String? _convName;
  final Map<String, GroupCallParticipant> _participants = {};
  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, RTCVideoRenderer> _remoteRenderers = {};
  final Map<String, Map<String, dynamic>> _pendingOffers = {}; // userId → offer
  final Set<String> _declinedCallIds = {}; // ⭐ V5 : appels refusés localement
  MediaStream? _localStream;
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  bool _renderersInitialized = false;
  bool _muted = false;
  bool _videoOff = false;
  bool _speakerOn = true;
  int _duration = 0;
  Timer? _timer;
  Timer? _statusPollTimer; // ⭐ V5 : polling du statut REST (2 s)
  bool _ending = false;

  /// CallService 1-1 enregistré par l'écran de conversation (routage).
  CallService? _oneToOneService;

  // ─── Getters ─────────────────────────────────────────────────────────────
  GroupCallState get state => _state;
  bool get inCall => _inCall;
  bool get isInitiator => _isInitiator;
  bool get isIncoming => _state == GroupCallState.incoming;
  bool get isOutgoing => _state == GroupCallState.outgoing;
  bool get isActive => _state == GroupCallState.active;
  String? get callId => _callId;
  String? get conversationId => _conversationId;
  String? get convName => _convName;
  String get callType => _callType;
  String? get initiatorName => _initiatorName;
  List<GroupCallParticipant> get participants => _participants.values.toList();
  int get connectedCount =>
      _participants.values.where((p) => p.connected).length;
  int get duration => _duration;
  bool get muted => _muted;
  bool get videoOff => _videoOff;
  bool get speakerOn => _speakerOn;
  String? get myUserId => _myUserId;
  bool get isVideoCall => _callType == 'VIDEO';
  RTCVideoRenderer get localRenderer => _localRenderer;
  RTCVideoRenderer? getRemoteRenderer(String userId) => _remoteRenderers[userId];

  /// Enregistre le CallService 1-1 courant (routage des événements non-groupe).
  void setOneToOneService(CallService? service) {
    _oneToOneService = service;
  }

  // ─── Routage des événements socket ─────────────────────────────────────
  void _bindSocket() {
    _socket.onCallOffer = (data) {
      if (_inCall && data['callId'] == _callId) {
        onCallOffer(data);
      } else if (_inCall) {
        // Un appel de groupe est déjà actif → refus discret de l'offre 1-1
        // (jamais deux sonneries concurrentes).
        _socket.emit('call:reject', {
          'toUserId': data['fromUserId'],
          'callId': data['callId'],
        });
      } else {
        _oneToOneService?.onIncomingCallOffer(data);
      }
    };
    _socket.onCallAnswer = (data) {
      if (_inCall && data['callId'] == _callId) {
        onCallAnswer(data);
      } else {
        _oneToOneService?.onCallAnswer(data);
      }
    };
    _socket.onCallIceCandidate = (data) {
      if (_inCall && data['callId'] == _callId) {
        onIceCandidate(data);
      } else {
        _oneToOneService?.onIceCandidate(data);
      }
    };
    _socket.onCallReject = (data) {
      if (_inCall && data['callId'] == _callId) {
        // Un membre a refusé (mesh) → le retirer de la liste des attendus
        _removeParticipant(data['fromUserId'] as String? ?? '');
      } else {
        _oneToOneService?.onCallReject();
      }
    };
    _socket.onCallHangup = (data) {
      if (_inCall && data['callId'] == _callId) {
        onGroupCallLeave(data);
      } else {
        _oneToOneService?.onCallHangup();
      }
    };
    _socket.onGroupCallInvite = (data) => onGroupCallInvite(data);
    _socket.onGroupCallLeave = (data) => onGroupCallLeave(data);
    // ⭐ V5 — signalisation REST : appel de groupe sonnant pour moi
    //    (initiateur web OU initiateur mobile via POST /calls/signal).
    _socket.onCallIncoming = (data) => onCallIncomingSignal(data);
  }

  // ─── Initialisation ──────────────────────────────────────────────────────
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

    if (_localStream != null) {
      _localStream!.getTracks().forEach((track) {
        pc.addTrack(track, _localStream!);
      });
    }

    pc.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        final stream = event.streams[0];
        final existing = _remoteRenderers[peerUserId];
        if (existing != null) {
          existing.srcObject = stream;
        } else {
          final renderer = RTCVideoRenderer();
          renderer.initialize().then((_) {
            renderer.srcObject = stream;
            _remoteRenderers[peerUserId] = renderer;
            _participants[peerUserId]?.connected = true;
            _maybeActivate();
            notifyListeners();
          });
        }
      }
    };

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

  /// Passe l'appel en actif dès qu'au moins un flux distant arrive.
  void _maybeActivate() {
    if (_state == GroupCallState.outgoing ||
        (_state == GroupCallState.incoming)) {
      _state = GroupCallState.active;
      _ringtone.stop();
      _startTimer();
    }
  }

  // ─── Appel sortant (initiateur) ──────────────────────────────────────────
  /// [invitees] : participants à inviter via le mesh (max recommandé 4).
  /// [myUserId]/[myName] : identité de l'appelant.
  Future<void> startGroupCall({
    required String conversationId,
    required String myUserId,
    required String myName,
    required String callType, // 'AUDIO' | 'VIDEO'
    required String convName,
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
    _convName = convName;
    _isInitiator = true;
    _initiatorId = myUserId;
    _initiatorName = myName;
    _inCall = true;
    _state = GroupCallState.outgoing;

    // ⭐ V5 — 1. SIGNALISATION REST : créer le signal côté serveur (callId
    //    réel + sonnerie de tous les membres via call:incoming + polling).
    //    En cas d'échec REST, on retombe sur un callId local (mesh seul,
    //    exactement comme l'ancien comportement V3-6).
    var restCallId = 'group-${DateTime.now().millisecondsSinceEpoch}';
    var restSignaled = false;
    try {
      final res = await ApiService.startCallSignal(
        conversationId: conversationId,
        type: callType == 'VIDEO' ? 'video' : 'audio',
      );
      final serverCallId = res['callId'];
      if (serverCallId is String && serverCallId.isNotEmpty) {
        restCallId = serverCallId;
        restSignaled = true;
      }
    } catch (e) {
      debugPrint('WARN: REST signal start (group) failed — mesh seul : $e');
    }
    _callId = restCallId;
    _restSignaled = restSignaled;

    // Participants
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
    _participants[myUserId] = GroupCallParticipant(
      userId: myUserId,
      name: myName,
      connected: true,
    );

    // Média local
    _localStream = await _getUserMedia(video: video);
    _localRenderer.srcObject = _localStream;

    // ⭐ V5 — 2. INVITATION MESH vers chaque invité (le média passe en
    //    pair-à-pair ; l'offre part de l'initiateur vers chaque invité).
    _socket.emit('group-call:invite', {
      'toUserIds': invitees.map((i) => i.userId).toList(),
      'callId': _callId,
      'callType': _callType,
      'conversationId': _conversationId,
      'callerName': _myName,
      'callerAvatarUrl': null,
      'participantNames': participantNames,
    });

    // Sonnerie d'attente (ringback Yeshua) + polling de statut
    _ringtone.start(mode: 'outgoing');
    _startStatusPolling();
    notifyListeners();
  }

  // ─── Invitation entrante (mesh) ─────────────────────────────────────────
  void onGroupCallInvite(Map<String, dynamic> data) async {
    // ⭐ V5 — déjà en appel (groupe OU 1-1) → refus discret, jamais deux
    //    sonneries concurrentes sur le même RingtoneService singleton.
    if (_inCall || CallService.instance.state != CallState.idle) {
      _socket.emit('group-call:leave', {
        'toUserIds': [data['fromUserId']],
        'callId': data['callId'],
      });
      return;
    }
    final callId = data['callId']?.toString();
    if (callId == null || _declinedCallIds.contains(callId)) return;

    _callId = callId;
    // Un callId qui n'est PAS au format local (« group-… ») vient du serveur
    // (randomUUID du POST /calls/signal) → le cycle de vie REST s'applique.
    _restSignaled = !callId.startsWith('group-');
    _callType = (data['callType'] as String?) ?? 'AUDIO';
    _conversationId = data['conversationId'] as String?;
    _myUserId = await _getMyUserId();
    _isInitiator = false;
    _initiatorId = data['fromUserId'] as String?;
    _initiatorName = data['callerName'] as String?;
    _inCall = true;
    _state = GroupCallState.incoming;

    // L'initiateur comme participant
    final initiatorId = data['fromUserId'] as String? ?? '';
    if (initiatorId.isNotEmpty) {
      _participants[initiatorId] = GroupCallParticipant(
        userId: initiatorId,
        name: (data['callerName'] as String?) ?? 'Utilisateur',
        connected: false,
      );
    }

    // Autres participants connus de l'appel
    final participantNames = data['participantNames'] as Map<dynamic, dynamic>?;
    if (participantNames != null) {
      participantNames.forEach((key, value) {
        final uid = key.toString();
        if (uid != _myUserId && uid != initiatorId && !_participants.containsKey(uid)) {
          _participants[uid] = GroupCallParticipant(
            userId: uid,
            name: value.toString(),
            connected: false,
          );
        }
      });
    }

    _ringtone.start(mode: 'incoming');
    notifyListeners();
  }

  // ─── Signal REST entrant (call:incoming, appel de groupe) ───────────────
  /// Émis par la gateway quand un membre lance un appel via POST /calls/signal.
  /// Pour un appel de GROUPE initié côté web avec la chaîne SFU connectée,
  /// le mobile ne peut pas rejoindre la room SFU (pas de SDK LiveKit/Agora/Daily) :
  /// on sonne quand même — l'acceptation attendra une offre mesh (repli web)
  /// puis raccrochera proprement si rien n'arrive.
  void onCallIncomingSignal(Map<String, dynamic> data) {
    // ⭐ V5 — déjà en appel (groupe OU 1-1) → ignorer
    if (_inCall || CallService.instance.state != CallState.idle) return;
    final isGroupCall = data['isGroupCall'] == true;
    if (!isGroupCall) return; // 1-1 : la vraie sonnerie est l'offre mesh
    final callId = data['callId']?.toString();
    if (callId == null || _declinedCallIds.contains(callId)) return;
    if (_initiatorId == data['initiatorId'] && _callId == callId) return;

    // Si une invitation mesh est déjà en attente pour ce même appel, ne pas
    // doubler la sonnerie.
    if (_state == GroupCallState.incoming && _callId == callId) return;

    _callId = callId;
    _conversationId = data['conversationId'] as String?;
    _callType = data['callType'] == 'video' ? 'VIDEO' : 'AUDIO';
    _convName = data['convName'] as String?;
    _initiatorId = data['initiatorId'] as String?;
    _initiatorName = data['initiatorName'] as String?;
    _isInitiator = false;
    _restSignaled = true; // callId serveur (diffusé par broadcastCallIncoming)
    _inCall = true;
    _state = GroupCallState.incoming;

    if (_initiatorId != null && _initiatorId!.isNotEmpty) {
      _participants[_initiatorId!] = GroupCallParticipant(
        userId: _initiatorId!,
        name: _initiatorName ?? 'Utilisateur',
        connected: false,
      );
    }

    _ringtone.start(mode: 'incoming');
    notifyListeners();
  }

  // ─── Accepter un appel entrant ───────────────────────────────────────────
  Future<bool> acceptIncomingCall() async {
    if (_state != GroupCallState.incoming) return false;
    final video = _callType == 'VIDEO';
    final hasPerms = await _requestPermissions(video: video);
    if (!hasPerms) {
      rejectIncomingCall();
      return false;
    }

    await _ensureRenderersInitialized();
    _myName = await _getMyName();
    _myUserId = await _getMyUserId();

    // ⭐ V5 — signalisation REST : marquer l'appel accepté côté serveur
    final cid = _callId;
    if (cid != null && _restSignaled) {
      try {
        await ApiService.acceptCallSignal(cid);
      } catch (e) {
        debugPrint('WARN: REST accept failed (non bloquant) : $e');
      }
    }

    _localStream = await _getUserMedia(video: video);
    _localRenderer.srcObject = _localStream;
    _state = GroupCallState.active;
    _ringtone.stop();
    _startTimer();
    _startStatusPolling();

    // ⭐ V5 — RÉPONDRE aux offres en attente (l'initiateur a déjà proposé).
    //    Puis, pour les participants restés sans offre, en émettre une
    //    (négociation parfaite : le glare est résolu dans onCallOffer).
    final pendingIds = _pendingOffers.keys.toList();
    for (final peerId in pendingIds) {
      final offer = _pendingOffers.remove(peerId);
      if (offer != null) await _answerPeerOffer(peerId, offer);
    }
    for (final participant in _participants.values) {
      if (participant.userId != _myUserId &&
          !_peerConnections.containsKey(participant.userId) &&
          !_pendingOffers.containsKey(participant.userId)) {
        await _initiatePeerConnection(participant.userId);
      }
    }

    notifyListeners();
    return true;
  }

  Future<void> _initiatePeerConnection(String peerUserId) async {
    try {
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
    } catch (e) {
      debugPrint('WARN: _initiatePeerConnection($peerUserId) failed : $e');
    }
  }

  /// Répond à une offre distante : crée le pc, setRemoteDescription, answer.
  Future<void> _answerPeerOffer(String peerUserId, Map<String, dynamic> offerData) async {
    try {
      final pc = _peerConnections[peerUserId] ?? await _createPeerConnection(peerUserId);
      _peerConnections[peerUserId] = pc;
      final offer = RTCSessionDescription(
        offerData['offer']['sdp'] as String?,
        offerData['offer']['type'] as String?,
      );
      await pc.setRemoteDescription(offer);
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      _socket.emit('call:answer', {
        'toUserId': peerUserId,
        'callId': _callId,
        'answer': answer.toMap(),
      });
    } catch (e) {
      debugPrint('WARN: _answerPeerOffer($peerUserId) failed : $e');
    }
  }

  // ─── Refuser un appel entrant ────────────────────────────────────────────
  void rejectIncomingCall() {
    final cid = _callId;
    if (cid != null) {
      _declinedCallIds.add(cid); // ne plus jamais re-sonner pour cet appel
      // ⭐ V5 — signalisation REST : en groupe le refus est LOCAL (l'appel
      //    continue de sonner pour les autres) — le serveur gère cette
      //    sémantique dans decline().
      if (_restSignaled) {
        ApiService.declineCallSignal(cid).catchError((e) {
          debugPrint('WARN: REST decline failed : $e');
          return <String, dynamic>{};
        });
      }
    }
    // Si l'invitation vient du mesh, prévenir les autres participants
    if (_participants.isNotEmpty && _initiatorId != null && _initiatorId != _myUserId) {
      _socket.emit('group-call:leave', {
        'toUserIds': [_initiatorId],
        'callId': _callId,
      });
    }
    _cleanup();
    notifyListeners();
  }

  // ─── Offre mesh entrante (un participant se connecte à nous) ─────────────
  Future<void> onCallOffer(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String?;
    if (peerUserId == null || peerUserId.isEmpty || peerUserId == _myUserId) return;

    if (!_participants.containsKey(peerUserId)) {
      _participants[peerUserId] = GroupCallParticipant(
        userId: peerUserId,
        name: (data['callerName'] as String?) ?? 'Utilisateur',
        connected: false,
      );
    }

    // Pas encore en appel actif (on sonne) → mettre l'offre en attente ;
    // elle sera traitée dans acceptIncomingCall().
    if (_state == GroupCallState.incoming) {
      _pendingOffers[peerUserId] = data;
      return;
    }

    final existingPc = _peerConnections[peerUserId];
    if (existingPc == null) {
      // Aucune connexion → on répond simplement (rôle answerer)
      await _answerPeerOffer(peerUserId, data);
      return;
    }

    // Glare (nous avons une offre locale, l'autre aussi) — négociation
    // parfaite : le pair à l'userId le plus PETIT est « polite » → il
    // abandonne son offre et répond à la nôtre.
    // ⭐ V8 — BUGFIX : localDescription/remoteDescription n'existent pas sur
    //    l'interface webrtc_interface 1.5+ (getters retirés) → méthodes async.
    final localDesc = await existingPc.getLocalDescription();
    final remoteDesc = await existingPc.getRemoteDescription();
    final myOfferPending = localDesc?.type == 'offer' && remoteDesc == null;
    if (myOfferPending) {
      final iAmImpolite = (_myUserId ?? '').compareTo(peerUserId) > 0;
      if (iAmImpolite) {
        debugPrint('GroupCall: glare avec $peerUserId — je garde mon offre (impolite)');
        return; // l'autre répondra à notre offre
      }
      // Polite : détruire notre pc + répondre à son offre
      try {
        await existingPc.close();
      } catch (_) {}
      _peerConnections.remove(peerUserId);
      _remoteRenderers.remove(peerUserId)?.dispose();
      await _answerPeerOffer(peerUserId, data);
    } else {
      // pc existant avec remote description → re-offre (re-négociation)
      await _answerPeerOffer(peerUserId, data);
    }
  }

  // ─── Réponse à notre offre ───────────────────────────────────────────────
  Future<void> onCallAnswer(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String?;
    final pc = peerUserId != null ? _peerConnections[peerUserId] : null;
    if (pc == null) return;
    try {
      final answer = RTCSessionDescription(
        data['answer']['sdp'] as String?,
        data['answer']['type'] as String?,
      );
      await pc.setRemoteDescription(answer);
      _participants[peerUserId]?.connected = true;
      _maybeActivate();
      notifyListeners();
    } catch (e) {
      debugPrint('WARN: onCallAnswer failed : $e');
    }
  }

  // ─── ICE candidate ──────────────────────────────────────────────────────
  Future<void> onIceCandidate(Map<String, dynamic> data) async {
    if (!_inCall || data['callId'] != _callId) return;
    final peerUserId = data['fromUserId'] as String?;
    final pc = peerUserId != null ? _peerConnections[peerUserId] : null;
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

  // ─── Départ d'un participant (group-call:leave / call:hangup) ────────────
  void onGroupCallLeave(Map<String, dynamic> data) {
    if (!_inCall || data['callId'] != _callId) return;
    final leavingUserId = data['fromUserId'] as String? ?? '';
    _removeParticipant(leavingUserId);

    // L'initiateur part → l'appel est terminé pour les invités (mesh)
    if (!_isInitiator && leavingUserId == _initiatorId) {
      _cleanup();
    }
    notifyListeners();
  }

  // ─── Polling du statut REST (2 s) ────────────────────────────────────────
  /// Filet de sécurité (parité web) : si le serveur passe l'appel en
  /// ended / missed / cancelled / declined, on raccroche proprement.
  void _startStatusPolling() {
    _statusPollTimer?.cancel();
    _statusPollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      final cid = _callId;
      if (!_inCall || cid == null || _ending || !_restSignaled) return;
      try {
        final status = await ApiService.getCallSignalStatus(cid);
        final s = status['status'] as String?;
        if (s == 'ended' || s == 'missed' || s == 'cancelled' || s == 'declined') {
          debugPrint('GroupCall: statut REST=$s → raccrochage');
          _cleanup();
          notifyListeners();
        }
      } catch (_) {
        // silencieux — le polling ne doit jamais interrompre l'appel
      }
    });
  }

  // ─── Contrôles locaux ────────────────────────────────────────────────────
  void toggleMute() {
    final audioTrack = _localStream?.getAudioTracks().isNotEmpty == true
        ? _localStream!.getAudioTracks().first
        : null;
    if (audioTrack != null) {
      audioTrack.enabled = !audioTrack.enabled;
      _muted = !audioTrack.enabled;
      notifyListeners();
    }
  }

  void toggleVideo() {
    final videoTrack = _localStream?.getVideoTracks().isNotEmpty == true
        ? _localStream!.getVideoTracks().first
        : null;
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

  /// Raccrocher — notifier tous les participants + signalisation REST end.
  void hangup() {
    _ending = true;
    if (_participants.isNotEmpty) {
      final targets = _participants.keys
          .where((id) => id != _myUserId && id != _initiatorId)
          .toList();
      if (targets.isNotEmpty) {
        _socket.emit('group-call:leave', {
          'toUserIds': targets,
          'callId': _callId,
        });
      }
      // L'initiateur reçoit aussi un call:hangup (mesh 1-1 semantics)
      if (_initiatorId != null && _initiatorId != _myUserId) {
        _socket.emit('call:hangup', {
          'toUserId': _initiatorId,
          'callId': _callId,
        });
      }
    }
    // ⭐ V5 — signalisation REST : terminer l'appel côté serveur
    final cid = _callId;
    if (cid != null && _restSignaled) {
      ApiService.endCallSignal(cid).catchError((e) {
        debugPrint('WARN: REST end failed : $e');
        return <String, dynamic>{};
      });
    }
    _cleanup();
    notifyListeners();
  }

  // ─── Nettoyage ───────────────────────────────────────────────────────────
  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _duration++;
      notifyListeners();
    });
  }

  void _removeParticipant(String userId) {
    if (userId.isEmpty) return;
    _peerConnections[userId]?.close();
    _peerConnections.remove(userId);
    _remoteRenderers.remove(userId)?.dispose();
    _participants.remove(userId);
    _pendingOffers.remove(userId);
    if (_participants.length <= 1 && _isInitiator) {
      // Plus personne dans l'appel
      _cleanup();
    }
    notifyListeners();
  }

  Future<String?> _getMyUserId() async {
    if (_myUserId != null) return _myUserId;
    try {
      return await AuthService.getUserId();
    } catch (_) {
      return null;
    }
  }

  Future<String?> _getMyName() async {
    if (_myName != null) return _myName;
    try {
      return await AuthService.getDisplayName();
    } catch (_) {
      return 'Utilisateur';
    }
  }

  void _cleanup() {
    _timer?.cancel();
    _timer = null;
    _statusPollTimer?.cancel();
    _statusPollTimer = null;
    _ringtone.stop();
    _duration = 0;
    _muted = false;
    _videoOff = false;
    _speakerOn = true;
    _inCall = false;
    _ending = false;
    _isInitiator = false;
    _restSignaled = false;
    _state = GroupCallState.idle;
    _callId = null;
    _conversationId = null;
    _convName = null;
    _initiatorId = null;
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

  /// Ne PAS disposer le singleton ; nettoyage uniquement.
  @override
  void dispose() {
    _cleanup();
    super.dispose();
  }
}
