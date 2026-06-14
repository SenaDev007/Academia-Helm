import 'package:academia_helm_mobile/domain/entities/student.dart';

abstract class StudentRepository {
  /// Retrieves a paginated list of students with optional filters.
  ///
  /// [classId] - Filter by class identifier.
  /// [levelId] - Filter by school level identifier.
  /// [search] - Full-text search on name or matricule.
  /// [page] - Page number (1-based).
  /// [limit] - Number of items per page.
  Future<List<Student>> getStudents({
    String? classId,
    String? levelId,
    String? search,
    int page = 1,
    int limit = 20,
  });

  /// Retrieves a single student by its unique identifier.
  Future<Student> getStudentById(String id);

  /// Creates a new student with the provided data map.
  Future<Student> createStudent(Map<String, dynamic> data);

  /// Updates an existing student identified by [id] with the provided data map.
  Future<Student> updateStudent(String id, Map<String, dynamic> data);
}
