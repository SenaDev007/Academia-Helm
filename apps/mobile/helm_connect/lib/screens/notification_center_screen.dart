// ============================================================================
// HELM CONNECT — Notification Center Screen (mobile, V6)
// ============================================================================
// ⭐ V6 (parité web + audit mobile P0) : le centre de notifications n'existait
//    pas — la section « Notifications » du drawer montrait uniquement les
//    préférences DND. Toutes les méthodes API existaient déjà
//    (listNotifications, getUnreadNotificationCount, markNotificationRead,
//    markAllNotificationsRead) sans aucune UI.
//
//    Backend : GET /notifications (filtre userId), GET /notifications/unread-count,
//    POST /notifications/:id/read, POST /notifications/read-all.
// ============================================================================

import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/helm_theme.dart';
import 'notification_prefs_screen.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  int _unreadCount = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ApiService.listNotifications();
      int unread = 0;
      try {
        unread = await ApiService.getUnreadNotificationCount();
      } catch (_) {}
      if (mounted) {
        setState(() {
          _notifications = list;
          _unreadCount = unread;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _loading = false;
        });
      }
    }
  }

  Future<void> _markRead(String id) async {
    try {
      await ApiService.markNotificationRead(id);
    } catch (_) {}
    _load();
  }

  Future<void> _markAllRead() async {
    try {
      await ApiService.markAllNotificationsRead();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Toutes les notifications marquées comme lues')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impossible : $e')),
        );
      }
    }
    _load();
  }

  IconData _iconFor(String? type) {
    final t = (type ?? '').toUpperCase();
    if (t.contains('CALL')) return Icons.phone;
    if (t.contains('ANNOUNCE') || t.contains('BULLETIN')) return Icons.campaign;
    if (t.contains('ABSENCE')) return Icons.event_busy;
    if (t.contains('EXAM')) return Icons.school;
    if (t.contains('MENTION')) return Icons.alternate_email;
    if (t.contains('MESSAGE')) return Icons.chat;
    if (t.contains('SANCTION') || t.contains('DISCIPLINE')) return Icons.gavel;
    if (t.contains('PAYMENT') || t.contains('FEE')) return Icons.payments;
    return Icons.notifications;
  }

  Color _colorFor(String? priority) {
    final p = (priority ?? '').toUpperCase();
    if (p == 'URGENT' || p == 'HIGH') return const Color(0xFFDC2626);
    if (p == 'MEDIUM') return const Color(0xFFF59E0B);
    return const Color(0xFF1677FF);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          // ⭐ V6 — accès aux préférences (DND, heures calmes) depuis le centre
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.white),
            tooltip: 'Préférences de notification',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificationPrefsScreen()),
            ),
          ),
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Tout lire', style: TextStyle(color: Colors.white)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_off, size: 40, color: Color(0xFF94A3B8)),
                      const SizedBox(height: 8),
                      Text('Erreur : $_error', textAlign: TextAlign.center),
                      TextButton(onPressed: _load, child: const Text('Réessayer')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _notifications.isEmpty
                      ? ListView(
                          children: const [
                            SizedBox(height: 120),
                            Icon(Icons.notifications_none, size: 48, color: Color(0xFF94A3B8)),
                            SizedBox(height: 8),
                            Center(child: Text('Aucune notification')),
                          ],
                        )
                      : ListView.separated(
                          itemCount: _notifications.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final n = _notifications[i];
                            final isUnread = n['isRead'] != true;
                            final type = n['type'] as String?;
                            final title = (n['title'] as String?) ?? 'Notification';
                            final body = (n['body'] as String?) ?? '';
                            final createdAt = n['createdAt'] as String?;
                            final dt = createdAt != null ? DateTime.tryParse(createdAt) : null;
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: _colorFor(n['priority'] as String?).withOpacity(0.15),
                                child: Icon(
                                  _iconFor(type),
                                  color: _colorFor(n['priority'] as String?),
                                  size: 20,
                                ),
                              ),
                              title: Text(
                                title,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: isUnread ? FontWeight.bold : FontWeight.w500,
                                  color: const Color(0xFF172033),
                                ),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (body.isNotEmpty)
                                    Text(body, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                                  if (dt != null)
                                    Text(
                                      '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}',
                                      style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                    ),
                                ],
                              ),
                              trailing: isUnread
                                  ? Container(
                                      width: 10,
                                      height: 10,
                                      decoration: const BoxDecoration(
                                        color: HelmColors.primary,
                                        shape: BoxShape.circle,
                                      ),
                                    )
                                  : null,
                              tileColor: isUnread ? const Color(0xFFE6F4FF).withOpacity(0.4) : null,
                              onTap: () {
                                if (isUnread && n['id'] != null) {
                                  _markRead(n['id'] as String);
                                }
                                // Deep-link basique vers l'URL de la notification
                                final url = n['data'] is Map<String, dynamic>
                                    ? (n['data'] as Map<String, dynamic>)['url'] as String?
                                    : n['url'] as String?;
                                if (url != null && url.isNotEmpty && mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Ouvrir : $url')),
                                  );
                                }
                              },
                            );
                          },
                        ),
                ),
    );
  }
}
