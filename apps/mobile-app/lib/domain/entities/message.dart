import 'package:freezed_annotation/freezed_annotation.dart';

part 'message.freezed.dart';
part 'message.g.dart';

/// Represents a message/communication from school to parent/student.
@freezed
class SchoolMessage with _$SchoolMessage {
  const factory SchoolMessage({
    required String id,
    required String title,
    required String content,
    required String senderName,
    required MessageType type,
    @Default(false) bool isRead,
    @Default(false) bool isImportant,
    @Default([]) List<MessageAttachment> attachments,
    DateTime? sentAt,
    DateTime? readAt,
    String? tenantId,
  }) = _SchoolMessage;

  const SchoolMessage._();

  /// Time ago display string.
  String get timeAgo {
    if (sentAt == null) return '';
    final diff = DateTime.now().difference(sentAt!);
    if (diff.inMinutes < 1) return "À l'instant";
    if (diff.inMinutes < 60) return 'Il y a ${diff.inMinutes}min';
    if (diff.inHours < 24) return 'Il y a ${diff.inHours}h';
    if (diff.inDays < 7) return 'Il y a ${diff.inDays}j';
    return '${sentAt!.day}/${sentAt!.month}/${sentAt!.year}';
  }

  /// Excerpt of content for list display.
  String get excerpt =>
      content.length > 100 ? '${content.substring(0, 100)}...' : content;

  factory SchoolMessage.fromJson(Map<String, dynamic> json) =>
      _$SchoolMessageFromJson(json);
}

/// Message type enum.
enum MessageType {
  @JsonValue('INFORMATION')
  information,
  @JsonValue('URGENT')
  urgent,
  @JsonValue('REMINDER')
  reminder,
  @JsonValue('ANNOUNCEMENT')
  announcement,
  @JsonValue('ACADEMIC')
  academic,
}

/// Message attachment.
@freezed
class MessageAttachment with _$MessageAttachment {
  const factory MessageAttachment({
    required String id,
    required String name,
    required String url,
    required String fileType, // 'PDF', 'IMAGE', 'DOC'
    @Default(0) int fileSize,
  }) = _MessageAttachment;

  const MessageAttachment._();

  String get displayFileSize {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1048576) {
      return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize / 1048576).toStringAsFixed(1)} MB';
  }

  factory MessageAttachment.fromJson(Map<String, dynamic> json) =>
      _$MessageAttachmentFromJson(json);
}
