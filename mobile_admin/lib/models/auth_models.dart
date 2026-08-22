class LoginRequest {
  final String email;
  final String password;
  const LoginRequest({required this.email, required this.password});
  Map<String, dynamic> toJson() => {'email': email, 'password': password};
}

class LoginResponse {
  final String accessToken;
  final String refreshToken;
  const LoginResponse({required this.accessToken, required this.refreshToken});
  factory LoginResponse.fromJson(Map<String, dynamic> j) => LoginResponse(
    accessToken: j['accessToken'] as String,
    refreshToken: j['refreshToken'] as String,
  );
}

class MeResponse {
  final String id;
  final String role;
  final String? tenantId;
  final List<String> permissions;
  const MeResponse({required this.id, required this.role, this.tenantId, required this.permissions});
  factory MeResponse.fromJson(Map<String, dynamic> j) => MeResponse(
    id: j['id'] as String,
    role: j['role'] as String,
    tenantId: j['tenantId'] as String?,
    permissions: List<String>.from(j['permissions'] as List? ?? []),
  );

  bool get isOwner => role == 'owner';
  bool get isSuperAdmin => role == 'super_admin';
  bool get isSubAdmin => role == 'sub_admin';
  bool get isStaff => role == 'staff' || role == 'operator';

  bool hasPerm(String perm) {
    if (role == 'owner' || role == 'super_admin') return true;
    return permissions.contains(perm);
  }
}
