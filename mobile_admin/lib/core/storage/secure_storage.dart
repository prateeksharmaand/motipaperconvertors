import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
  );

  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: AppConstants.accessTokenKey, value: accessToken);
    await _storage.write(key: AppConstants.refreshTokenKey, value: refreshToken);
  }

  static Future<String?> getAccessToken() =>
      _storage.read(key: AppConstants.accessTokenKey);

  static Future<String?> getRefreshToken() =>
      _storage.read(key: AppConstants.refreshTokenKey);

  static Future<void> saveUserInfo({
    required String userId,
    required String role,
    String? tenantId,
    required List<String> permissions,
  }) async {
    await _storage.write(key: AppConstants.userIdKey, value: userId);
    await _storage.write(key: AppConstants.userRoleKey, value: role);
    if (tenantId != null) {
      await _storage.write(key: AppConstants.tenantIdKey, value: tenantId);
    }
    await _storage.write(
      key: AppConstants.permissionsKey,
      value: permissions.join(','),
    );
  }

  static Future<String?> getUserId() => _storage.read(key: AppConstants.userIdKey);
  static Future<String?> getUserRole() => _storage.read(key: AppConstants.userRoleKey);
  static Future<String?> getTenantId() => _storage.read(key: AppConstants.tenantIdKey);

  static Future<List<String>> getPermissions() async {
    final raw = await _storage.read(key: AppConstants.permissionsKey);
    if (raw == null || raw.isEmpty) return [];
    return raw.split(',');
  }

  static Future<void> clearAll() => _storage.deleteAll();
}
