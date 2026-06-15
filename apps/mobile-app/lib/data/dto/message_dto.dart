import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/message.dart';

part 'message_dto.g.dart';

/// DTO for [SchoolMessage] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class SchoolMessageDto {
  final String id;
  final String title;
  final String content;
  final String senderName;
  final String type; // API returns string, convert to enum
  final bool? isRead;
  final bool? isImportant;
  final List<MessageAttachmentDto>? attachments;
  final String? sentAt;
  final String? readAt;
  final String? tenantId;

  SchoolMessageDto({
    required this.id,
    required this.title,
    required this.content,
    required this.senderName,
    required this.type,
    this.isRead,
    this.isImportant,
    this.attachments,
    this.sentAt,
    this.readAt,
    this.tenantId,
  });

  factory SchoolMessageDto.fromJson(Map<String, dynamic> json) =>
      _$SchoolMessageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SchoolMessageDtoToJson(this);

  /// Converts the API type string to [MessageType] enum.
  MessageType _parseType(String typeStr) {
    switch (typeStr.toUpperCase()) {
      case 'INFORMATION':
        return MessageType.information;
      case 'URGENT':
        return MessageType.urgent;
      case 'REMINDER':
        return MessageType.reminder;
      case 'ANNOUNCEMENT':
        return MessageType.announcement;
      case 'ACADEMIC':
        return MessageType.academic;
      default:
        return MessageType.information;
    }
  }

  SchoolMessage toDomain() => SchoolMessage(
        id: id,
        title: title,
        content: content,
        senderName: senderName,
        type: _parseType(type),
        isRead: isRead ?? false,
        isImportant: isImportant ?? false,
        attachments: attachments?.map((dto) => dto.toDomain()).toList() ?? [],
        sentAt: sentAt != null ? DateTime.tryParse(sentAt!) : null,
        readAt: readAt != null ? DateTime.tryParse(readAt!) : null,
        tenantId: tenantId,
      );
}

/// DTO for [MessageAttachment] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class MessageAttachmentDto {
  final String id;
  final String name;
  final String url;
  final String fileType;
  final int? fileSize;

  MessageAttachmentDto({
    required this.id,
    required this.name,
    required this.url,
    required this.fileType,
    this.fileSize,
  });

  factory MessageAttachmentDto.fromJson(Map<String, dynamic> json) =>
      _$MessageAttachmentDtoFromJson(json);

  Map<String, dynamic> toJson() => _$MessageAttachmentDtoToJson(this);

  MessageAttachment toDomain() => MessageAttachment(
        id: id,
        name: name,
        url: url,
        fileType: fileType,
        fileSize: fileSize ?? 0,
      );
}
