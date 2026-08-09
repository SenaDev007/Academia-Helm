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

  /// Derive an acronym from the school name when the API doesn't supply
  /// one. Used only as a fallback. No character limit — shows the full
  /// acronym as returned by the API or derived from the school name.
  String get displayAcronym {
    if (schoolAcronym != null && schoolAcronym!.isNotEmpty) {
      return schoolAcronym!;
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
      return words[0].toUpperCase();
    }
    final buf = StringBuffer();
    for (final w in words) {
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

/// School identity provider — tries cache FIRST (instant), then fetches
/// from the API in the background. NOT autoDispose so it persists across
/// screen navigations (avoids re-fetching /settings/identity on every
/// AppBar render).
final schoolIdentityProvider =
    FutureProvider<SchoolIdentity>((ref) async {
  // 1) Try cache FIRST — this is instant.
  final cachedTenant = await TokenStorage.getSessionTenant();
  if (cachedTenant != null) {
    final cached = SchoolIdentity(
      schoolName: _extractString(cachedTenant, 'name') ?? 'Academia Helm',
      schoolAcronym: _extractString(cachedTenant, 'acronym'),
      logoUrl: _extractString(cachedTenant, 'logoUrl'),
    );
    // Return cached immediately — the UI renders instantly.
    // Then fetch fresh data in the background (fire and forget).
    _refreshIdentityInBackground(ref);
    return cached;
  }

  // 2) No cache — fetch from API.
  return _fetchIdentityFromApi(ref);
});

/// Fetches fresh identity data from /settings/identity and updates the
/// cache. Called in the background after returning cached data.
Future<void> _refreshIdentityInBackground(Ref ref) async {
  try {
    final identity = await _fetchIdentityFromApi(ref);
    // Invalidate the provider so it re-renders with fresh data.
    ref.invalidate(schoolIdentityProvider);
  } catch (_) {
    // Silently fail — cached data is still shown.
  }
}

/// Fetches school identity from /settings/identity API.
Future<SchoolIdentity> _fetchIdentityFromApi(Ref ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw('/settings/identity');

  SchoolIdentity? fromApi;
  result.when(
    success: (data) {
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

  // Fall back to whatever we cached at login.
  final cached = await TokenStorage.getSessionTenant();
  if (cached != null) {
    return SchoolIdentity(
      schoolName: _extractString(cached, 'name') ?? 'Academia Helm',
      schoolAcronym: _extractString(cached, 'acronym'),
      logoUrl: _extractString(cached, 'logoUrl'),
    );
  }

  return const SchoolIdentity(schoolName: 'Academia Helm');
}

String? _extractString(Map<String, dynamic> json, String key) {
  final v = json[key];
  if (v is String) return v.isEmpty ? null : v;
  if (v is List && v.isNotEmpty) return v.first?.toString();
  return null;
}
