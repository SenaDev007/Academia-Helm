/// Widgets réutilisables — tuile de canal, bulle de message (réactions +
/// sondage), carte d'événement (live/formation).
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../data/models/models.dart';
import 'screens.dart' show formatEventDate;

// ═══════════════════════ CANAL ═══════════════════════

class ChannelTile extends StatelessWidget {
  final CommunityChannel channel;
  final VoidCallback onTap;

  const ChannelTile({super.key, required this.channel, required this.onTap});

  String get _emoji {
    if (channel.groupKind == 'ADMINS') return '🛡️';
    if (channel.groupKind == 'TEACHERS') return '👨‍🏫';
    if (channel.groupKind == 'SALON') return '🏫';
    return channel.icon ?? '💬';
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
      leading: SizedBox(
        width: 40,
        height: 40,
        child: CircleAvatar(
          backgroundColor: channel.isSchool ? const Color(0xFF0B2F73) : const Color(0xFFE8EDF6),
          child: Text(_emoji, style: const TextStyle(fontSize: 17)),
        ),
      ),
      title: Text(
        channel.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 14.5,
          fontWeight: channel.unread > 0 ? FontWeight.w700 : FontWeight.w600,
          color: const Color(0xFF1E293B),
        ),
      ),
      subtitle: channel.preview != null
          ? Text(
              channel.preview!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                color: channel.unread > 0 ? const Color(0xFF0B2F73) : const Color(0xFF94A3B8),
                fontWeight: channel.unread > 0 ? FontWeight.w600 : FontWeight.w400,
              ),
            )
          : Text(
              channel.isGroup ? 'Groupe de l\u2019école' : channel.type == 'ANNOUNCEMENT' ? 'Annonces' : 'Discussion',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFFB0BCCC)),
            ),
      trailing: channel.unread > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFD4A73C),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                channel.unread > 99 ? '99+' : '${channel.unread}',
                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF0B2F73)),
              ),
            )
          : channel.type == 'ANNOUNCEMENT'
              ? const Icon(Icons.campaign_rounded, size: 15, color: Color(0xFFD4A73C))
              : null,
    );
  }
}

// ═══════════════════════ BULLE DE MESSAGE ═══════════════════════

const _reactionSet = ['👍', '❤️', '🎉', '👏', '💡', '🔥'];

class MessageBubble extends StatelessWidget {
  final CommunityMessage message;
  final void Function(String emoji) onReact;
  final VoidCallback onReply;
  final void Function(String optionId) onVote;

  const MessageBubble({
    super.key,
    required this.message,
    required this.onReact,
    required this.onReply,
    required this.onVote,
  });

  String _time(String iso) {
    try {
      return DateFormat('HH:mm', 'fr_FR').format(DateTime.parse(iso).toLocal());
    } catch (_) {
      return '';
    }
  }

