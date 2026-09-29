// ============================================================================
// GROUP MEMBERS SCREEN — Écran membres & gestion des groupes (V5)
// ============================================================================
// ⭐ V5 — parité web du panneau membres (MembrePanel de WhatsAppChat.tsx) :
//
//   Onglet « Membres » :
//     - liste complète (rôle conversation, rôle système, présence réelle,
//       email, avatar) via GET /chat/conversations/:id/members
//     - actions par membre (admin) : écrire en privé, promouvoir/rétrograder
//       (ADMIN | MODERATOR | MEMBER), exclure, bannir/débanir, muet/dé-muet
//     - quitter le groupe (POST /chat/conversations/:id/leave)
//
//   Onglet « Ajouter » :
//     - recherche des membres du tenant absents de la conversation
//       (GET /chat/conversations/:id/invitable?q=)
//     - sélection multiple + ajout (POST /chat/conversations/:id/add-members)
//
// Les droits sont vérifiés via GET /chat/conversations/:id/my-permissions :
// seuls les actions permises s'affichent.
// ============================================================================
import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/helm_theme.dart';
import 'conversation_detail_screen.dart';

class GroupMembersScreen extends StatefulWidget {
  final Conversation conversation;

  /// Appelé après toute modification (ajout/exclusion/rôle) pour que le
  /// parent rafraîchisse la conversation (nom, nombre de membres…).
  final void Function()? onChanged;

  const GroupMembersScreen({
    super.key,
    required this.conversation,
    this.onChanged,
  });

  @override
  State<GroupMembersScreen> createState() => _GroupMembersScreenState();
}

