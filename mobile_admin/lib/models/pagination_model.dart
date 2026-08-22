class PaginatedResult<T> {
  final List<T> data;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const PaginatedResult({
    required this.data,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  factory PaginatedResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final rawList = json['data'] as List? ?? [];
    return PaginatedResult(
      data: rawList.map((e) => fromItem(e as Map<String, dynamic>)).toList(),
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      total: json['total'] as int? ?? rawList.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }

  bool get hasMore => page < totalPages;
}
