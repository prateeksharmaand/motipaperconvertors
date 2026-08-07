import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_provider.g.dart';

class AuthState {
  final String? accessToken;
  final String? refreshToken;
  final String? role;
  final String? tenantId;
  final String? userId;

  const AuthState({this.accessToken, this.refreshToken, this.role, this.tenantId, this.userId});

  bool get isLoggedIn => accessToken != null;
  bool get isOperator => role == 'operator' || role == 'staff';
}

@riverpod
class AuthStateNotifier extends _$AuthStateNotifier {
  static const _storage = FlutterSecureStorage();

  @override
  Future<AuthState> build() async {
    final at = await _storage.read(key: 'access_token');
    final rt = await _storage.read(key: 'refresh_token');
    final role = await _storage.read(key: 'role');
    final tenantId = await _storage.read(key: 'tenant_id');
    final userId = await _storage.read(key: 'user_id');
    return AuthState(accessToken: at, refreshToken: rt, role: role, tenantId: tenantId, userId: userId);
  }

  Future<void> setTokens({
    required String accessToken,
    required String refreshToken,
    required String role,
    String? tenantId,
    required String userId,
  }) async {
    await Future.wait([
      _storage.write(key: 'access_token', value: accessToken),
      _storage.write(key: 'refresh_token', value: refreshToken),
      _storage.write(key: 'role', value: role),
      _storage.write(key: 'tenant_id', value: tenantId ?? ''),
      _storage.write(key: 'user_id', value: userId),
    ]);
    state = AsyncData(AuthState(accessToken: accessToken, refreshToken: refreshToken, role: role, tenantId: tenantId, userId: userId));
  }

  Future<void> logout() async {
    await _storage.deleteAll();
    state = const AsyncData(AuthState());
  }
}
