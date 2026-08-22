class AppConstants {
  AppConstants._();

  // API
  static const String baseUrl = 'https://admin.motipaperconvertors.com/api/v1';
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 60);

  // Auth
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userRoleKey = 'user_role';
  static const String tenantIdKey = 'tenant_id';
  static const String userIdKey = 'user_id';
  static const String permissionsKey = 'permissions';

  // Pagination
  static const int defaultPageSize = 20;
  static const int tabletsPageSize = 50;

  // Responsive breakpoints
  static const double phoneBreakpoint = 600;
  static const double tabletBreakpoint = 900;
  static const double sidebarWidth = 260.0;
  static const double navigationRailWidth = 72.0;
}
