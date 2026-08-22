import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../models/pagination_model.dart';

// ── Model ─────────────────────────────────────────────────
class ActivityLog extends Equatable {
  final String id;
  final String? userName;
  final String? userEmail;
  final String? userRole;
  final String category;
  final String action;
  final String? module;
  final String? description;
  final String? entityType;
  final String? entityName;
  final String status;
  final String? ipAddress;
  final String? createdAt;
  final Map<String, dynamic>? before;
  final Map<String, dynamic>? after;
  final List<String> changedFields;

  const ActivityLog({required this.id, this.userName, this.userEmail, this.userRole, required this.category, required this.action, this.module, this.description, this.entityType, this.entityName, required this.status, this.ipAddress, this.createdAt, this.before, this.after, this.changedFields = const []});

  factory ActivityLog.fromJson(Map<String, dynamic> j) => ActivityLog(
    id: j['id'] as String,
    userName: j['user_name'] as String?,
    userEmail: j['user_email'] as String?,
    userRole: j['user_role'] as String?,
    category: j['category'] as String? ?? '',
    action: j['action'] as String? ?? '',
    module: j['module'] as String?,
    description: j['description'] as String?,
    entityType: j['entity_type'] as String?,
    entityName: j['entity_name'] as String?,
    status: j['status'] as String? ?? 'SUCCESS',
    ipAddress: j['ip_address'] as String?,
    createdAt: j['created_at'] as String?,
    before: j['before'] as Map<String, dynamic>?,
    after: j['after'] as Map<String, dynamic>?,
    changedFields: List<String>.from(j['changed_fields'] as List? ?? []),
  );

  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class ActivityLogEvent extends Equatable {
  const ActivityLogEvent();
  @override List<Object?> get props => [];
}
class ActivityLogLoadRequested extends ActivityLogEvent { const ActivityLogLoadRequested(); }
class ActivityLogSearchChanged extends ActivityLogEvent { final String q; const ActivityLogSearchChanged(this.q); @override List<Object?> get props => [q]; }
class ActivityLogCategoryChanged extends ActivityLogEvent { final String? cat; const ActivityLogCategoryChanged(this.cat); @override List<Object?> get props => [cat]; }
class ActivityLogStatusChanged extends ActivityLogEvent { final String? s; const ActivityLogStatusChanged(this.s); @override List<Object?> get props => [s]; }
class ActivityLogNextPage extends ActivityLogEvent { const ActivityLogNextPage(); }
class ActivityLogFiltersCleared extends ActivityLogEvent { const ActivityLogFiltersCleared(); }

class ActivityLogState extends Equatable {
  final List<ActivityLog> logs;
  final bool isLoading, isLoadingMore, hasMore;
  final int page, total;
  final String search;
  final String? categoryFilter;
  final String? statusFilter;
  final Map<String, dynamic> summary;
  final String? error;

  const ActivityLogState({this.logs = const [], this.isLoading = false, this.isLoadingMore = false, this.hasMore = false, this.page = 1, this.total = 0, this.search = '', this.categoryFilter, this.statusFilter, this.summary = const {}, this.error});

  bool get hasActiveFilters => search.isNotEmpty || categoryFilter != null || statusFilter != null;

  ActivityLogState copyWith({List<ActivityLog>? logs, bool? isLoading, bool? isLoadingMore, bool? hasMore, int? page, int? total, String? search, String? categoryFilter, bool clearCat = false, String? statusFilter, bool clearStatus = false, Map<String, dynamic>? summary, String? error, bool clearError = false}) => ActivityLogState(
    logs: logs ?? this.logs, isLoading: isLoading ?? this.isLoading, isLoadingMore: isLoadingMore ?? this.isLoadingMore, hasMore: hasMore ?? this.hasMore, page: page ?? this.page, total: total ?? this.total,
    search: search ?? this.search, categoryFilter: clearCat ? null : (categoryFilter ?? this.categoryFilter), statusFilter: clearStatus ? null : (statusFilter ?? this.statusFilter),
    summary: summary ?? this.summary, error: clearError ? null : (error ?? this.error),
  );

