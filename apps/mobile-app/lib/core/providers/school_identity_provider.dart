import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../auth/token_storage.dart';

/// School identity (name, acronym, logo URL) — mirrors the web's
/// `/api/settings/identity` response.
class SchoolIdentity {
  final String schoolName;
  final String? schoolAcronym;
  final String? logoUrl;
  final String? academicYearLabel;

  const SchoolIdentity({
    required this.schoolName,
    this.schoolAcronym,
    this.logoUrl,
    this.academicYearLabel,
  });

  /// Derive a short acronym (max 8 chars) from the school name when the API
  /// doesn't supply one. Used only as a fallback.
  String get displayAcronym {
    if (schoolAcronym != null && schoolAcronym!.isNotEmpty) {
      return schoolAcronym!.length > 10
          ? schoolAcronym!.substring(0, 10)
          : schoolAcronym!;
    }
    if (schoolName.isEmpty) return 'AH';
    final words = schoolName
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) =>
            w.isNotEmpty &&
            !['de', 'et', 'le', 'la', 'les', 'du', 'des', 'à', 'en', 'of']
                .contains(w.toLowerCase()))
        .toList();
    if (words.isEmpty) return 'AH';
    if (words.length == 1) {
      return words[0].length > 4
          ? words[0].substring(0, 4).toUpperCase()
          : words[0].toUpperCase();
    }
    final buf = StringBuffer();
    for (final w in words.take(6)) {
      buf.write(w[0].toUpperCase());
    }
    final r = buf.toString();
    return r.isEmpty ? 'AH' : r;
  }

  /// Returns the absolute URL for the logo, or null if no logo is configured.
  /// The API returns either a relative path (e.g. `/uploads/...`) or an
  /// absolute URL (e.g. `https://...`). We normalise to absolute.
  String? get absoluteLogoUrl {
    if (logoUrl == null || logoUrl!.isEmpty) return null;
    if (logoUrl!.startsWith('http://') || logoUrl!.startsWith('https://')) {
      return logoUrl;
    }
    // Relative path — prepend the BFF origin.
    return 'https://academiahelm.com$logoUrl';
  }
}

/// Provider that fetches school identity once on app start and caches it.
/// Also merges with whatever tenant info was stored at login time so the
/// header can render immediately even before the network call returns.
final schoolIdentityProvider =
    FutureProvider.autoDispose<SchoolIdentity>((ref) async {
  // 1) Try the live API first.
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/settings/identity');

  SchoolIdentity? fromApi;
  result.when(
    success: (data) {
      debugPrint('[SchoolIdentity] API success: $data');
      fromApi = SchoolIdentity(
        schoolName: _extractString(data, 'schoolName') ??
            _extractString(data, 'name') ??
            'Academia Helm',
        schoolAcronym:
            _extractString(data, 'schoolAcronym') ?? _extractString(data, 'acronym'),
        logoUrl: _extractString(data, 'logoUrl') ??
            _extractString(data, 'logo') ??
            _extractString(data, 'logo_url'),
        academicYearLabel: _extractString(data, 'academicYearLabel'),
      );
    },
    failure: (e) {
      debugPrint('[SchoolIdentity] API failure: $e');
    },
    loading: () {},
  );

  if (fromApi != null) {
    // Persist to secure storage so subsequent boots render instantly.
    await TokenStorage.persistSession(
      user: const {},
      tenant: {
        'name': fromApi!.schoolName,
        'acronym': fromApi!.displayAcronym,
        'logoUrl': fromApi!.absoluteLogoUrl ?? '',
      },
    );
    return fromApi!;
  }

  // 2) Fall back to whatever we cached at login.
  final cached = await TokenStorage.getSessionTenant();
  if (cached != null) {
    return SchoolIdentity(
      schoolName: _extractString(cached, 'name') ?? 'Academia Helm',
      schoolAcronym: _extractString(cached, 'acronym'),
      logoUrl: _extractString(cached, 'logoUrl'),
    );
  }

  // 3) Ultimate fallback.
  return const SchoolIdentity(schoolName: 'Academia Helm');
});

String? _extractString(Map<String, dynamic> json, String key) {
  final v = json[key];
  if (v is String) return v.isEmpty ? null : v;
  if (v is List && v.isNotEmpty) return v.first?.toString();
  return null;
}
