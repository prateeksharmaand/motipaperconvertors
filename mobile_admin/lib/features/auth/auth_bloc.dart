import 'package:bloc/bloc.dart';
import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/secure_storage.dart';
import '../../models/auth_models.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthInitial()) {
    on<AuthStarted>(_onStarted);
    on<AuthLoginRequested>(_onLogin);
    on<AuthLogoutRequested>(_onLogout);
  }

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    final token = await SecureStorage.getAccessToken();
    if (token == null) { emit(const AuthUnauthenticated()); return; }
    try {
      final me = await _fetchMe();
      emit(AuthAuthenticated(me));
    } catch (_) {
      await SecureStorage.clearAll();
      emit(const AuthUnauthenticated());
    }
  }

  Future<void> _onLogin(AuthLoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      final res = await ApiClient.instance.post(
        '/auth/login',
        data: LoginRequest(email: event.email, password: event.password).toJson(),
      );
      final lr = LoginResponse.fromJson(res.data as Map<String, dynamic>);
      await SecureStorage.saveTokens(accessToken: lr.accessToken, refreshToken: lr.refreshToken);

      final me = await _fetchMe();
      await SecureStorage.saveUserInfo(
        userId: me.id, role: me.role, tenantId: me.tenantId, permissions: me.permissions,
      );
      emit(AuthAuthenticated(me));
    } on DioException catch (e) {
      final ex = e.error as ApiException?;
      emit(AuthUnauthenticated(error: ex?.message ?? 'Login failed'));
    } catch (_) {
      emit(const AuthUnauthenticated(error: 'Unexpected error. Try again.'));
    }
  }

  Future<void> _onLogout(AuthLogoutRequested event, Emitter<AuthState> emit) async {
    try {
      final refresh = await SecureStorage.getRefreshToken();
      await ApiClient.instance.post('/auth/logout', data: {'refreshToken': refresh});
    } catch (_) {}
    await SecureStorage.clearAll();
    ApiClient.reset();
    emit(const AuthUnauthenticated());
  }

  Future<MeResponse> _fetchMe() async {
    final res = await ApiClient.instance.get('/auth/me');
    return MeResponse.fromJson(res.data as Map<String, dynamic>);
  }
}
