// ============================================================================
// HELM CONNECT — Main Chat Screen (Discord-like structure, V3-10)
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
import '../models/models.dart';
import '../services/api_service.dart';
import 'conversation_detail_screen.dart';
import 'announcements_screen.dart';
import 'notification_prefs_screen.dart';
import 'global_search_screen.dart';

// ⭐ V3-10: 12 sections Helm Connect (conformes à la spec)
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

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
    _loadConversations();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadConversations());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
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
    await ApiService.logout();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    }
  }

  // ⭐ V3-10: Section metadata (icon, label, color)
  static const _sections = <HelmConnectSection, ({IconData icon, String label, Color color})>{
    HelmConnectSection.discussions: (icon: Icons.chat, label: 'Discussions', color: Color(0xFF1677FF)),
    HelmConnectSection.communautes: (icon: Icons.groups, label: 'Communautés', color: Color(0xFF10B981)),
    HelmConnectSection.annonces: (icon: Icons.campaign, label: 'Annonces', color: Color(0xFFF59E0B)),
    HelmConnectSection.canaux: (icon: Icons.radio, label: 'Canaux', color: Color(0xFF8B5CF6)),
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
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0A2A5E), Color(0xFF1C6FE8)],
            ),
          ),
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
                  style: const TextStyle(fontSize: 10, color: Color(0xFFBBDEFB)),
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
          ? FloatingActionButton(
              onPressed: () {
                // TODO: new conversation
              },
              backgroundColor: const Color(0xFF0A2A5E),
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  // ⭐ Discord-like drawer with 12 sections
  Widget _buildDrawer() {
    return Drawer(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0A2A5E), Color(0xFF114FC4)],
          ),
        ),
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
                            Text('Connect', style: TextStyle(color: Color(0xFFF5B335), fontSize: 18, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Text('Communiquez • Collaborez', style: TextStyle(color: Color(0xFFBBDEFB), fontSize: 9, letterSpacing: 1)),
                      ],
                    ),
                  ],
                ),
              ),
              const Divider(color: Color(0xFF1C6FE8), height: 1),
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
              const Divider(color: Color(0xFF1C6FE8), height: 1),
              ListTile(
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF1C6FE8),
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
      case HelmConnectSection.annonces:
        return _buildAnnoncesBody();
      case HelmConnectSection.recherche:
        return _buildRechercheBody();
      case HelmConnectSection.notifications:
        return _buildNotificationsBody();
      case HelmConnectSection.parametres:
        return _buildParametresBody();
      case HelmConnectSection.communautes:
      case HelmConnectSection.canaux:
      case HelmConnectSection.fichiers:
      case HelmConnectSection.vocaux:
      case HelmConnectSection.appels:
      case HelmConnectSection.moderation:
      case HelmConnectSection.analytics:
        return _buildPlaceholderBody();
    }
  }

  // Discussions — liste des conversations (existing code)
  Widget _buildDiscussionsBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0A2A5E)));
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
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
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 16),
            const Text('Aucune conversation', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF172033))),
            const SizedBox(height: 4),
            const Text('Démarrez une nouvelle conversation avec le bouton +', style: TextStyle(fontSize: 13, color: Color(0xFF667085))),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadConversations,
      child: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (context, index) {
          final conv = _conversations[index];
          final displayName = conv.type == 'GROUP'
              ? (conv.name ?? 'Groupe')
              : (conv.participants.isNotEmpty
                  ? conv.participants.firstWhere((p) => p.userId != _currentUser?.id, orElse: () => conv.participants.first).fullName
                  : 'Conversation');
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: conv.type == 'GROUP' ? const Color(0xFF10B981) : const Color(0xFF1677FF),
              child: conv.type == 'GROUP'
                  ? const Icon(Icons.group, color: Colors.white, size: 20)
                  : Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
            title: Text(displayName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            subtitle: Text(
              conv.lastMessagePreview ?? 'Aucun message',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: Colors.grey[600]),
            ),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_formatTimestamp(conv.lastMessageAt), style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                if (conv.unreadCount > 0) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFF1677FF), borderRadius: BorderRadius.circular(10)),
                    child: Text(
                      '${conv.unreadCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ],
            ),
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => ConversationDetailScreen(conversation: conv)));
            },
          );
        },
      ),
    );
  }

  // Annonces
  Widget _buildAnnoncesBody() {
    return const AnnouncementsScreen();
  }

  // Recherche
  Widget _buildRechercheBody() {
    return const GlobalSearchScreen();
  }

  // Notifications
  Widget _buildNotificationsBody() {
    return const NotificationPrefsScreen();
  }

  // Paramètres
  Widget _buildParametresBody() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.settings, size: 64, color: Color(0xFF64748B)),
          const SizedBox(height: 16),
          const Text('Paramètres', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          ListTile(
            leading: const Icon(Icons.person, color: Color(0xFF1677FF)),
            title: const Text('Profil'),
            onTap: () { /* TODO: profile screen */ },
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Déconnexion'),
            onTap: _logout,
          ),
        ],
      ),
    );
  }

  // Placeholder for sections not yet implemented
  Widget _buildPlaceholderBody() {
    final info = _sections[_activeSection]!;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(info.icon, size: 64, color: info.color.withOpacity(0.5)),
          const SizedBox(height: 16),
          Text(info.label, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: info.color)),
          const SizedBox(height: 8),
          const Text('Bientôt disponible', style: TextStyle(fontSize: 14, color: Color(0xFF667085))),
        ],
      ),
    );
  }
}
