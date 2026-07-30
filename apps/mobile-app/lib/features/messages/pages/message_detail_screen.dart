import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/error_widget.dart' as ah_error;
import '../providers/messages_provider.dart';

/// Screen showing full message content.
///
/// Features:
/// - Sender info row
/// - Title
/// - Date and type badge
/// - Full content text
/// - Attachments list with download buttons
/// - Auto mark as read on open
class MessageDetailScreen extends ConsumerStatefulWidget {
  const MessageDetailScreen({super.key, required this.messageId});

  final String messageId;

  @override
  ConsumerState<MessageDetailScreen> createState() => _MessageDetailScreenState();
}

class _MessageDetailScreenState extends ConsumerState<MessageDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Auto mark as read when opening
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final filter = ref.read(selectedMessageFilterProvider);
      ref.read(messagesListProvider(filter).notifier).markAsRead(widget.messageId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final messageAsync = ref.watch(messageDetailProvider(widget.messageId));

    return Scaffold(
      backgroundColor: AHColors.lightBackground,
      body: messageAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AHColors.navy),
        ),
        error: (error, _) => ah_error.AHErrorWidget(
          message: 'Impossible de charger le message.',
          onRetry: () => ref.invalidate(messageDetailProvider(widget.messageId)),
        ),
        data: (message) => _MessageDetailContent(message: message),
      ),
    );
  }
}

class _MessageDetailContent extends StatelessWidget {
  const _MessageDetailContent({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────────
          _MessageDetailHeader(type: message.type),

          // ── Message Body Card ───────────────────────────────────────
          Container(
            margin: const EdgeInsets.all(AHSpacing.lg),
            padding: const EdgeInsets.all(AHSpacing.lg),
            decoration: BoxDecoration(
              color: AHColors.white,
              borderRadius: BorderRadius.circular(AHSpacing.r16),
              boxShadow: [
                BoxShadow(
                  color: AHColors.navy.withOpacity(0.06),
                  offset: const Offset(0, 2),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Sender Row ────────────────────────────────────────
                Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: AHColors.navy.withOpacity(0.1),
                      child: Text(
                        _getInitials(message.senderName),
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AHColors.navy,
                        ),
                      ),
                    ),
                    const SizedBox(width: AHSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            message.senderName,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AHColors.grey900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            AHFormatters.formatDateDisplay(message.date),
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: AHColors.grey500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Type badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AHSpacing.sm,
                        vertical: AHSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: message.type.color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AHSpacing.r8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(message.type.icon, size: 14, color: message.type.color),
                          const SizedBox(width: 4),
                          Text(
                            message.type.label,
                            style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: message.type.color,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: AHSpacing.lg),
                const Divider(height: 1, color: AHColors.lightOutline),
                const SizedBox(height: AHSpacing.lg),

                // ── Title ─────────────────────────────────────────────
                Text(
                  message.title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AHColors.grey900,
                    height: 1.3,
                  ),
                ),

                const SizedBox(height: AHSpacing.lg),

                // ── Content ───────────────────────────────────────────
                Text(
                  message.content,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: AHColors.grey700,
                    height: 1.6,
                  ),
                ),

                // ── Attachments ───────────────────────────────────────
                if (message.hasAttachments) ...[
                  const SizedBox(height: AHSpacing.xl),
                  const Divider(height: 1, color: AHColors.lightOutline),
                  const SizedBox(height: AHSpacing.md),
                  const Text(
                    'Pièces jointes',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AHColors.grey900,
                    ),
                  ),
                  const SizedBox(height: AHSpacing.md),
                  ...message.attachments.map((attachment) => _AttachmentItem(
                    attachment: attachment,
                  )),
                ],
              ],
            ),
          ),

          const SizedBox(height: AHSpacing.xxl),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      // Take first letter of first part and first letter of last part
      return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
  }
}

// ── Header ────────────────────────────────────────────────────────────

class _MessageDetailHeader extends StatelessWidget {
  const _MessageDetailHeader({required this.type});

  final MessageType type;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AHSpacing.xl,
        AHSpacing.xl + 12,
        AHSpacing.xl,
        AHSpacing.xl,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [type.color.withOpacity(0.85), type.color],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(AHSpacing.r24),
          bottomRight: Radius.circular(AHSpacing.r24),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, color: AHColors.white),
              onPressed: () => context.pop(),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: AHSpacing.md),
            const Expanded(
              child: Text(
                'Message',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AHColors.white,
                ),
              ),
            ),
            Icon(type.icon, color: AHColors.white, size: 24),
          ],
        ),
      ),
    );
  }
}

// ── Attachment Item ───────────────────────────────────────────────────

class _AttachmentItem extends StatelessWidget {
  const _AttachmentItem({required this.attachment});

  final MessageAttachment attachment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AHSpacing.sm),
      child: InkWell(
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Téléchargement de ${attachment.name}...'),
            ),
          );
        },
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        child: Container(
          padding: const EdgeInsets.all(AHSpacing.md),
          decoration: BoxDecoration(
            color: AHColors.lightSurfaceVariant,
            borderRadius: BorderRadius.circular(AHSpacing.r8),
            border: Border.all(
              color: AHColors.lightOutline.withOpacity(0.5),
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AHSpacing.sm),
                decoration: BoxDecoration(
                  color: AHColors.navy.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(AHSpacing.r4),
                ),
                child: Icon(
                  attachment.fileIcon,
                  size: 20,
                  color: AHColors.navy,
                ),
              ),
              const SizedBox(width: AHSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      attachment.name,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AHColors.grey900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      attachment.sizeLabel,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w400,
                        color: AHColors.grey500,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.download_outlined,
                size: 20,
                color: AHColors.navy,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