  @override List<Object?> get props => [logs, isLoading, page, search, categoryFilter, statusFilter];
}

// ── BLoC ─────────────────────────────────────────────────
class ActivityLogBloc extends Bloc<ActivityLogEvent, ActivityLogState> {
  ActivityLogBloc() : super(const ActivityLogState()) {
    on<ActivityLogLoadRequested>(_onLoad);
    on<ActivityLogSearchChanged>(_onSearch);
    on<ActivityLogCategoryChanged>(_onCategory);
    on<ActivityLogStatusChanged>(_onStatus);
    on<ActivityLogNextPage>(_onNextPage);
    on<ActivityLogFiltersCleared>(_onClear);
  }

  Map<String, dynamic> get _params => {
    'limit': 25, 'sortDir': 'desc',
    if (state.search.isNotEmpty) 'search': state.search,
    if (state.categoryFilter != null) 'category': state.categoryFilter,
    if (state.statusFilter != null) 'status': state.statusFilter,
  };

  Future<void> _onLoad(ActivityLogLoadRequested _, Emitter<ActivityLogState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/admin/activity-logs', queryParameters: {..._params, 'page': 1}),
        ApiClient.instance.get('/admin/activity-logs/summary'),
      ]);
      final r = PaginatedResult.fromJson(results[0].data as Map<String, dynamic>, ActivityLog.fromJson);
      emit(state.copyWith(logs: r.data, isLoading: false, page: 1, total: r.total, hasMore: r.hasMore, summary: results[1].data as Map<String, dynamic>));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onSearch(ActivityLogSearchChanged e, Emitter<ActivityLogState> emit) async {
    emit(state.copyWith(search: e.q));
    await _onLoad(const ActivityLogLoadRequested(), emit);
  }

  Future<void> _onCategory(ActivityLogCategoryChanged e, Emitter<ActivityLogState> emit) async {
    emit(state.copyWith(categoryFilter: e.cat, clearCat: e.cat == null));
    await _onLoad(const ActivityLogLoadRequested(), emit);
  }

  Future<void> _onStatus(ActivityLogStatusChanged e, Emitter<ActivityLogState> emit) async {
    emit(state.copyWith(statusFilter: e.s, clearStatus: e.s == null));
    await _onLoad(const ActivityLogLoadRequested(), emit);
  }