class _GroupMembersScreenState extends State<GroupMembersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _invitable = [];
  bool _loading = true;
  bool _loadingInvitable = false;
  String? _error;
  Map<String, dynamic>? _myPermissions;
  String _currentUserId = '';
  String _searchQuery = '';
  Timer? _searchDebounce;
  final Set<String> _selectedInviteIds = {};
  final Set<String> _alreadyInvited = {};

  bool get _iAmAdmin {
    if (_currentUserId.isEmpty) return false;
    final mine = _members.where((m) => m['userId'] == _currentUserId).toList();
    if (mine.isNotEmpty) {
      final role = (mine.first['role'] as String?)?.toUpperCase() ?? '';
      if (role == 'ADMIN') return true;
    }
    final perms = _myPermissions;
    if (perms != null) {
      final effectiveRole = (perms['role'] as String?)?.toUpperCase() ?? '';
      if (effectiveRole == 'ADMIN') return true;
      return perms['isAdmin'] == true;
    }
    return false;
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.index == 1 && _invitable.isEmpty && !_loadingInvitable) {
      _loadInvitable();
    }
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      final userId = await AuthService.getUserId() ?? '';
      _currentUserId = userId;
      final results = await Future.wait([
        ApiService.getConversationMembers(widget.conversation.id),
        _iAmAdminPrecheck(userId),
      ]);
      final members = results[0] as List<Map<String, dynamic>>;
      final perms = results[1] as Map<String, dynamic>?;
      if (!mounted) return;
      setState(() {
        _members = members;
        _myPermissions = perms;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<Map<String, dynamic>?> _iAmAdminPrecheck(String userId) async {
    try {
      return await ApiService.getMyPermissions(widget.conversation.id);
    } catch (_) {
      return null;
    }
  }

  Future<void> _loadInvitable({String? query}) async {
    setState(() => _loadingInvitable = true);
    try {
      final users = await ApiService.getInvitableMembers(
        widget.conversation.id,
        query: query ?? _searchQuery,
      );
      if (mounted) {
        setState(() {
          _invitable = users;
          _loadingInvitable = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _invitable = [];
          _loadingInvitable = false;
        });
      }
    }
  }

  void _onSearchChanged(String value) {
    _searchQuery = value;
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      _loadInvitable(query: value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HelmColors.background,
      appBar: AppBar(
        backgroundColor: HelmColors.primary,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.conversation.displayName,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            Text(
              '${_members.length} membres',
              style: TextStyle(
                fontSize: 12,
                color: HelmColors.goldLight.withOpacity(0.85),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Rafraîchir',
            onPressed: _loadAll,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: HelmColors.goldLight,
          unselectedLabelColor: Colors.white70,
          indicatorColor: HelmColors.goldLight,
          tabs: const [
            Tab(text: 'Membres'),
            Tab(text: 'Ajouter'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: HelmColors.primary))
          : _error != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMembersTab(),
                    _buildInviteTab(),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: HelmColors.danger),
          const SizedBox(height: 12),
          Text(
            'Impossible de charger les membres',
            style: const TextStyle(color: HelmColors.text, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            _error ?? '',
            style: const TextStyle(color: HelmColors.textMuted, fontSize: 12),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: const Icon(Icons.refresh),
            label: const Text('Réessayer'),
            style: ElevatedButton.styleFrom(
              backgroundColor: HelmColors.primary,
              foregroundColor: Colors.white,
            ),
            onPressed: _loadAll,
          ),
        ],
      ),
    );
  }

  // ─── Onglet Membres ───────────────────────────────────────────────────────
  Widget _buildMembersTab() {
    return Column(
      children: [
        if (widget.conversation.description?.isNotEmpty == true)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: Text(
              widget.conversation.description!,
              style: const TextStyle(color: HelmColors.textMuted, fontSize: 12),
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: _members.length,
            itemBuilder: (context, i) => _buildMemberTile(_members[i]),
          ),
        ),
        // Quitter le groupe
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.logout, color: HelmColors.danger),
                label: const Text(
                  'Quitter le groupe',
                  style: TextStyle(color: HelmColors.danger),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: HelmColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _leaveGroup,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMemberTile(Map<String, dynamic> m) {
    final userId = m['userId'] as String? ?? '';
    final firstName = (m['firstName'] as String?) ?? '';
    final lastName = (m['lastName'] as String?) ?? '';
    final fullName = '$firstName $lastName'.trim().isNotEmpty
        ? '$firstName $lastName'.trim()
        : (m['email'] as String? ?? 'Utilisateur');
    final role = (m['role'] as String?)?.toUpperCase() ?? 'MEMBER';
    final userRole = (m['userRole'] as String?) ?? '';
    final isOnline = m['isOnline'] == true;
    final isMe = userId == _currentUserId;
    final customStatus = m['customStatus'] as String?;

    return ListTile(
      onTap: () => _showMemberActions(m),
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: _avatarColor(fullName),
            backgroundImage: (m['avatarUrl'] as String?) != null &&
                    (m['avatarUrl'] as String).isNotEmpty
                ? NetworkImage(m['avatarUrl'] as String)
                : null,
            child: (m['avatarUrl'] == null || (m['avatarUrl'] as String).isEmpty)
                ? Text(
                    _initials(fullName),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : null,
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 13,
              height: 13,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOnline ? HelmColors.success : Colors.grey.shade400,
                border: Border.all(color: Colors.white, width: 2.5),
              ),
            ),
          ),
        ],
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              isMe ? 'Vous' : fullName,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: HelmColors.text,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 6),
          _buildRoleBadge(role),
        ],
      ),
      subtitle: Text(
        customStatus?.isNotEmpty == true
            ? customStatus!
            : (userRole.isNotEmpty ? _systemRoleLabel(userRole) : (m['email'] as String? ?? '')),
        style: const TextStyle(color: HelmColors.textMuted, fontSize: 12),
        overflow: TextOverflow.ellipsis,
      ),
      trailing: PopupMenuButton<String>(
        onSelected: (action) => _handleMemberAction(action, m),
        itemBuilder: (context) => _memberActions(m),
        icon: const Icon(Icons.more_vert, color: HelmColors.textMuted),
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    Color color;
    String label;
    switch (role) {
      case 'ADMIN':
        color = HelmColors.gold;
        label = 'Admin';
        break;
      case 'MODERATOR':
        color = HelmColors.primaryVivid;
        label = 'Modérateur';
        break;
      default:
        color = Colors.grey;
        label = 'Membre';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  String _systemRoleLabel(String role) {
    switch (role.toUpperCase()) {
      case 'TEACHER':
        return 'Enseignant';
      case 'PARENT':
        return 'Parent';
      case 'DIRECTOR':
        return 'Directeur';
      case 'PROMOTER':
        return 'Promoteur';
      case 'STUDENT':
        return 'Élève';
      case 'SUPER_ADMIN':
        return 'Super administrateur';
      default:
        return role;
    }
  }

  List<PopupMenuEntry<String>> _memberActions(Map<String, dynamic> m) {
    final entries = <PopupMenuEntry<String>>[];
    final userId = m['userId'] as String? ?? '';
    final isMe = userId == _currentUserId;
    final targetRole = (m['role'] as String?)?.toUpperCase() ?? 'MEMBER';

    if (!isMe) {
      entries.add(const PopupMenuItem(
        value: 'dm',
        child: ListTile(
          leading: Icon(Icons.chat_bubble_outline, size: 20),
          title: Text('Écrire en privé', style: TextStyle(fontSize: 14)),
          contentPadding: EdgeInsets.zero,
          dense: true,
        ),
      ));
    }

    if (_iAmAdmin && !isMe) {
      entries.add(const PopupDivider());
      if (targetRole != 'ADMIN') {
        entries.add(const PopupMenuItem(
          value: 'promote_admin',
          child: ListTile(
            leading: Icon(Icons.shield_outlined, size: 20),
            title: Text('Promouvoir administrateur', style: TextStyle(fontSize: 14)),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ));
      }
      if (targetRole != 'MODERATOR') {
        entries.add(const PopupMenuItem(
          value: 'promote_moderator',
          child: ListTile(
            leading: Icon(Icons.security_outlined, size: 20),
            title: Text('Promouvoir modérateur', style: TextStyle(fontSize: 14)),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ));
      }
      if (targetRole != 'MEMBER') {
        entries.add(const PopupMenuItem(
          value: 'demote',
          child: ListTile(
            leading: Icon(Icons.person_outline, size: 20),
            title: Text('Rétablir en membre', style: TextStyle(fontSize: 14)),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ));
      }
      entries.add(const PopupDivider());
      entries.add(const PopupMenuItem(
        value: 'mute',
        child: ListTile(
          leading: Icon(Icons.volume_off_outlined, size: 20),
          title: Text('Rendre muet', style: TextStyle(fontSize: 14)),
          contentPadding: EdgeInsets.zero,
          dense: true,
        ),
      ));
      entries.add(const PopupMenuItem(
        value: 'kick',
        child: ListTile(
          leading: Icon(Icons.person_remove_outlined, size: 20),
          title: Text('Exclure du groupe', style: TextStyle(fontSize: 14)),
          contentPadding: EdgeInsets.zero,
          dense: true,
        ),
      ));
      entries.add(const PopupMenuItem(
        value: 'ban',
        child: ListTile(
          leading: Icon(Icons.block_outlined, size: 20),
          title: Text('Bannir', style: TextStyle(fontSize: 14)),
          contentPadding: EdgeInsets.zero,
          dense: true,
        ),
      ));
    }
    return entries;
  }

  Future<void> _showMemberActions(Map<String, dynamic> m) async {
    final actions = _memberActions(m);
    if (actions.isEmpty) return;
    final firstName = (m['firstName'] as String?) ?? '';
    final lastName = (m['lastName'] as String?) ?? '';
    final fullName = '$firstName $lastName'.trim().isNotEmpty
        ? '$firstName $lastName'.trim()
        : 'ce membre';
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                fullName,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: HelmColors.text,
                ),
              ),
            ),
            ...actions.map((e) {
              if (e is PopupMenuItem<String>) {
                final value = e.value;
                final child = e.child;
                return ListTile(
                  title: child,
                  onTap: () => Navigator.of(context).pop(value),
                );
              }
              return const Divider(height: 1);
            }),
          ],
        ),
      ),
    );
    if (choice != null) _handleMemberAction(choice, m);
  }

  Future<void> _handleMemberAction(String action, Map<String, dynamic> m) async {
    final userId = m['userId'] as String? ?? '';
    final firstName = (m['firstName'] as String?) ?? '';
    final lastName = (m['lastName'] as String?) ?? '';
    final fullName = '$firstName $lastName'.trim().isNotEmpty
        ? '$firstName $lastName'.trim()
        : 'ce membre';

    try {
      switch (action) {
        case 'dm':
          await _openDirectMessage(userId);
          break;
        case 'promote_admin':
          await ApiService.setMemberRole(widget.conversation.id, userId, 'ADMIN');
          _toast('$fullName est maintenant administrateur');
          _loadAll();
          break;
        case 'promote_moderator':
          await ApiService.setMemberRole(widget.conversation.id, userId, 'MODERATOR');
          _toast('$fullName est maintenant modérateur');
          _loadAll();
          break;
        case 'demote':
          await ApiService.setMemberRole(widget.conversation.id, userId, 'MEMBER');
          _toast('$fullName est maintenant simple membre');
          _loadAll();
          break;
        case 'mute':
          await ApiService.muteMember(widget.conversation.id, userId);
          _toast('$fullName ne peut plus écrire dans le groupe');
          _loadAll();
          break;
        case 'kick':
          final ok = await _confirm('Exclure $fullName du groupe ?');
          if (ok != true) return;
          await ApiService.kickMember(widget.conversation.id, userId);
          _toast('$fullName a été exclu');
          _loadAll();
          widget.onChanged?.call();
          break;
        case 'ban':
          final ok = await _confirm('Bannir $fullName ? Il ne pourra plus être réinvité directement.');
          if (ok != true) return;
          await ApiService.banMember(widget.conversation.id, userId);
          _toast('$fullName a été banni');
          _loadAll();
          widget.onChanged?.call();
          break;
      }
    } catch (e) {
      _toast('Échec : ${_friendlyError(e)}', isError: true);
    }
  }

  Future<void> _openDirectMessage(String userId) async {
    try {
      final convJson = await ApiService.createDirectConversation(userId);
      final conv = Conversation.fromJson(convJson);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ConversationDetailScreen(conversation: conv),
        ),
      );
    } catch (e) {
      _toast("Impossible d'ouvrir la conversation privée : ${_friendlyError(e)}",
          isError: true);
    }
  }

  Future<void> _leaveGroup() async {
    final ok = await _confirm('Quitter « ${widget.conversation.displayName} » ?');
    if (ok != true) return;
    try {
      await ApiService.leaveConversation(widget.conversation.id);
      if (!mounted) return;
      _toast('Vous avez quitté le groupe');
      // Pop group members screen + conversation screen
      Navigator.of(context).pop();
      widget.onChanged?.call();
    } catch (e) {
      _toast('Échec : ${_friendlyError(e)}', isError: true);
    }
  }

  // ─── Onglet Ajouter ───────────────────────────────────────────────────────
  Widget _buildInviteTab() {
    final canInvite = _iAmAdmin || _myPermissions?['canInvite'] == true;
    if (!canInvite) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline, size: 44, color: HelmColors.textMuted),
              SizedBox(height: 12),
              Text(
                "Seuls les administrateurs peuvent ajouter des membres à ce groupe",
                textAlign: TextAlign.center,
                style: TextStyle(color: HelmColors.textMuted),
              ),
            ],
          ),
        ),
      );
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Rechercher des membres à ajouter…',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
            ),
          ),
        ),
        Expanded(
          child: _loadingInvitable
              ? const Center(
                  child: CircularProgressIndicator(color: HelmColors.primary))
              : _invitable.isEmpty
                  ? const Center(
                      child: Text(
                        'Aucun membre à inviter',
                        style: TextStyle(color: HelmColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(8),
                      itemCount: _invitable.length,
                      itemBuilder: (context, i) {
                        final u = _invitable[i];
                        final userId = u['id'] as String? ?? u['userId'] as String? ?? '';
                        final firstName = (u['firstName'] as String?) ?? '';
                        final lastName = (u['lastName'] as String?) ?? '';
                        final fullName = '$firstName $lastName'.trim().isNotEmpty
                            ? '$firstName $lastName'.trim()
                            : (u['email'] as String? ?? 'Utilisateur');
                        final alreadyInvited = _alreadyInvited.contains(userId);
                        final selected = _selectedInviteIds.contains(userId);
                        return CheckboxListTile(
                          value: selected,
                          onChanged: alreadyInvited
                              ? null
                              : (v) => setState(() {
                                    if (v == true) {
                                      _selectedInviteIds.add(userId);
                                    } else {
                                      _selectedInviteIds.remove(userId);
                                    }
                                  }),
                          secondary: CircleAvatar(
                            backgroundColor: _avatarColor(fullName),
                            child: Text(
                              _initials(fullName),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          title: Text(
                            fullName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: HelmColors.text,
                            ),
                          ),
                          subtitle: Text(
                            u['email'] as String? ?? '',
                            style:
                                const TextStyle(color: HelmColors.textMuted, fontSize: 12),
                          ),
                          activeColor: HelmColors.primary,
                        );
                      },
                    ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.person_add_alt),
                label: Text(
                  _selectedInviteIds.isEmpty
                      ? 'Ajouter des membres'
                      : 'Ajouter (${_selectedInviteIds.length})',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: HelmColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed:
                    _selectedInviteIds.isEmpty ? null : _addSelectedMembers,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _addSelectedMembers() async {
    if (_selectedInviteIds.isEmpty) return;
    try {
      await ApiService.addMembersToConversation(
        widget.conversation.id,
        _selectedInviteIds.toList(),
      );
      if (!mounted) return;
      _toast('${_selectedInviteIds.length} membre(s) ajouté(s)');
      _alreadyInvited.addAll(_selectedInviteIds);
      _selectedInviteIds.clear();
      await _loadAll();
      await _loadInvitable();
      widget.onChanged?.call();
    } catch (e) {
      _toast("Échec de l'ajout : ${_friendlyError(e)}", isError: true);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  void _toast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? HelmColors.danger : HelmColors.primary,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<bool?> _confirm(String message) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmation'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Confirmer',
              style: TextStyle(color: HelmColors.danger),
            ),
          ),
        ],
      ),
    );
  }

  String _friendlyError(Object e) {
    final s = e.toString();
    if (s.contains('403')) return "vous n'avez pas les droits nécessaires";
    if (s.contains('404')) return 'introuvable';
    if (s.contains('400')) return 'requête invalide';
    return s.length > 120 ? s.substring(0, 120) : s;
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  Color _avatarColor(String name) {
    final hash = name.hashCode.abs();
    final hue = (hash % 360).toDouble();
    return HSLColor.fromAHSL(1, hue, 0.5, 0.4).toColor();
  }
}

/// Séparateur réutilisable dans les menus.
class PopupDivider extends PopupMenuDivider {
  const PopupDivider({super.key, super.height = 8});
}
