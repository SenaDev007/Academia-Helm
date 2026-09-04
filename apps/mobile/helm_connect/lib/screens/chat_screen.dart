// ============================================================================
// HELM CONNECT — Main Chat Screen (Discord-like structure, V3-11)
// ============================================================================
// Structure conforme à la spec Helm Connect :
//
//   HELM CONNECT
//   ├── Discussions (Privées + Groupes + Scolaires)
//   ├── Communautés (Classes + Enseignants + Parents + Administration)
//   ├── Annonces (Communication officielle)
//   ├── Canaux (Telegram-style broadcast)
//   ├── Fichiers (Centre documentaire)
//   ├── Vocaux (Messages vocaux)
//   ├── Appels (Historique des appels)
//   ├── Notifications (Centre de notifications)
//   ├── Recherche (Recherche globale)
//   ├── Modération (Messages signalés)
//   ├── Analytics (Tableau de bord communication)
//   └── Paramètres (Profil + préférences)
//
// Sur mobile : un drawer (navigation drawer) avec les 12 sections.
// Chaque section ouvre l'écran correspondant.
// ============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/call_service.dart';
import '../services/group_call_service.dart';
import '../theme/helm_theme.dart';
import 'conversation_detail_screen.dart';
import 'call_screen.dart';
import 'group_call_screen.dart';
import 'announcements_screen.dart';
import 'notification_prefs_screen.dart';
import 'global_search_screen.dart';
import 'new_chat_screen.dart';
import 'notification_center_screen.dart';
import 'helm_connect_sections.dart';

// ⭐ V3-11: 12 sections Helm Connect (conformes à la spec)
enum HelmConnectSection {
  discussions,
  communautes,
  annonces,
  canaux,
  fichiers,
  vocaux,
  appels,
  notifications,
  recherche,
  moderation,
  analytics,
  parametres,
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<Conversation> _conversations = [];
  bool _loading = true;
  String? _error;
  Timer? _refreshTimer;
  User? _currentUser;
  HelmConnectSection _activeSection = HelmConnectSection.discussions;

