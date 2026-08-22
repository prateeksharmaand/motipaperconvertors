import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../core/network/api_client.dart';
import '../../models/job_model.dart';
import '../../models/pagination_model.dart';

// ── Events ────────────────────────────────────────────────
abstract class JobsEvent extends Equatable {
  const JobsEvent();
  @override List<Object?> get props => [];
}
class JobsLoadRequested extends JobsEvent {
  final bool reset;
  const JobsLoadRequested({this.reset = false});
}
class JobsSearchChanged extends JobsEvent {
  final String query;
  const JobsSearchChanged(this.query);
  @override List<Object?> get props => [query];
}
class JobsFilterChanged extends JobsEvent {
  final String? status;
  final String? clientId;
  final String? machineId;
  const JobsFilterChanged({this.status, this.clientId, this.machineId});
  @override List<Object?> get props => [status, clientId, machineId];
}
class JobsFilterCleared extends JobsEvent { const JobsFilterCleared(); }
class JobsNextPageRequested extends JobsEvent { const JobsNextPageRequested(); }
class JobsStatusChanged extends JobsEvent {
  final String jobId;
  final String newStatus;
  final String? notes;
  const JobsStatusChanged(this.jobId, this.newStatus, {this.notes});
  @override List<Object?> get props => [jobId, newStatus];
}

// ── State ─────────────────────────────────────────────────
class JobsState extends Equatable {
  final List<Job> jobs;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final int total;
  final String search;
  final String? statusFilter;
  final String? clientFilter;
  final String? machineFilter;
  final String? error;

  const JobsState({
    this.jobs = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = false,
    this.page = 1,
    this.total = 0,
    this.search = '',
    this.statusFilter,
    this.clientFilter,
    this.machineFilter,
    this.error,
  });

  bool get hasActiveFilters => statusFilter != null || clientFilter != null || machineFilter != null || search.isNotEmpty;

  JobsState copyWith({
    List<Job>? jobs, bool? isLoading, bool? isLoadingMore, bool? hasMore,
    int? page, int? total, String? search,
    String? statusFilter, bool clearStatus = false,
    String? clientFilter, bool clearClient = false,
    String? machineFilter, bool clearMachine = false,
    String? error, bool clearError = false,
  }) => JobsState(
    jobs: jobs ?? this.jobs,
    isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    hasMore: hasMore ?? this.hasMore,
    page: page ?? this.page,
    total: total ?? this.total,
    search: search ?? this.search,
    statusFilter: clearStatus ? null : (statusFilter ?? this.statusFilter),
    clientFilter: clearClient ? null : (clientFilter ?? this.clientFilter),
    machineFilter: clearMachine ? null : (machineFilter ?? this.machineFilter),
    error: clearError ? null : (error ?? this.error),
  );

  @override List<Object?> get props => [jobs, isLoading, isLoadingMore, page, search, statusFilter];
}

// ── BLoC ──────────────────────────────────────────────────
class JobsBloc extends Bloc<JobsEvent, JobsState> {
  static const _limit = 20;

  JobsBloc() : super(const JobsState()) {
    on<JobsLoadRequested>(_onLoad);
    on<JobsSearchChanged>(_onSearch);
    on<JobsFilterChanged>(_onFilter);
    on<JobsFilterCleared>(_onClearFilter);
    on<JobsNextPageRequested>(_onNextPage);
    on<JobsStatusChanged>(_onStatusChange);
  }

  Map<String, dynamic> get _params => {
    'limit': _limit,
    'sortBy': 'created_at',
    'sortDir': 'desc',
    if (state.search.isNotEmpty) 'search': state.search,
    if (state.statusFilter != null) 'status': state.statusFilter,
    if (state.clientFilter != null) 'clientId': state.clientFilter,
    if (state.machineFilter != null) 'machineId': state.machineFilter,
  };

  Future<void> _onLoad(JobsLoadRequested event, Emitter<JobsState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/jobs', queryParameters: {..._params, 'page': 1});
      final result = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Job.fromJson);
      emit(state.copyWith(jobs: result.data, isLoading: false, page: 1, total: result.total, hasMore: result.hasMore));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: e.toString()));
    }
  }

  Future<void> _onSearch(JobsSearchChanged event, Emitter<JobsState> emit) async {
    emit(state.copyWith(search: event.query));
    await _onLoad(const JobsLoadRequested(), emit);
  }

  Future<void> _onFilter(JobsFilterChanged event, Emitter<JobsState> emit) async {
    emit(state.copyWith(
      statusFilter: event.status, clearStatus: event.status == null,
      clientFilter: event.clientId, clearClient: event.clientId == null,
      machineFilter: event.machineId, clearMachine: event.machineId == null,
    ));
    await _onLoad(const JobsLoadRequested(), emit);
  }

  Future<void> _onClearFilter(JobsFilterCleared event, Emitter<JobsState> emit) async {
    emit(state.copyWith(clearStatus: true, clearClient: true, clearMachine: true, search: ''));
    await _onLoad(const JobsLoadRequested(), emit);
  }

  Future<void> _onNextPage(JobsNextPageRequested event, Emitter<JobsState> emit) async {
    if (!state.hasMore || state.isLoadingMore) return;
    emit(state.copyWith(isLoadingMore: true));
    try {
      final nextPage = state.page + 1;
      final res = await ApiClient.instance.get('/admin/jobs', queryParameters: {..._params, 'page': nextPage});
      final result = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Job.fromJson);
      emit(state.copyWith(jobs: [...state.jobs, ...result.data], isLoadingMore: false, page: nextPage, hasMore: result.hasMore));
    } catch (_) {
      emit(state.copyWith(isLoadingMore: false));
    }
  }

  Future<void> _onStatusChange(JobsStatusChanged event, Emitter<JobsState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/jobs/${event.jobId}/status', data: {
        'status': event.newStatus,
        if (event.notes != null) 'notes': event.notes,
      });
      // Refresh list
      add(const JobsLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: 'Failed to update status'));
    }
  }
}
