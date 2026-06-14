import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required String role, // STUDENT, PARENT, TEACHER, ADMIN, DIRECTOR
    String? phone,
    String? avatarUrl,
    String? tenantId,
    List<String>? permissions,
    bool? isActive,
    DateTime? lastLoginAt,
  }) = _User;

  const User._();

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName[0]}${lastName[0]}'.toUpperCase();
  bool get isStudent => role == 'STUDENT';
  bool get isParent => role == 'PARENT';
  bool get isTeacher => role == 'TEACHER';
  bool get isAdmin => role == 'ADMIN' || role == 'DIRECTOR';

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}
