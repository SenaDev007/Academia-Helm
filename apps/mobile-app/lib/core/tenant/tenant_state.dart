import 'package:freezed_annotation/freezed_annotation.dart';

part 'tenant_state.freezed.dart';
part 'tenant_state.g.dart';

/// Represents a tenant (school/institution) in the multi-tenant system.
@freezed
class Tenant with _$Tenant {
  const factory Tenant({
    required String id,
    required String name,
    required String slug,
    String? logoUrl,
    String? primaryColor,
    String? schoolAcronym,
    String? address,
    String? country,
    String? plan,
    @Default(true) bool isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _Tenant;

  const Tenant._();

  factory Tenant.fromJson(Map<String, dynamic> json) => _$TenantFromJson(json);

  /// Display-friendly short name: acronym if available, otherwise first
  /// word of [name].
  String get shortName => schoolAcronym ?? name.split(' ').first;

  /// Initials for avatar placeholder.
  String get initials {
    if (schoolAcronym != null && schoolAcronym!.isNotEmpty) {
      return schoolAcronym!.toUpperCase();
    }
    final List<String> parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length > 2 ? 2 : name.length).toUpperCase();
  }
}

/// Sealed class representing the current tenant selection state.
@freezed
sealed class TenantState with _$TenantState {
  const factory TenantState.initial() = TenantInitial;

  const factory TenantState.selected(Tenant tenant) = TenantSelected;

  const factory TenantState.loading() = TenantLoading;
}

/// Extension providing convenience helpers on [TenantState].
extension TenantStateX on TenantState {
  bool get isSelected => this is TenantSelected;

  bool get isLoading => this is TenantLoading;

  Tenant? get tenantOrNull => when<Tenant?>(
        initial: () => null,
        selected: (Tenant tenant) => tenant,
        loading: () => null,
      );

  String? get tenantIdOrNull => tenantOrNull?.id;
}
