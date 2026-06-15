import 'package:academia_helm_mobile/domain/entities/user.dart';
import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';
import 'package:academia_helm_mobile/domain/repositories/auth_repository.dart';
import 'package:academia_helm_mobile/data/datasources/remote/auth_api.dart';
import 'package:academia_helm_mobile/data/datasources/local/auth_local_storage.dart';
import 'package:academia_helm_mobile/data/dto/auth_dto.dart';

/// Concrete implementation of [AuthRepository] that delegates to
/// [AuthApi] for remote operations and [AuthLocalStorage] for
/// local persistence of tokens, user data, and tenant selection.
class AuthRepositoryImpl implements AuthRepository {
  final AuthApi _authApi;
  final AuthLocalStorage _localStorage;

  AuthRepositoryImpl({
    required AuthApi authApi,
    required AuthLocalStorage localStorage,
  })  : _authApi = authApi,
        _localStorage = localStorage;

  @override
  Future<(User, String accessToken)> login(
    String email,
    String password,
  ) async {
    final request = LoginRequest(email: email, password: password);
    final response = await _authApi.login(request);

    // Persist tokens
    await _localStorage.saveAccessToken(response.accessToken);
    await _localStorage.saveRefreshToken(response.refreshToken);

    // Persist user
    final user = response.user.toDomain();
    await _localStorage.saveUser(user);

    // Persist tenant list (save the first tenant as default if only one)
    if (response.tenants.length == 1) {
      await _localStorage.saveSelectedTenant(response.tenants.first.toDomain());
    }

    return (user, response.accessToken);
  }

  @override
  Future<void> logout() async {
    try {
      await _authApi.logout();
    } catch (_) {
      // Even if the API call fails, we still clear local data
    }
    await _localStorage.clearAll();
  }

  @override
  Future<String> refreshToken(String refreshToken) async {
    final request = RefreshRequest(refreshToken: refreshToken);
    final response = await _authApi.refreshToken(request);

    // Persist the new tokens
    await _localStorage.saveAccessToken(response.accessToken);
    await _localStorage.saveRefreshToken(response.refreshToken);

    return response.accessToken;
  }

  @override
  Future<User?> getCurrentUser() async {
    // Try local cache first
    final cachedUser = _localStorage.getUser();
    if (cachedUser != null) return cachedUser;

    // Fallback to remote
    try {
      final userDto = await _authApi.getCurrentUser();
      final user = userDto.toDomain();
      await _localStorage.saveUser(user);
      return user;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> forgotPassword(String email) async {
    final request = ForgotPasswordRequest(email: email);
    await _authApi.forgotPassword(request);
  }

  @override
  Future<void> resetPassword(String token, String newPassword) async {
    final request = ResetPasswordRequest(token: token, newPassword: newPassword);
    await _authApi.resetPassword(request);
  }

  @override
  Future<List<TenantSchool>> getAvailableTenants() async {
    final tenantDtos = await _authApi.getAvailableTenants();
    return tenantDtos.map((dto) => dto.toDomain()).toList();
  }

  @override
  Future<void> selectTenant(String tenantId) async {
    final request = SelectTenantRequest(tenantId: tenantId);
    await _authApi.selectTenant(request);

    // Update the locally selected tenant
    final tenants = await getAvailableTenants();
    final selected = tenants.where((t) => t.id == tenantId).firstOrNull;
    if (selected != null) {
      await _localStorage.saveSelectedTenant(selected);
    }
  }
}