  Future<void> _onNextPage(ActivityLogNextPage _, Emitter<ActivityLogState> emit) async {
    if (!state.hasMore || state.isLoadingMore) return;
    emit(state.copyWith(isLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/activity-logs', queryParameters: {..._params, 'page': state.page + 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, ActivityLog.fromJson);
      emit(state.copyWith(logs: [...state.logs, ...r.data], isLoadingMore: false, page: state.page + 1, hasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(isLoadingMore: false)); }
  }

  Future<void> _onClear(ActivityLogFiltersCleared _, Emitter<ActivityLogState> emit) async {
    emit(state.copyWith(search: '', clearCat: true, clearStatus: true));
    await _onLoad(const ActivityLogLoadRequested(), emit);
  }
}

// ── Screen ────────────────────────────────────────────────
class ActivityLogScreen extends StatelessWidget {
  const ActivityLogScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => ActivityLogBloc()..add(const ActivityLogLoadRequested()),
        child: const _ActivityLogView(),
      );
}

class _ActivityLogView extends StatefulWidget {
  const _ActivityLogView();
  @override State<_ActivityLogView> createState() => _ActivityLogViewState();
}

class _ActivityLogViewState extends State<_ActivityLogView> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  static const _categories = ['AUTH', 'JOB', 'BILLING', 'INVENTORY', 'USER', 'SETTINGS', 'SECURITY', 'SYSTEM'];
  static const _statuses = ['SUCCESS', 'FAILED', 'DENIED'];

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<ActivityLogBloc>().add(const ActivityLogNextPage());
      }
    });
  }

  @override
  void dispose() { _searchCtrl.dispose(); _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ActivityLogBloc, ActivityLogState>(
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<ActivityLogBloc>().add(const ActivityLogLoadRequested()),
          child: CustomScrollView(controller: _scrollCtrl, slivers: [
            SliverAppBar(
              floating: true, title: const Text('Activity Log'),
              backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
              actions: [
                if (state.hasActiveFilters)
                  TextButton(onPressed: () { _searchCtrl.clear(); context.read<ActivityLogBloc>().add(const ActivityLogFiltersCleared()); }, child: const Text('Clear', style: TextStyle(color: AppColors.error))),
                IconButton(icon: const Icon(Icons.filter_list_outlined), onPressed: () => _showFilters(context, state)),
                const SizedBox(width: 8),
              ],
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(56),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => context.read<ActivityLogBloc>().add(ActivityLogSearchChanged(v)),
                    decoration: InputDecoration(
                      hintText: 'Search user, action, entity…',
                      prefixIcon: const Icon(Icons.search, size: 20), isDense: true,
                      suffixIcon: _searchCtrl.text.isNotEmpty ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); context.read<ActivityLogBloc>().add(const ActivityLogSearchChanged('')); }) : null,
                    ),
                  ),
                ),
              ),
            ),

            // Summary stats
            if (state.summary.isNotEmpty)
              SliverToBoxAdapter(child: _SummaryRow(summary: state.summary)),

            // Active filters
            if (state.hasActiveFilters)
              SliverToBoxAdapter(child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                child: Row(children: [
                  if (state.categoryFilter != null) _chip(context, state.categoryFilter!, () => context.read<ActivityLogBloc>().add(const ActivityLogCategoryChanged(null))),
                  if (state.statusFilter != null) _chip(context, state.statusFilter!, () => context.read<ActivityLogBloc>().add(const ActivityLogStatusChanged(null))),
                  if (state.search.isNotEmpty) _chip(context, '"${state.search}"', () { _searchCtrl.clear(); context.read<ActivityLogBloc>().add(const ActivityLogSearchChanged('')); }),
                ]),
              )),

            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('${state.total} entries', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            )),

            if (state.isLoading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (state.logs.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.history_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text(state.hasActiveFilters ? 'No logs match your filters' : 'No activity logs yet', style: const TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (i == state.logs.length) {
                      return state.isLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                    }
                    return _LogCard(log: state.logs[i]);
                  },
                  childCount: state.logs.length + 1,
                )),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _chip(BuildContext ctx, String label, VoidCallback onRemove) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Chip(label: Text(label, style: const TextStyle(fontSize: 12)), deleteIcon: const Icon(Icons.close, size: 14), onDeleted: onRemove, backgroundColor: AppColors.primaryLight, side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3))),
  );

  void _showFilters(BuildContext context, ActivityLogState state) {
    final bloc = context.read<ActivityLogBloc>();
    String? selCat = state.categoryFilter;
    String? selStatus = state.statusFilter;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Filter Activity Logs', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            TextButton(onPressed: () { Navigator.pop(ctx); bloc.add(const ActivityLogFiltersCleared()); }, child: const Text('Reset')),
          ]),
          const SizedBox(height: 16),
          const Text('Category', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: _categories.map((c) {
            final sel = selCat == c;
            return FilterChip(label: Text(c, style: TextStyle(fontSize: 12, color: sel ? Colors.white : AppColors.textSecondary, fontWeight: FontWeight.w600)), selected: sel, onSelected: (_) => setModal(() => selCat = sel ? null : c), selectedColor: AppColors.primary, checkmarkColor: Colors.white);
          }).toList()),
          const SizedBox(height: 16),
          const Text('Status', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: _statuses.map((s) {
            final sel = selStatus == s;
            final c = s == 'SUCCESS' ? AppColors.success : s == 'FAILED' ? AppColors.error : AppColors.warning;
            return FilterChip(label: Text(s, style: TextStyle(fontSize: 12, color: sel ? Colors.white : c, fontWeight: FontWeight.w600)), selected: sel, onSelected: (_) => setModal(() => selStatus = sel ? null : s), selectedColor: c, checkmarkColor: Colors.white, backgroundColor: c.withValues(alpha: 0.1), side: BorderSide(color: c.withValues(alpha: 0.4)));
          }).toList()),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () { Navigator.pop(ctx); bloc.add(ActivityLogCategoryChanged(selCat)); if (selStatus != state.statusFilter) bloc.add(ActivityLogStatusChanged(selStatus)); },
            child: const Text('Apply'),
          )),
        ]),
      )),
    );
  }
}

