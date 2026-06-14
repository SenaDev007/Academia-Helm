import 'package:academia_helm_mobile/domain/entities/user.dart';
import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';

abstract class AuthRepository {
  /// Authenticates a user with email and password.
  /// Returns a tuple of (User, accessToken).
  Future<(User, String accessToken)> login(String email, String password);

  /// Logs out the current user and clears local session data.
  Future<void> logout();

  /// Refreshes the access token using a valid refresh token.
  Future<String> refreshToken(String refreshToken);

  /// Returns the currently authenticated user, or null if not authenticated.
  Future<User?> getCurrentUser();

  /// Sends a password reset email to the given address.
  Future<void> forgotPassword(String email);

  /// Resets the user's password using a valid reset token.
  Future<void> resetPassword(String token, String newPassword);

  /// Returns the list of tenants (schools) the authenticated user has access to.
  Future<List<TenantSchool>> getAvailableTenants();

  /// Persists the selected tenant for the current session.
  Future<void> selectTenant(String tenantId);
}
