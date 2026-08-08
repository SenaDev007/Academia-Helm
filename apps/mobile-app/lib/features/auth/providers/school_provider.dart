import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/services/school_service.dart';
import '../../../domain/entities/tenant_school.dart';

/// The school selected by the user on the school-select screen.
///
/// When non-null, the login screen displays the school's branding
/// (logo, name, slogan, city) matching the web app's behavior where
/// school context is read from sessionStorage/URL params.
final selectedSchoolProvider = StateProvider<TenantSchool?>((ref) => null);

/// Fetches the full list of public schools (cached 5 minutes).
///
/// Mirrors the web app's `usePublicSchools()` React Query hook.
final schoolsListProvider = FutureProvider<List<TenantSchool>>((ref) async {
  final service = ref.watch(schoolServiceProvider);
  return service.fetchSchools();
});

/// Current search query for the school-select screen.
final schoolSearchQueryProvider = StateProvider<String>((ref) => '');

/// Filtered list of schools based on [schoolSearchQueryProvider].
///
/// Client-side filtering on name, city, slug, subdomain, country —
/// matches the web app's SchoolSearch component behavior.
final filteredSchoolsProvider = Provider<List<TenantSchool>>((ref) {
  final allSchools = ref.watch(schoolsListProvider).maybeWhen(
        data: (schools) => schools,
        orElse: () => <TenantSchool>[],
      );
  final query = ref.watch(schoolSearchQueryProvider).toLowerCase().trim();

  if (query.isEmpty) return allSchools;

  return allSchools.where((school) {
    final nameMatch = school.name.toLowerCase().contains(query);
    final cityMatch = (school.city ?? '').toLowerCase().contains(query);
    final slugMatch = school.slug.toLowerCase().contains(query);
    final countryMatch = (school.country ?? '').toLowerCase().contains(query);
    final acronymMatch = (school.schoolAcronym ?? '').toLowerCase().contains(query);
    return nameMatch || cityMatch || slugMatch || countryMatch || acronymMatch;
  }).toList();
});
