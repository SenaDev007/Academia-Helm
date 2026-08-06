import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Message type classification.
enum MessageType {
  information('Information', Icons.info_outline, AHColors.info),
  urgent('Urgent', Icons.priority_high, AHColors.error),
  reminder('Rappel', Icons.notifications_active_outlined, AHColors.warning),
  general('Général', Icons.mail_outline, AHColors.navy);

  const MessageType(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

/// Attachment for a message.
class MessageAttachment {
  final String id;
  final String name;
  final String url;
  final String fileType; // pdf, doc, xls, jpg, png
  final int sizeBytes;

  const MessageAttachment({
    required this.id,
    required this.name,
    required this.url,
    required this.fileType,
    required this.sizeBytes,
  });

  String get sizeLabel {
    if (sizeBytes >= 1024 * 1024) {
      return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} Mo';
    } else if (sizeBytes >= 1024) {
      return '${(sizeBytes / 1024).toStringAsFixed(0)} Ko';
    }
    return '$sizeBytes o';
  }

  IconData get fileIcon {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return Icons.picture_as_pdf_outlined;
      case 'doc':
      case 'docx':
        return Icons.description_outlined;
      case 'xls':
      case 'xlsx':
        return Icons.table_chart_outlined;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return Icons.image_outlined;
      default:
        return Icons.insert_drive_file_outlined;
    }
  }

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      url: json['url'] as String? ?? '',
      fileType: json['fileType'] as String? ?? json['file_type'] as String? ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? (json['size_bytes'] as num?)?.toInt() ?? 0,
    );
  }
}

/// A single message from the school.
class Message {
  final String id;
  final String senderId;
  final String senderName;
  final String senderAvatar;
  final String title;
  final String content;
  final MessageType type;
  final DateTime date;
  final bool isRead;
  final List<MessageAttachment> attachments;

  const Message({
    required this.id,
    required this.senderId,
    required this.senderName,
    this.senderAvatar = '',
    required this.title,
    required this.content,
    required this.type,
    required this.date,
    required this.isRead,
    this.attachments = const [],
  });

  bool get hasAttachments => attachments.isNotEmpty;

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String? ?? '',
      senderId: json['senderId'] as String? ?? json['sender_id'] as String? ?? '',
      senderName: json['senderName'] as String? ?? json['sender_name'] as String? ?? '',
      senderAvatar: json['senderAvatar'] as String? ?? json['sender_avatar'] as String? ?? '',
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      type: _parseMessageType(json['type'] as String?),
      date: json['date'] != null ? DateTime.parse(json['date'] as String) : DateTime.now(),
      isRead: json['isRead'] as bool? ?? json['is_read'] as bool? ?? false,
      attachments: (json['attachments'] as List<dynamic>?)
              ?.map((e) => MessageAttachment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  static MessageType _parseMessageType(String? value) {
    if (value == null) return MessageType.general;
    switch (value.toLowerCase()) {
      case 'urgent':
        return MessageType.urgent;
      case 'information':
        return MessageType.information;
      case 'reminder':
        return MessageType.reminder;
      case 'general':
      default:
        return MessageType.general;
    }
  }
}

/// Filter for messages.
enum MessageFilter {
  all('Tous', null),
  unread('Non lus', 'unread'),
  urgent('Urgents', 'urgent');

