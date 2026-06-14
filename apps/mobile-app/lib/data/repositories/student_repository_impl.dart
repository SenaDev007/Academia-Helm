import 'package:hive/hive.dart';
import 'package:academia_helm_mobile/domain/entities/student.dart';
import 'package:academia_helm_mobile/domain/repositories/student_repository.dart';
import 'package:academia_helm_mobile/data/datasources/remote/student_api.dart';
import 'package:academia_helm_mobile/data/datasources/local/cache_storage.dart';
import 'package:academia_helm_mobile/data/dto/student_dto.dart';

/// Concrete implementation of [StudentRepository] that delegates to
/// [StudentApi] for remote CRUD operations and [CacheStorage] for
/// local caching with TTL support.
class StudentRepositoryImpl implements StudentRepository {
  final StudentApi _studentApi;
  final CacheStorage _cacheStorage;
  final Box _cacheBox;

  /// Cache TTL for student lists — defaults to 5 minutes.
  static const _defaultCacheTtl = Duration(minutes: 5);

  StudentRepositoryImpl({
    required StudentApi studentApi,
    required CacheStorage cacheStorage,
    required Box cacheBox,
  })  : _studentApi = studentApi,
        _cacheStorage = cacheStorage,
        _cacheBox = cacheBox;

  /// Builds a deterministic cache key for student list queries.
  String _listCacheKey({
    String? classId,
    String? levelId,
    String? search,
    int page = 1,
    int limit = 20,
  }) {
    return 'students:${classId ?? ''}:${levelId ?? ''}:${search ?? ''}:$page:$limit';
  }

  @override
  Future<List<Student>> getStudents({
    String? classId,
    String? levelId,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final cacheKey = _listCacheKey(
      classId: classId,
      levelId: levelId,
      search: search,
      page: page,
      limit: limit,
    );

    // Check cache first
    if (!_cacheStorage.isExpired(cacheKey)) {
      final cached = _cacheStorage.get<List<dynamic>>(cacheKey);
      if (cached != null) {
        try {
          return cached
              .map((json) => Student.fromJson(json as Map<String, dynamic>))
              .toList();
        } catch (_) {
          // Cache deserialization failed — proceed to remote fetch
        }
      }
    }

    // Fetch from remote
    final response = await _studentApi.getStudents(
      classId,
      levelId,
      search,
      page,
      limit,
    );

    final students = response.data.map((dto) => dto.toDomain()).toList();

    // Cache the raw response data for future lookups
    final cacheData = response.data.map((dto) => dto.toJson()).toList();
    await _cacheStorage.save(cacheKey, cacheData, ttl: _defaultCacheTtl);

    return students;
  }

  @override
  Future<Student> getStudentById(String id) async {
    final cacheKey = 'student:$id';

    // Check cache
    if (!_cacheStorage.isExpired(cacheKey)) {
      final cached = _cacheStorage.get<Map<String, dynamic>>(cacheKey);
      if (cached != null) {
        try {
          return Student.fromJson(cached);
        } catch (_) {
          // Cache corrupted — proceed to remote fetch
        }
      }
    }

    // Fetch from remote
    final dto = await _studentApi.getStudentById(id);
    final student = dto.toDomain();

    // Cache the result
    await _cacheStorage.save(cacheKey, dto.toJson(), ttl: _defaultCacheTtl);

    return student;
  }

  @override
  Future<Student> createStudent(Map<String, dynamic> data) async {
    final request = CreateStudentRequest(
      firstName: data['firstName'] as String,
      lastName: data['lastName'] as String,
      matricule: data['matricule'] as String,
      classId: data['classId'] as String?,
      schoolLevelId: data['schoolLevelId'] as String?,
      gender: data['gender'] as String?,
      dateOfBirth: data['dateOfBirth'] as DateTime?,
      parentName: data['parentName'] as String?,
      parentPhone: data['parentPhone'] as String?,
    );

    final dto = await _studentApi.createStudent(request);
    final student = dto.toDomain();

    // Invalidate list caches since a new student was added
    await _invalidateListCaches();

    return student;
  }

  @override
  Future<Student> updateStudent(String id, Map<String, dynamic> data) async {
    final request = UpdateStudentRequest(
      firstName: data['firstName'] as String?,
      lastName: data['lastName'] as String?,
      classId: data['classId'] as String?,
      schoolLevelId: data['schoolLevelId'] as String?,
      gender: data['gender'] as String?,
      dateOfBirth: data['dateOfBirth'] as DateTime?,
      parentName: data['parentName'] as String?,
      parentPhone: data['parentPhone'] as String?,
      status: data['status'] as String?,
    );

    final dto = await _studentApi.updateStudent(id, request);
    final student = dto.toDomain();

    // Update single-item cache
    await _cacheStorage.save('student:$id', dto.toJson(), ttl: _defaultCacheTtl);

    // Invalidate list caches since data changed
    await _invalidateListCaches();

    return student;
  }

  /// Invalidates all student list caches by removing keys starting with 'students:'.
  Future<void> _invalidateListCaches() async {
    final keysToDelete = _cacheBox.keys
        .where((key) => (key as String).startsWith('students:'))
        .toList();

    for (final key in keysToDelete) {
      await _cacheBox.delete(key);
    }
  }
}