  String _authorInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  Color _authorColor(String seed) {
    const palette = [Color(0xFF2563EB), Color(0xFF059669), Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFFD97706), Color(0xFF0891B2)];
    var h = 0;
    for (final c in seed.codeUnits) {
      h = (h * 31 + c) % 997;
    }
    return palette[h % palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final m = message;
    final isAnnouncement = m.type == 'ANNOUNCEMENT';
    final isTeam = m.authorRole == 'ADMIN' || m.authorRole == 'SUPER_ADMIN' || m.authorRole == 'MODERATOR';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: m.mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!m.mine) ...[
            CircleAvatar(
              radius: 15,
              backgroundColor: _authorColor(m.authorName),
              child: Text(_authorInitials(m.authorName), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _showActions(context),
              child: Column(
                crossAxisAlignment: m.mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (!m.mine)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 3),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(m.authorName, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                          if (isTeam) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(color: const Color(0xFF0B2F73), borderRadius: BorderRadius.circular(6)),
                              child: const Text('Équipe', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w700, color: Colors.white)),
                            ),
                          ],
                        ],
                      ),
                    ),
                  if (m.replyToContent != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2F8),
                        borderRadius: BorderRadius.circular(8),
                        border: Border(left: BorderSide(color: m.mine ? const Color(0xFF1D4FA5) : const Color(0xFF0B2F73), width: 2.5)),
                      ),
                      child: Text(
                        m.replyToContent!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ),
                  Container(
                    constraints: const BoxConstraints(maxWidth: 300),
                    padding: EdgeInsets.symmetric(
                      horizontal: isAnnouncement ? 14 : 13,
                      vertical: m.poll != null ? 12 : 9,
                    ),
                    decoration: BoxDecoration(
                      color: m.mine
                          ? const Color(0xFF0B2F73)
                          : isAnnouncement
                              ? const Color(0xFFFFF8E8)
                              : Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: Radius.circular(m.mine ? 16 : 4),
                        bottomRight: Radius.circular(m.mine ? 4 : 16),
                      ),
                      border: isAnnouncement && !m.mine ? Border.all(color: const Color(0xFFD4A73C), width: 1) : null,
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (m.poll != null)
                          PollView(poll: m.poll!, onVote: onVote)
                        else
                          Text(
                            m.content ?? '',
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.35,
                              color: m.mine ? Colors.white : const Color(0xFF1E293B),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (m.isPinned) const Icon(Icons.push_pin_rounded, size: 10, color: Color(0xFFD4A73C)),
                            if (m.isPinned) const SizedBox(width: 3),
                            Text(
                              _time(m.createdAt),
                              style: TextStyle(fontSize: 9.5, color: m.mine ? const Color(0x99FFFFFF) : const Color(0xFFA4B2C4)),
                            ),
                            if (m.isEdited) ...[
                              const SizedBox(width: 4),
                              Text(
                                'modifié',
                                style: TextStyle(fontSize: 9, fontStyle: FontStyle.italic, color: m.mine ? const Color(0x99FFFFFF) : const Color(0xFFA4B2C4)),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (m.reactions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
                      child: Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: m.reactions.entries.map((entry) {
                          final r = entry.value;
                          return GestureDetector(
                            onTap: () => onReact(r.emoji),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                              decoration: BoxDecoration(
                                color: r.mine ? const Color(0xFFFFF3D6) : const Color(0xFFEEF2F8),
                                borderRadius: BorderRadius.circular(10),
                                border: r.mine ? Border.all(color: const Color(0xFFD4A73C)) : null,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(r.emoji, style: const TextStyle(fontSize: 11)),
                                  const SizedBox(width: 3),
                                  Text('${r.count}', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (m.mine) const SizedBox(width: 6),
        ],
      ),
    );
  }

  void _showActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Réagir', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                children: _reactionSet
                    .map((emoji) => GestureDetector(
                          onTap: () {
                            onReact(emoji);
                            Navigator.pop(sheetContext);
                          },
                          child: Text(emoji, style: const TextStyle(fontSize: 26)),
                        ))
                    .toList(),
              ),
              const Divider(height: 24),
              ListTile(
                dense: true,
                leading: const Icon(Icons.reply_rounded, color: Color(0xFF0B2F73)),
                title: const Text('Répondre', style: TextStyle(fontSize: 14)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  onReply();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════ SONDAGE ═══════════════════════

class PollView extends StatelessWidget {
  final Poll poll;
  final void Function(String optionId) onVote;

  const PollView({super.key, required this.poll, required this.onVote});

  @override
  Widget build(BuildContext context) {
    final totalVotes = poll.options.fold(0, (acc, o) => acc + o.votes);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.poll_rounded, size: 14, color: Color(0xFF0B2F73)),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                poll.question,
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFF0B2F73)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...poll.options.map((o) {
          final pct = totalVotes > 0 ? (o.votes * 100 / totalVotes).round() : 0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: GestureDetector(
              onTap: () => onVote(o.id),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 34,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2F8),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Stack(
                      children: [
                        if (o.mine)
                          FractionallySizedBox(
                            widthFactor: pct / 100,
                            child: Container(color: const Color(0xFFFFE9B3)),
                          ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              o.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: o.mine ? FontWeight.w700 : FontWeight.w500,
                                color: const Color(0xFF1E293B),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(left: 10, top: 2),
                    child: Text(
                      '$pct% · ${o.votes} vote${o.votes > 1 ? 's' : ''}',
                      style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        Text('$totalVotes vote${totalVotes > 1 ? 's' : ''} au total', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
      ],
    );
  }
}

// ═══════════════════════ ÉVÉNEMENT ═══════════════════════

class EventCard extends StatelessWidget {
  final CommunityEvent event;

  const EventCard({super.key, required this.event});

  @override
  Widget build(BuildContext context) {
    final e = event;
    final kindInfo = switch (e.kind) {
      'FORMATION' => ('🎓', 'Formation', const Color(0xFF0B2F73)),
      'ATELIER' => ('🛠️', 'Atelier', const Color(0xFF0891B2)),
      _ => ('🔴', 'Live', const Color(0xFFDC2626)),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(kindInfo.$1, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: kindInfo.$3.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                  child: Text(kindInfo.$2, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kindInfo.$3)),
                ),
                const Spacer(),
                if (e.isLive)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.fiber_manual_record, size: 8, color: Colors.white),
                        SizedBox(width: 3),
                        Text('EN DIRECT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                      ],
                    ),
                  )
                else
                  Text(formatEventDate(e.scheduledAt), style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
              ],
            ),
            const SizedBox(height: 8),
            Text(e.title, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
            if (e.description != null) ...[
              const SizedBox(height: 3),
              Text(
                e.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.35),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(_audienceIcon(e), size: 12, color: const Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Expanded(child: Text(e.audienceLabel, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)))),
                if (e.externalUrl != null)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      foregroundColor: e.isLive ? const Color(0xFFDC2626) : const Color(0xFF0B2F73),
                    ),
                    onPressed: () => _openUrl(context, e.externalUrl!),
                    icon: Icon(e.isLive ? Icons.play_circle_rounded : Icons.open_in_new_rounded, size: 15),
                    label: Text(e.isLive ? 'Rejoindre' : 'Lien', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _audienceIcon(CommunityEvent e) {
    if (e.audience == 'GLOBAL') return Icons.public_rounded;
    if (e.audience == 'SCHOOL') return Icons.school_rounded;
    return Icons.group_rounded;
  }

  void _openUrl(BuildContext context, String url) {
    // Lien externe (YouTube/Meet/Zoom) — délégation au système.
    // url_launcher est volontairement absent des dépendances v1 ; ajout
    // direct possible sans refonte (cf. README section extensions).
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Lien : $url'), duration: const Duration(seconds: 4)),
    );
  }
}
