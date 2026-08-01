// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SchoolMessageDto _$SchoolMessageDtoFromJson(Map<String, dynamic> json) =>
    SchoolMessageDto(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      senderName: json['sender_name'] as String,
      type: json['type'] as String,
      isRead: json['is_read'] as bool?,
      isImportant: json['is_important'] as bool?,
      attachments: (json['attachments'] as List<dynamic>?)
          ?.map((e) => MessageAttachmentDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      sentAt: json['sent_at'] as String?,
      readAt: json['read_at'] as String?,
      tenantId: json['tenant_id'] as String?,
    );

Map<String, dynamic> _$SchoolMessageDtoToJson(SchoolMessageDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'content': instance.content,
      'sender_name': instance.senderName,
      'type': instance.type,
      'is_read': instance.isRead,
      'is_important': instance.isImportant,
      'attachments': instance.attachments,
      'sent_at': instance.sentAt,
      'read_at': instance.readAt,
      'tenant_id': instance.tenantId,
    };

MessageAttachmentDto _$MessageAttachmentDtoFromJson(
        Map<String, dynamic> json) =>
    MessageAttachmentDto(
      id: json['id'] as String,
      name: json['name'] as String,
      url: json['url'] as String,
      fileType: json['file_type'] as String,
      fileSize: (json['file_size'] as num?)?.toInt(),
    );

Map<String, dynamic> _$MessageAttachmentDtoToJson(
        MessageAttachmentDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'url': instance.url,
      'file_type': instance.fileType,
      'file_size': instance.fileSize,
    };
