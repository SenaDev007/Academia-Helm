import '../../../core/network/api_result.dart';
import '../../../domain/entities/child.dart';
import '../../../domain/repositories/child_repository.dart';
import '../datasources/remote/child_api.dart';

/// Concrete implementation of [ChildRepository] that delegates to [ChildApi].
class ChildRepositoryImpl implements ChildRepository {
  final ChildApi _childApi;

  ChildRepositoryImpl(this._childApi);

  @override
  Future<ApiResult<List<Child>>> getChildren() {
    return _childApi.getChildren();
  }

  @override
  Future<ApiResult<Child>> getChildDetail(String childId) {
    return _childApi.getChildDetail(childId);
  }
}