  // ⭐ V5 — SOCKET GLOBAL + APPELS ENTRANTS DEPUIS TOUT ÉCRAN :
  //    la connexion /chat (singleton) est établie ICI, à l'échelle de l'app —
  //    plus besoin d'ouvrir une conversation pour recevoir un appel.
  final SocketService _socket = SocketService(); // singleton
  Timer? _incomingPollTimer; // filet de sécurité REST (3 s, comme le web)
  bool _isCallScreenPushed = false;
  bool _isGroupCallScreenPushed = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
    _loadConversations();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadConversations());
    // ⭐ V5 — socket global + écoute des appels + polling REST de secours
    _initGlobalCallHandling();
    // ⭐ V7 (parité web) — refresh LIVE de la liste : inbox:new / channel:message
    //    rechargent les conversations instantanément (avant : polling 30 s seul,
    //    les badges non-lus et aperçus restaient figés jusqu'à 30 s).
    _socket.onInboxNew = (conversationId, preview, senderName) {
      if (mounted) _loadConversations();
    };
    _socket.onChannelMessage = (channelId, message) {
      if (mounted) _loadConversations();
    };
    _socket.onMessageRead = (conversationId, userId, messageIds) {
      // Quelqu'un a lu mes messages → les badges non-lus peuvent changer
      if (mounted) _loadConversations();
    };
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _incomingPollTimer?.cancel();
    CallService.instance.removeListener(_onCallStateChanged);
    GroupCallService.instance.removeListener(_onGroupCallStateChanged);
    // ⭐ V7 — ne pas laisser les callbacks de liste pointant vers un State disposé
    _socket.onInboxNew = null;
    _socket.onChannelMessage = null;
    _socket.onMessageRead = null;
    super.dispose();
  }

  // ⭐ V5 — Connexion du socket singleton + écouteurs d'appels (1-1 ET groupe)
  //    + polling REST des appels entrants (filet de sécurité 3 s si le socket
  //    est coupé — même architecture que le web V4).
  Future<void> _initGlobalCallHandling() async {
    try {
      final token = await ApiService.getAuthToken();
      final userId = await AuthService.getUserId();
      if (token != null && userId != null) {
        await _socket.connect(token: token, userId: userId);
      }
    } catch (_) {
      // silencieux — le polling prend le relais
    }
    CallService.instance.addListener(_onCallStateChanged);
    GroupCallService.instance.addListener(_onGroupCallStateChanged);
    _incomingPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      // Le socket est connecté → pas besoin du filet de sécurité
      if (_socket.isConnected) return;
      try {
        final incoming = await ApiService.getIncomingCalls();
        for (final call in incoming) {
          if (call['isGroupCall'] == true) {
            GroupCallService.instance.onCallIncomingSignal(call);
          }
        }
      } catch (_) {
        // silencieux
      }
    });
  }

  // ⭐ V5 — Push des écrans d'appel depuis N'IMPORTE QUEL écran de l'app
  void _onCallStateChanged() {
    if (!mounted) return;
    final state = CallService.instance.state;
    if ((state == CallState.incoming || state == CallState.outgoing || state == CallState.active) &&
        !_isCallScreenPushed) {
      _isCallScreenPushed = true;
      Navigator.of(context).push(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/call'),
          builder: (_) => CallScreen(callService: CallService.instance),
          fullscreenDialog: true,
        ),
      ).then((_) => _isCallScreenPushed = false);
    }
  }

  void _onGroupCallStateChanged() {
    if (!mounted) return;
    final state = GroupCallService.instance.state;
    if (state != GroupCallState.idle && !_isGroupCallScreenPushed) {
      _isGroupCallScreenPushed = true;
      Navigator.of(context).push(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/group-call'),
          builder: (_) => const GroupCallScreen(),
          fullscreenDialog: true,
        ),
      ).then((_) => _isGroupCallScreenPushed = false);
    }
  }

  Future<void> _loadCurrentUser() async {
    try {
      final userJson = await ApiService.getCurrentUser();
      if (mounted) {
        setState(() {
          _currentUser = User.fromJson(userJson['user'] as Map<String, dynamic>);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadConversations() async {
    try {
      final json = await ApiService.listConversations();
      if (mounted) {
        setState(() {
          _conversations = json.map((c) => Conversation.fromJson(c)).toList();
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'maintenant';
    if (diff.inHours < 1) return 'il y a ${diff.inMinutes}min';
    if (diff.inDays < 1) return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    if (diff.inDays < 7) return 'il y a ${diff.inDays}j';
    return '${dt.day}/${dt.month}';
  }

  Future<void> _logout() async {
    // ⭐ V6 — DÉSENREGISTRER le token FCM AVANT d'effacer la session : le
    //    token restait actif côté serveur → notifications fantômes après
    //    déconnexion (unregisterFcmToken existait mais n'était jamais appelée).
    try {
      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken != null) {
        await ApiService.unregisterFcmToken(fcmToken);
      }
    } catch (_) {
      // Silencieux : la déconnexion ne doit jamais être bloquée
    }
    await ApiService.logout();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    }
  }

  // ⭐ V3-11: Section metadata (icon, label, color)
  static const _sections = <HelmConnectSection, ({IconData icon, String label, Color color})>{
    HelmConnectSection.discussions: (icon: Icons.chat, label: 'Discussions', color: Color(0xFF1677FF)),
    HelmConnectSection.communautes: (icon: Icons.groups, label: 'Communautés', color: Color(0xFF10B981)),
    HelmConnectSection.annonces: (icon: Icons.campaign, label: 'Annonces', color: Color(0xFFF59E0B)),
    HelmConnectSection.canaux: (icon: Icons.feed, label: 'Canaux', color: Color(0xFF8B5CF6)),
    HelmConnectSection.fichiers: (icon: Icons.folder, label: 'Fichiers', color: Color(0xFF06B6D4)),
    HelmConnectSection.vocaux: (icon: Icons.mic, label: 'Vocaux', color: Color(0xFFEC4899)),
    HelmConnectSection.appels: (icon: Icons.phone, label: 'Appels', color: Color(0xFF3B82F6)),
    HelmConnectSection.notifications: (icon: Icons.notifications, label: 'Notifications', color: Color(0xFFEF4444)),
    HelmConnectSection.recherche: (icon: Icons.search, label: 'Recherche', color: Color(0xFF6366F1)),
    HelmConnectSection.moderation: (icon: Icons.shield, label: 'Modération', color: Color(0xFFDC2626)),
    HelmConnectSection.analytics: (icon: Icons.bar_chart, label: 'Analytics', color: Color(0xFF7C3AED)),
    HelmConnectSection.parametres: (icon: Icons.settings, label: 'Paramètres', color: Color(0xFF64748B)),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // ⭐ Drawer: Discord-like sidebar with 12 sections
      drawer: _buildDrawer(),
      appBar: AppBar(
        // ⭐ V3-11: Royal Blue 3-stop gradient (same as splash + call screen)
        flexibleSpace: Container(
          decoration: const BoxDecoration(gradient: HelmGradients.royalBlue),
        ),
        title: Row(
          children: [
            Image.asset('assets/icons/helm_connect.png', width: 24, height: 24, fit: BoxFit.contain),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _sections[_activeSection]!.label,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  _currentUser?.tenantName ?? 'Academia Helm',
                  style: const TextStyle(fontSize: 10, color: HelmColors.goldLight, letterSpacing: 0.5),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Colors.white),
            tooltip: 'Recherche globale',
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const GlobalSearchScreen()));
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onSelected: (value) {
              if (value == 'logout') _logout();
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout), title: Text('Déconnexion'))),
            ],
          ),
        ],
      ),
      body: _buildSectionBody(),
      floatingActionButton: _activeSection == HelmConnectSection.discussions
          ? HelmBrandedFab(
              icon: Icons.add,
              tooltip: 'Nouvelle discussion',
              onPressed: () {
                // ⭐ V7 — recherche de membres d'école (nom/email/téléphone),
                //    invitations inter-écoles + invitations reçues.
                Navigator.push(context, MaterialPageRoute(builder: (_) => const NewChatScreen()));
              },
            )
          : null,
    );
  }

  // ⭐ Discord-like drawer with 12 sections
  Widget _buildDrawer() {
    return Drawer(
      child: Container(
        decoration: const BoxDecoration(gradient: HelmGradients.royalBlueVertical),
        child: SafeArea(
          child: Column(
            children: [
              // Header with Helm Connect logo
              Container(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Image.asset('assets/icons/helm_connect.png', width: 32, height: 32, fit: BoxFit.contain),
                    const SizedBox(width: 8),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Helm', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                            SizedBox(width: 3),
                            Text('Connect', style: TextStyle(color: HelmColors.goldBright, fontSize: 18, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Text('Communiquez • Collaborez • Restez connectés', style: TextStyle(color: HelmColors.goldLight, fontSize: 9, letterSpacing: 1)),
                      ],
                    ),
                  ],
                ),
              ),
              const Divider(color: HelmColors.primaryVivid, height: 1),
              // Sections list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: HelmConnectSection.values.length,
                  itemBuilder: (context, index) {
                    final section = HelmConnectSection.values[index];
                    final info = _sections[section]!;
                    final isActive = _activeSection == section;
                    return ListTile(
                      leading: Icon(info.icon, color: isActive ? info.color : Colors.white70, size: 22),
                      title: Text(
                        info.label,
                        style: TextStyle(
                          color: isActive ? Colors.white : Colors.white70,
                          fontSize: 14,
                          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      selected: isActive,
                      selectedTileColor: info.color.withOpacity(0.15),
                      onTap: () {
                        setState(() => _activeSection = section);
                        Navigator.pop(context); // Close drawer
                      },
                    );
                  },
                ),
              ),
              // User info at bottom
              const Divider(color: HelmColors.primaryVivid, height: 1),
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: HelmColors.primaryVivid,
                  child: Text(
                    (_currentUser?.firstName?.isNotEmpty == true ? _currentUser!.firstName![0] : '?'),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                title: Text(
                  _currentUser?.fullName ?? 'Utilisateur',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  _currentUser?.email ?? '',
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ⭐ Section body — renders different content per section
  Widget _buildSectionBody() {
    switch (_activeSection) {
      case HelmConnectSection.discussions:
        return _buildDiscussionsBody();
      case HelmConnectSection.communautes:
        return const CommunitiesScreen();
      case HelmConnectSection.annonces:
        return const AnnouncementsScreen();
      case HelmConnectSection.canaux:
        return const ChannelsScreen();
      case HelmConnectSection.fichiers:
        return const FilesScreen();
      case HelmConnectSection.vocaux:
        return const VoiceMessagesScreen();
      case HelmConnectSection.appels:
        return const CallsScreen();
      case HelmConnectSection.recherche:
        return const GlobalSearchScreen();
      case HelmConnectSection.notifications:
        // ⭐ V6 — CENTRE DE NOTIFICATIONS réel (avant : uniquement les prefs
        //    DND — les méthodes API existaient sans UI). Un bouton « Préférences »
        //    donne accès aux anciens réglages.
        return NotificationCenterScreen();
      case HelmConnectSection.moderation:
        return const ModerationScreen();
      case HelmConnectSection.analytics:
        return const AnalyticsScreen();
      case HelmConnectSection.parametres:
        return _buildParametresBody();
    }
  }

  // Discussions — liste des conversations (existing code)
  // ⭐ V7 (parité web V6.1) — badge d'appel dans la liste des conversations :
  //    rouge = manqué, ambre = refusé, gris = annulé, vert = terminé.
  (IconData, Color, String) _callBadge(Conversation conv) {
    final video = (conv.lastMessageCallType ?? 'audio') == 'video';
    final status = conv.lastMessageCallStatus ?? 'ended';
    final outgoing = conv.lastMessageSentByMe == true;
    switch (status) {
      case 'missed':
        return (
          video ? Icons.videocam_off_outlined : Icons.phone_missed,
          const Color(0xFFEF4444),
          outgoing ? 'Appel manqué (sortant)' : 'Appel manqué',
        );
      case 'declined':
      case 'rejected':
        return (video ? Icons.videocam_off_outlined : Icons.phone_disabled, const Color(0xFFF59E0B), 'Appel refusé');
      case 'cancelled':
        return (
          video ? Icons.videocam_outlined : Icons.phone_callback,
          const Color(0xFF94A3B8),
          outgoing ? 'Appel sans réponse' : 'Appel annulé',
        );
      default:
        return (video ? Icons.videocam_outlined : Icons.phone_in_talk, const Color(0xFF10B981), 'Appel terminé');
    }
  }

  Widget _buildDiscussionsBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: HelmColors.primary));
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() => _loading = true);
                _loadConversations();
              },
              child: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }
    if (_conversations.isEmpty) {
      // ⭐ V3-11: Branded empty state with gold CTA
      return HelmEmptyState(
        icon: Icons.chat_bubble_outline,
        title: 'Aucune conversation',
        subtitle: 'Démarrez une nouvelle discussion avec le bouton + en bas à droite.',
        ctaLabel: 'Nouvelle discussion',
        onCta: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const NewChatScreen()));
        },
      );
    }
    return RefreshIndicator(
      onRefresh: _loadConversations,
      child: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (context, index) {
          final conv = _conversations[index];
          final isGroup = conv.type == 'GROUP';
          final isChannel = conv.type == 'CHANNEL';
          final displayName = isGroup || isChannel
              ? (conv.name ?? (isChannel ? 'Canal' : 'Groupe'))
              : (conv.participants.isNotEmpty
                  ? conv.participants.firstWhere((p) => p.userId != _currentUser?.id, orElse: () => conv.participants.first).fullName
                  : 'Conversation');
          // ⭐ V7 — badge d'appel si le dernier message est un CALL_LOG
          final isCallLog = conv.lastMessageType == 'CALL_LOG';
          final (badgeIcon, badgeColor, badgeLabel) = isCallLog ? _callBadge(conv) : (null, Colors.transparent, '');
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: isChannel
                  ? const Color(0xFF8B5CF6)
                  : isGroup
                      ? const Color(0xFF10B981)
                      : const Color(0xFF1677FF),
              child: isChannel
                  ? const Icon(Icons.feed, color: Colors.white, size: 20)
                  : isGroup
                      ? const Icon(Icons.group, color: Colors.white, size: 20)
                      : Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(displayName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: conv.unreadCount > 0 ? FontWeight.bold : FontWeight.w600)),
                ),
                if (conv.isMuted) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.notifications_off_outlined, size: 14, color: Colors.grey[400]),
                ],
              ],
            ),
            subtitle: Row(
              children: [
                // ⭐ V7 — pastille d'appel (icône colorée) + aperçu
                if (isCallLog) ...[
                  Icon(badgeIcon, size: 14, color: badgeColor),
                  const SizedBox(width: 4),
                ],
                Expanded(
                  child: Text(
                    // ⭐ V7 — aperçu typé (Appel X terminé / vocal / photo…)
                    isCallLog
                        ? badgeLabel
                        : conv.lastMessagePreviewLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: isCallLog ? badgeColor : Colors.grey[600],
                      fontWeight: isCallLog && (conv.lastMessageCallStatus == 'missed' || conv.lastMessageCallStatus == 'declined') ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
              ],
            ),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_formatTimestamp(conv.lastMessageAt), style: TextStyle(fontSize: 11, color: conv.unreadCount > 0 ? const Color(0xFF1677FF) : Colors.grey[500])),
                if (conv.unreadCount > 0) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [HelmColors.primaryVivid, HelmColors.gold]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      conv.unreadCount > 99 ? '99+' : '${conv.unreadCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ],
            ),
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: conv)))
                  .then((_) => _loadConversations()); // ⭐ V7 — refresh au retour (badges à jour)
            },
          );
        },
      ),
    );
  }

  // Paramètres
  Widget _buildParametresBody() {
    return Container(
      color: HelmColors.background,
      child: Column(
        children: [
          const HelmSectionHeader(
            title: 'Paramètres',
            subtitle: 'PROFIL + PRÉFÉRENCES',
          ),
          Expanded(
            child: ListView(
              children: [
                ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: HelmColors.primary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.person, color: HelmColors.primary),
                  ),
                  title: const Text('Profil'),
                  subtitle: Text(_currentUser?.fullName ?? 'Utilisateur'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Profil — bientôt disponible')),
                    );
                  },
                ),
                ListTile(
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: HelmColors.danger.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.logout, color: HelmColors.danger),
                  ),
                  title: const Text('Déconnexion'),
                  subtitle: const Text('Se déconnecter de Helm Connect'),
                  onTap: _logout,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
