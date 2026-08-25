// ============================================================================
// HELM CONNECT — Global Search Screen (mobile)
// ============================================================================
// Recherche transversale : Messages · Personnes · Groupes · Fichiers · Annonces
// ============================================================================

import 'package:flutter/material.dart';
import '../services/api_service.dart';

class GlobalSearchScreen extends StatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  State<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends State<GlobalSearchScreen> {
  final _searchController = TextEditingController();
  Map<String, dynamic>? _results;
  bool _loading = false;
  String _activeTab = 'all';

  @override
  void initState() {
    super.initState();
    _search();
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.length < 2) {
      setState(() => _results = null);
      return;
    }
    setState(() => _loading = true);
    try {
      final data = await ApiService.globalSearch(query);
      setState(() {
        _results = data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Rechercher dans Yeshua Connect...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: Colors.white70),
          ),
          style: const TextStyle(color: Colors.white),
          onChanged: (_) {
            Future.delayed(const Duration(milliseconds: 300), _search);
          },
        ),
      ),
      body: Column(
        children: [
          // Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                _buildTab('all', 'Tout'),
                _buildTab('message', 'Messages'),
                _buildTab('person', 'Personnes'),
                _buildTab('group', 'Groupes'),
                _buildTab('file', 'Fichiers'),
                _buildTab('announcement', 'Annonces'),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _results == null || _results!['total'] == 0
                    ? const Center(child: Text('Aucun résultat'))
                    : _buildResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildTab(String key, String label) {
    final isActive = _activeTab == key;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: ChoiceChip(
        label: Text(label),
        selected: isActive,
        selectedColor: const Color(0xFF1677FF),
        onSelected: (_) {
          setState(() => _activeTab = key);
        },
      ),
    );
  }

  Widget _buildResults() {
    return ListView(
      children: [
        if (_activeTab == 'all' || _activeTab == 'message') ..._buildSection('Messages', (_results!['messages'] as List).cast<Map<String, dynamic>>(), _buildMessageItem),
        if (_activeTab == 'all' || _activeTab == 'person') ..._buildSection('Personnes', (_results!['people'] as List).cast<Map<String, dynamic>>(), _buildPersonItem),
        if (_activeTab == 'all' || _activeTab == 'group') ..._buildSection('Groupes', (_results!['groups'] as List).cast<Map<String, dynamic>>(), _buildGroupItem),
        if (_activeTab == 'all' || _activeTab == 'file') ..._buildSection('Fichiers', (_results!['files'] as List).cast<Map<String, dynamic>>(), _buildFileItem),
        if (_activeTab == 'all' || _activeTab == 'announcement') ..._buildSection('Annonces', (_results!['announcements'] as List).cast<Map<String, dynamic>>(), _buildAnnouncementItem),
      ],
    );
  }

  List<Widget> _buildSection(String title, List<Map<String, dynamic>> items, Widget Function(Map<String, dynamic>) builder) {
    if (items.isEmpty) return [];
    return [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: const Color(0xFFF5F7FA),
        child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
      ),
      ...items.take(10).map(builder),
      const Divider(height: 1),
    ];
  }

  Widget _buildMessageItem(Map<String, dynamic> m) {
    return ListTile(
      leading: const Icon(Icons.message, color: Color(0xFF1677FF)),
      title: Text(m['senderName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      subtitle: Text(m['content'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
      onTap: () => _openConversation(m['conversationId'] as String),
    );
  }

  Widget _buildPersonItem(Map<String, dynamic> p) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFE6F4FF),
        child: Text('${p['firstName']?[0] ?? ''}${p['lastName']?[0] ?? ''}'.toUpperCase(), style: const TextStyle(color: Color(0xFF0958D9), fontWeight: FontWeight.bold)),
      ),
      title: Text('${p['firstName']} ${p['lastName']}'),
      subtitle: Text(p['email'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: p['isSameTenant'] == true ? const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 16) : null,
    );
  }

  Widget _buildGroupItem(Map<String, dynamic> g) {
    return ListTile(
      leading: const CircleAvatar(child: Icon(Icons.group, color: Colors.white), backgroundColor: Color(0xFF13C2C2)),
      title: Text(g['name'] ?? ''),
      subtitle: Text('${g['participantCount']} participants'),
      onTap: () => _openConversation(g['id'] as String),
    );
  }

  Widget _buildFileItem(Map<String, dynamic> f) {
    return ListTile(
      leading: const Icon(Icons.attach_file, color: Color(0xFFF59E0B)),
      title: Text(f['attachmentName'] ?? 'Fichier', maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text('${f['conversationName']} · ${f['senderName']}'),
      onTap: () => _openConversation(f['conversationId'] as String),
    );
  }

  Widget _buildAnnouncementItem(Map<String, dynamic> a) {
    final priority = a['priority'] as String? ?? 'NORMAL';
    return ListTile(
      leading: const Icon(Icons.campaign, color: Color(0xFFDC2626)),
      title: Text(a['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(a['body'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: Text(priority, style: TextStyle(fontSize: 10, color: priority == 'URGENT' ? const Color(0xFFDC2626) : const Color(0xFF667085))),
    );
  }

  void _openConversation(String conversationId) {
    // V2: fetch conversation details then navigate
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Ouverture conversation $conversationId')),
    );
  }
}
