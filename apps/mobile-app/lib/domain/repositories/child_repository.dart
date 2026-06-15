import '../entities/child.dart';
import '../../../core/network/api_result.dart';

abstract class ChildRepository {
  /// Retrieves the list of children linked to the current parent account.
  Future<ApiResult<List<Child>>> getChildren();

  /// Retrieves a single child detail.
  ///
  /// [childId] - The child's unique identifier.
  Future<ApiResult<Child>> getChildDetail(String childId);
}
