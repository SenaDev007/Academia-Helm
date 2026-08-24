// ============================================================================
// HELM CONNECT — Notification Preferences Screen (mobile)
// ============================================================================
// Mode silencieux (DND) 1h/8h/24h/∞ + filtres par type + quiet hours.
// ============================================================================

import 'package:flutter/material.dart';
import '../services/api_service.dart';

class NotificationPrefsScreen extends StatefulWidget {
  const NotificationPrefsScreen({super.key});

  @override
  State<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends State<NotificationPrefsScreen> {
  bool _dndEnabled = false;
  DateTime? _dndUntil;
  bool _enableMessages = true;
  bool _enableGroupMessages = true;
  bool _enableAnnouncements = true;
  bool _enableMentions = true;
  bool _enableFiles = true;
  bool _enableInvitations = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    try {
      final userId = await AuthService.getUserId();
      final data = await ApiService.get('/api/chat/v2/notifications/preferences?userId=$userId');
      setState(() {
        _dndEnabled = data['dndEnabled'] as bool? ?? false;
        if (data['dndUntil'] != null) {
          _dndUntil = DateTime.parse(data['dndUntil'] as String);
        }
        _enableMessages = data['enableMessages'] as bool? ?? true;
        _enableGroupMessages = data['enableGroupMessages'] as bool? ?? true;
        _enableAnnouncements = data['enableAnnouncements'] as bool? ?? true;
        _enableMentions = data['enableMentions'] as bool? ?? true;
        _enableFiles = data['enableFiles'] as bool? ?? true;
        _enableInvitations = data['enableInvitations'] as bool? ?? true;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _enableDnd(String duration) async {
    try {
      final userId = await AuthService.getUserId();
      await ApiService.post('/api/chat/v2/notifications/dnd/enable', {
        'userId': userId,
        'duration': duration,
        'exceptions': ['ANNOUNCEMENT'],
      });
      await _loadPrefs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Mode silencieux activé ($duration)')),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
    }
  }

  Future<void> _disableDnd() async {
    try {
      final userId = await AuthService.getUserId();
      await ApiService.post('/api/chat/v2/notifications/dnd/disable', {'userId': userId});
      await _loadPrefs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mode silencieux désactivé')),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
    }
  }

  Future<void> _updatePref(String key, bool value) async {
    try {
      final userId = await AuthService.getUserId();
      await ApiService.put('/api/chat/v2/notifications/preferences', {
        'userId': userId,
        key: value,
      });
      await _loadPrefs();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur : $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // DND Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.nightlight_round, color: Color(0xFF1677FF)),
                      SizedBox(width: 12),
                      Text('Mode silencieux', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Bloque toutes les notifications sauf les annonces',
                    style: TextStyle(fontSize: 12, color: Color(0xFF667085)),
                  ),
                  const SizedBox(height: 16),
                  if (_dndEnabled) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.do_not_disturb_on, color: Color(0xFF1E40AF)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _dndUntil != null
                                  ? 'Jusqu\'à ${_dndUntil!.hour.toString().padLeft(2, '0')}:${_dndUntil!.minute.toString().padLeft(2, '0')}'
                                  : 'Jusqu\'à réactivation',
                              style: const TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton(onPressed: _disableDnd, child: const Text('Désactiver', style: TextStyle(color: Color(0xFFDC2626)))),
                        ],
                      ),
                    ),
                  ] else ...[
                    Row(
                      children: [
                        Expanded(child: ElevatedButton(onPressed: () => _enableDnd('1H'), child: const Text('1h'))),
                        const SizedBox(width: 8),
                        Expanded(child: ElevatedButton(onPressed: () => _enableDnd('8H'), child: const Text('8h'))),
                        const SizedBox(width: 8),
                        Expanded(child: ElevatedButton(onPressed: () => _enableDnd('24H'), child: const Text('24h'))),
                        const SizedBox(width: 8),
                        Expanded(child: ElevatedButton(onPressed: () => _enableDnd('FOREVER'), child: const Text('∞'))),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Event types
          Card(
            child: Column(
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.notifications_active, color: Color(0xFF1677FF)),
                      SizedBox(width: 12),
                      Text('Types d\'événements', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                _buildSwitchTile('Messages privés', _enableMessages, (v) => _updatePref('enableMessages', v)),
                _buildSwitchTile('Messages de groupe', _enableGroupMessages, (v) => _updatePref('enableGroupMessages', v)),
                _buildSwitchTile('Annonces officielles', _enableAnnouncements, (v) => _updatePref('enableAnnouncements', v)),
                _buildSwitchTile('Mentions', _enableMentions, (v) => _updatePref('enableMentions', v)),
                _buildSwitchTile('Fichiers', _enableFiles, (v) => _updatePref('enableFiles', v)),
                _buildSwitchTile('Invitations', _enableInvitations, (v) => _updatePref('enableInvitations', v)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile(String title, bool value, ValueChanged<bool> onChanged) {
    return SwitchListTile(
      title: Text(title),
      value: value,
      activeColor: const Color(0xFF1677FF),
      onChanged: onChanged,
    );
  }
}