  const MessageFilter(this.label, this.apiValue);
  final String label;
  final String? apiValue;
}

// ── Messages List Notifier ────────────────────────────────────────────

class MessagesListNotifier extends FamilyAsyncNotifier<List<Message>, MessageFilter> {
  @override
  Future<List<Message>> build(MessageFilter arg) async {
    final apiClient = ref.read(apiClientProvider);
    final queryParams = <String, dynamic>{};
    if (arg.apiValue != null) {
      queryParams['filter'] = arg.apiValue;
    }

    final result = await apiClient.get<List<Message>>(
      '${ApiConfig.versionedBaseUrl}/messages',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
      fromJson: (json) {
        final data = json['data'] ?? json;
        if (data is List) {
          return data.map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <Message>[];
      },
    );

    return result.when(
      success: (messages) => messages,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => <Message>[],
    );
  }

  /// Mark a message as read.
  Future<void> markAsRead(String messageId) async {
    final currentMessages = state.valueOrNull ?? [];
    final updatedMessages = currentMessages.map((m) {
      if (m.id == messageId) {
        return Message(
          id: m.id,
          senderId: m.senderId,
          senderName: m.senderName,
          senderAvatar: m.senderAvatar,
          title: m.title,
          content: m.content,
          type: m.type,
          date: m.date,
          isRead: true,
          attachments: m.attachments,
        );
      }
      return m;
    }).toList();
    state = AsyncData(updatedMessages);
  }

  /// Refresh the messages list.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build(arg));
  }
}

/// Provider for the messages list with filter.
final messagesListProvider = AsyncNotifierProvider.family<MessagesListNotifier, List<Message>, MessageFilter>(
  MessagesListNotifier.new,
);

// ── Message Detail Notifier ───────────────────────────────────────────

class MessageDetailNotifier extends FamilyAsyncNotifier<Message, String> {
  @override
  Future<Message> build(String arg) async {
    final apiClient = ref.read(apiClientProvider);
    final result = await apiClient.get<Message>(
      '${ApiConfig.versionedBaseUrl}/messages/$arg',
      fromJson: (json) => Message.fromJson(json),
    );

    return result.when(
      success: (message) => message,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => Message(
        id: '',
        senderId: '',
        senderName: '',
        title: '',
        content: '',
        type: MessageType.general,
        date: DateTime.now(),
        isRead: false,
      ),
    );
  }
}

/// Provider for a single message detail.
final messageDetailProvider = AsyncNotifierProvider.family<MessageDetailNotifier, Message, String>(
  MessageDetailNotifier.new,
);

// ── Unread Messages Count Provider ────────────────────────────────────

/// Provider that computes unread count from the all-messages list.
final unreadMessagesCountProvider = FutureProvider<int>((ref) async {
  final messagesAsync = ref.watch(messagesListProvider(MessageFilter.all));
  return messagesAsync.when(
    data: (messages) => messages.where((m) => !m.isRead).length,
    loading: () => 0,
    error: (_, __) => 0,
  );
});

/// Selected message filter state.
final selectedMessageFilterProvider = StateProvider<MessageFilter>((ref) => MessageFilter.all);

// ── Mock Data ─────────────────────────────────────────────────────────

List<Message> getMockMessages(MessageFilter filter) {
  final allMessages = [
    Message(
      id: 'msg-001',
      senderId: 'dir-001',
      senderName: 'Direction',
      title: 'Réunion parents d\'élèves — Trimestre 2',
      content: 'Chers parents,\n\nNous avons le plaisir de vous informer qu\'une réunion parents d\'élèves se tiendra le vendredi 14 mars 2025 à 10h00 dans la salle de conférence de l\'école.\n\nL\'ordre du jour inclut :\n- Bilan du deuxième trimestre\n- Présentation des résultats\n- Discussion sur les améliorations pour le troisième trimestre\n\nVotre présence est vivement souhaitée.\n\nCordialement,\nLa Direction',
      type: MessageType.information,
      date: DateTime(2025, 3, 1),
      isRead: false,
    ),
    Message(
      id: 'msg-002',
      senderId: 'dir-001',
      senderName: 'Direction',
      title: 'Urgent : Paiement des frais en retard',
      content: 'Bonjour,\n\nNous vous rappelons que le paiement des frais de scolarité du troisième trimestre est en retard. Veuillez régulariser votre situation avant le 15 mars 2025 pour éviter les pénalités.\n\nEn cas de difficulté, veuillez contacter le secrétariat.\n\nCordialement,\nLa Direction',
      type: MessageType.urgent,
      date: DateTime(2025, 3, 3),
      isRead: false,
    ),
    Message(
      id: 'msg-003',
      senderId: 'prof-001',
      senderName: 'M. Koné — Mathématiques',
      title: 'Rappel : Contrôle de mathématiques lundi',
      content: 'Bonjour,\n\nJe rappelle qu\'un contrôle de mathématiques est prévu ce lundi 10 mars 2025. Le programme couvre les chapitres 5 à 7 (algèbre et géométrie).\n\nLes élèves doivent réviser les exercices donnés en classe.\n\nCordialement,\nM. Koné',
      type: MessageType.reminder,
      date: DateTime(2025, 3, 5),
      isRead: false,
      attachments: [
        const MessageAttachment(
          id: 'att-001',
          name: 'Programme_révision.pdf',
          url: '/files/programme_revision.pdf',
          fileType: 'pdf',
          sizeBytes: 245000,
        ),
      ],
    ),
    Message(
      id: 'msg-004',
      senderId: 'dir-001',
      senderName: 'Direction',
      title: 'Férié : Journée de la femme — 8 mars',
      content: 'Chers parents,\n\nEn commémoration de la Journée internationale de la femme, l\'école sera fermée le samedi 8 mars 2025.\n\nLes cours reprendront normalement le lundi 10 mars.\n\nCordialement,\nLa Direction',
      type: MessageType.information,
      date: DateTime(2025, 2, 28),
      isRead: true,
    ),
    Message(
      id: 'msg-005',
      senderId: 'cpe-001',
      senderName: 'CPE',
      title: 'Sortie pédagogique — Musée national',
      content: 'Bonjour,\n\nUne sortie pédagogique au Musée national est organisée pour les classes de 4ème le mercredi 19 mars 2025.\n\nLes élèves doivent apporter un carnet de notes. Le départ est prévu à 8h00 et le retour à 15h00.\n\nVeuillez signer l\'autorisation jointe et la remettre au CPE avant le 15 mars.\n\nMerci,\nLe CPE',
      type: MessageType.general,
      date: DateTime(2025, 3, 2),
      isRead: true,
      attachments: [
        const MessageAttachment(
          id: 'att-002',
          name: 'Autorisation_sortie.pdf',
          url: '/files/autorisation_sortie.pdf',
          fileType: 'pdf',
          sizeBytes: 128000,
        ),
      ],
    ),
    Message(
      id: 'msg-006',
      senderId: 'dir-001',
      senderName: 'Direction',
      title: 'Rappel : Inscriptions année scolaire 2025-2026',
      content: 'Chers parents,\n\nLes réinscriptions pour l\'année scolaire 2025-2026 sont ouvertes. Veuillez vous présenter au secrétariat muni des documents suivants :\n- Bulletins de l\'année en cours\n- Quittance de paiement du 3ème trimestre\n- 2 photos d\'identité\n\nDate limite : 30 avril 2025.\n\nCordialement,\nLa Direction',
      type: MessageType.reminder,
      date: DateTime(2025, 3, 4),
      isRead: true,
    ),
  ];

  switch (filter) {
    case MessageFilter.unread:
      return allMessages.where((m) => !m.isRead).toList();
    case MessageFilter.urgent:
      return allMessages.where((m) => m.type == MessageType.urgent).toList();
    case MessageFilter.all:
      return allMessages;
  }
}
