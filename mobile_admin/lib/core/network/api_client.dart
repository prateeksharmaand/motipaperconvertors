import 'dart:async';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final dynamic data;

  const ApiException({this.statusCode, required this.message, this.data});

  @override
  String toString() => 'ApiException($statusCode): $message';

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isConflict => statusCode == 409;
  bool get isServerError => (statusCode ?? 0) >= 500;
}

class ApiClient {
  static Dio? _instance;
  static bool _isRefreshing = false;
  static Completer<String?>? _refreshCompleter;

  static Dio get instance {
    _instance ??= _createDio();
    return _instance!;
  }

  static Dio _createDio() {
    final dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: AppConstants.connectTimeout,
      receiveTimeout: AppConstants.receiveTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(_AuthInterceptor(dio));
    return dio;
  }

  static void reset() {
    _instance = null;
    _isRefreshing = false;
    _refreshCompleter = null;
  }
}

class _AuthInterceptor extends Interceptor {
  final Dio dio;
  _AuthInterceptor(this.dio);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      final newToken = await _refreshToken();
      if (newToken != null) {
        // Retry with new token
        err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
        try {
          final response = await dio.fetch(err.requestOptions);
          handler.resolve(response);
          return;
        } catch (_) {}
      }
      // Refresh failed — clear session
      await SecureStorage.clearAll();
      ApiClient.reset();
    }
    handler.next(_mapError(err));
  }

  Future<String?> _refreshToken() async {
    if (ApiClient._isRefreshing) {
      return ApiClient._refreshCompleter?.future;
    }

    ApiClient._isRefreshing = true;
    ApiClient._refreshCompleter = Completer<String?>();

    try {
      final refreshToken = await SecureStorage.getRefreshToken();
      if (refreshToken == null) {
        ApiClient._refreshCompleter!.complete(null);
        return null;
      }

      final freshDio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
      final response = await freshDio.post('/auth/refresh', data: {'refreshToken': refreshToken});

      final newAccess = response.data['accessToken'] as String;
      final newRefresh = response.data['refreshToken'] as String;
      await SecureStorage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);

      ApiClient._refreshCompleter!.complete(newAccess);
      return newAccess;
    } catch (_) {
      ApiClient._refreshCompleter!.complete(null);
      return null;
    } finally {
      ApiClient._isRefreshing = false;
      ApiClient._refreshCompleter = null;
    }
  }

  DioException _mapError(DioException err) {
    final statusCode = err.response?.statusCode;
    final message = _extractMessage(err);
    return err.copyWith(
      error: ApiException(statusCode: statusCode, message: message, data: err.response?.data),
    );
  }

  String _extractMessage(DioException err) {
    try {
      final data = err.response?.data;
      if (data is Map) return data['error']?.toString() ?? data['message']?.toString() ?? 'An error occurred';
    } catch (_) {}
    return switch (err.type) {
      DioExceptionType.connectionTimeout => 'Connection timeout. Check your internet.',
      DioExceptionType.receiveTimeout => 'Server took too long to respond.',
      DioExceptionType.connectionError => 'No internet connection.',
      _ => err.message ?? 'An error occurred.',
    };
  }
}

// Convenience methods
extension ApiClientX on Dio {
  ApiException? extractException(DioException e) => e.error as ApiException?;
}
