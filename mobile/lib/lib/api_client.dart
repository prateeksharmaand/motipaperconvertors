import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _baseUrl = String.fromEnvironment('API_URL', defaultValue: 'https://api.motipaper.in/api/v1');
const _storage = FlutterSecureStorage();

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(baseUrl: _baseUrl));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Attempt token refresh
          final refreshToken = await _storage.read(key: 'refresh_token');
          if (refreshToken != null) {
            try {
              final res = await Dio().post('$_baseUrl/auth/refresh', data: {'refreshToken': refreshToken});
              final newAt = res.data['accessToken'] as String;
              final newRt = res.data['refreshToken'] as String;
              await _storage.write(key: 'access_token', value: newAt);
              await _storage.write(key: 'refresh_token', value: newRt);
              error.requestOptions.headers['Authorization'] = 'Bearer $newAt';
              return handler.resolve(await _dio.fetch(error.requestOptions));
            } catch (_) {}
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<Map<String, dynamic>> login({required String email, required String password}) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    // Decode role/tenantId from JWT payload
    final parts = (res.data['accessToken'] as String).split('.');
    final payload = String.fromCharCodes(
      base64Url.decode(base64Url.normalize(parts[1])),
    );
    final decoded = jsonDecode(payload) as Map<String, dynamic>;
    return {
      ...res.data,
      'role': decoded['role'],
      'tenantId': decoded['tenantId'],
      'userId': decoded['sub'],
    };
  }

  Future<Map<String, dynamic>> getJobs({String? status}) async {
    final res = await _dio.get('/mobile/jobs', queryParameters: status != null ? {'status': status} : null);
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getJob(String id) async {
    final res = await _dio.get('/mobile/jobs/$id');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateJobStatus(String id, String status, {String? notes}) async {
    final res = await _dio.patch('/mobile/jobs/$id/status', data: {'status': status, if (notes != null) 'notes': notes});
    return res.data as Map<String, dynamic>;
  }
}

// ignore: avoid-importing-entrypoint-exports
import 'dart:convert';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