// ── Summary row ───────────────────────────────────────────
class _SummaryRow extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Total', '${summary['total'] ?? 0}', AppColors.primary),
      ('Today', '${summary['today'] ?? 0}', AppColors.info),
      ('Failed', '${summary['failed'] ?? 0}', AppColors.error),
      ('Security', '${summary['security'] ?? 0}', AppColors.warning),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(children: stats.map((s) => Container(
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: s.$3.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: s.$3.withValues(alpha: 0.25))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.$2, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: s.$3)),
          Text(s.$1, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ]),
      )).toList()),
    );
  }
}

// ── Log card ──────────────────────────────────────────────
class _LogCard extends StatelessWidget {
  final ActivityLog log;
  const _LogCard({required this.log});

  static const _catColors = {
    'AUTH': AppColors.primary, 'JOB': AppColors.success, 'BILLING': AppColors.secondary,
    'INVENTORY': AppColors.info, 'USER': AppColors.warning, 'SECURITY': AppColors.error,
    'SETTINGS': AppColors.textMuted, 'SYSTEM': AppColors.textMuted,
  };

  @override
  Widget build(BuildContext context) {
    final catColor = _catColors[log.category] ?? AppColors.textMuted;
    final statusColor = log.status == 'SUCCESS' ? AppColors.success : log.status == 'FAILED' ? AppColors.error : AppColors.warning;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showDetail(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Column(children: [
              Container(padding: const EdgeInsets.all(4), decoration: BoxDecoration(color: catColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)), child: Icon(Icons.history, size: 16, color: catColor)),
              const SizedBox(height: 4),
              Container(width: 8, height: 8, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
            ]),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: catColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)), child: Text(log.category, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: catColor))),
                const SizedBox(width: 6),
                Expanded(child: Text(log.action, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              if (log.description != null) ...[
                const SizedBox(height: 3),
                Text(log.description!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
              const SizedBox(height: 4),
              Row(children: [
                if (log.userName != null) ...[
                  const Icon(Icons.person_outline, size: 12, color: AppColors.textMuted),
                  const SizedBox(width: 3),
                  Text(log.userName!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  const SizedBox(width: 8),
                ],
                if (log.module != null) ...[
                  Text(log.module!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  const SizedBox(width: 8),
                ],
                const Spacer(),
                Text(Fmt.dateTime(log.createdAt), style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ]),
            ])),
          ]),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6, maxChildSize: 0.95, minChildSize: 0.4, expand: false,
        builder: (_, ctrl) => ListView(controller: ctrl, padding: const EdgeInsets.all(20), children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)), margin: const EdgeInsets.only(bottom: 16))),
          Text('Activity Log Detail', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          _detailRow('Action', log.action),
          _detailRow('Category', log.category),
          if (log.module != null) _detailRow('Module', log.module!),
          if (log.description != null) _detailRow('Description', log.description!),
          if (log.userName != null) _detailRow('User', '${log.userName} (${log.userRole ?? '—'})'),
          if (log.userEmail != null) _detailRow('Email', log.userEmail!),
          if (log.entityType != null) _detailRow('Entity', '${log.entityType}: ${log.entityName ?? log.entityType}'),
          _detailRow('Status', log.status),
          if (log.ipAddress != null) _detailRow('IP Address', log.ipAddress!),
          _detailRow('Time', Fmt.dateTime(log.createdAt)),
          if (log.changedFields.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Changed Fields', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: log.changedFields.map((f) => Chip(label: Text(f, style: const TextStyle(fontSize: 11)), backgroundColor: AppColors.warningLight)).toList()),
          ],
          if (log.before != null || log.after != null) ...[
            const SizedBox(height: 12),
            const Text('Changes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(8)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (log.before != null) ...[
                const Text('Before', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                const SizedBox(height: 4),
                Text(log.before.toString(), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontFamily: 'monospace')),
              ],
              if (log.after != null) ...[
                const SizedBox(height: 8),
                const Text('After', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                const SizedBox(height: 4),
                Text(log.after.toString(), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontFamily: 'monospace')),
              ],
            ])),
          ],
        ]),
      ),
    );
  }

  Widget _detailRow(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 90, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500))),
      const SizedBox(width: 8),
      Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
    ]),
  );
}
