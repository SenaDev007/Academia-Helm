import 'package:flutter/material.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../providers/messages_provider.dart';

/// A card for a message list item.
///
/// Shows unread indicator (left border), title, sender, date,
/// type icon/badge, excerpt text, and attachment icon if has attachments.
class MessageCard extends StatelessWidget {
  const MessageCard({
    super.key,
    required this.message,
    this.onTap,
  });

  final Message message;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AHSpacing.lg,
        vertical: AHSpacing.xs,
      ),
      elevation: AHSpacing.elevationNone,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        side: BorderSide(
          color: message.isRead
              ? AHColors.lightOutline.withOpacity(0.5)
              : AHColors.navy.withOpacity(0.2),
          width: message.isRead ? 0.5 : 1.5,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AHSpacing.r12),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // ── Unread indicator bar ────────────────────────────────
              if (!message.isRead)
                Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: AHColors.navy,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(AHSpacing.r12),
                      bottomLeft: Radius.circular(AHSpacing.r12),
                    ),
                  ),
                ),

              // ── Content ─────────────────────────────────────────────
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AHSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Top row: Type badge + Date ───────────────────
                      Row(
                        children: [
                          // Type badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AHSpacing.sm,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: message.type.color.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(AHSpacing.r4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(message.type.icon, size: 12, color: message.type.color),
                                const SizedBox(width: 4),
                                Text(
                                  message.type.label,
                                  style: TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: message.type.color,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Spacer(),

                          // Unread dot
                          if (!message.isRead)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: AHSpacing.sm),
                              decoration: const BoxDecoration(
                                color: AHColors.navy,
                                shape: BoxShape.circle,
                              ),
                            ),

                          // Date
                          Text(
                            _formatMessageDate(message.date),
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              fontWeight: FontWeight.w400,
                              color: AHColors.grey500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AHSpacing.sm),

                      // ── Title ───────────────────────────────────────
                      Text(
                        message.title,
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: message.isRead ? FontWeight.w500 : FontWeight.w700,
                          color: AHColors.grey900,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AHSpacing.xs),

                      // ── Sender ──────────────────────────────────────
                      Row(
                        children: [
                          Icon(Icons.person_outline, size: 14, color: AHColors.grey500),
                          const SizedBox(width: AHSpacing.xs),
                          Expanded(
                            child: Text(
                              message.senderName,
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AHColors.grey600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AHSpacing.xs),

                      // ── Excerpt ─────────────────────────────────────
                      Text(
                        message.content.replaceAll('\n', ' '),
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                          color: AHColors.grey500,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      // ── Attachment indicator ────────────────────────
                      if (message.hasAttachments) ...[
                        const SizedBox(height: AHSpacing.sm),
                        Row(
                          children: [
                            Icon(
                              Icons.attach_file,
                              size: 14,
                              color: AHColors.grey500,
                            ),
                            const SizedBox(width: AHSpacing.xs),
                            Text(
                              '${message.attachments.length} pièce(s) jointe(s)',
                              style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: AHColors.grey500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // ── Chevron ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.only(right: AHSpacing.sm),
                child: Icon(
                  Icons.chevron_right,
                  color: AHColors.grey400,
                  size: AHSpacing.icon20,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatMessageDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return 'Aujourd\'hui';
    } else if (difference.inDays == 1) {
      return 'Hier';
    } else if (difference.inDays < 7) {
      return 'Il y a ${difference.inDays}j';
    } else {
      return AHFormatters.formatDateDisplay(date);
    }
  }
}
