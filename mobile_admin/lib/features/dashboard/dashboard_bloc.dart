import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../core/network/api_client.dart';

// ── State ────────────────────────────────────────────────
class DashboardSummary extends Equatable {
  final int totalJobs;
  final int activeJobs;
  final int deliveredJobs;
  final int dueToday;
  final double totalBilled;
  final double totalOutstanding;
  final int lowStockAlerts;

  const DashboardSummary({
    required this.totalJobs, required this.activeJobs, required this.deliveredJobs,
    required this.dueToday, required this.totalBilled, required this.totalOutstanding,
    required this.lowStockAlerts,
  });

  static int _i(dynamic v) => int.tryParse(v?.toString() ?? '') ?? 0;
  static double _d(dynamic v) => double.tryParse(v?.toString() ?? '') ?? 0;

  factory DashboardSummary.fromJson(Map<String, dynamic> j) => DashboardSummary(
    totalJobs: _i(j['jobs']?['total_jobs']),
    activeJobs: _i(j['jobs']?['active_jobs']),
    deliveredJobs: _i(j['jobs']?['delivered_jobs']),
    dueToday: _i(j['jobs']?['due_today']),
    totalBilled: _d(j['billing']?['total_billed']),
    totalOutstanding: _d(j['billing']?['total_outstanding']),
    lowStockAlerts: _i(j['low_stock_alerts']),
  );

  @override List<Object?> get props => [totalJobs, activeJobs];
}

abstract class DashboardState extends Equatable {
  const DashboardState();
  @override List<Object?> get props => [];
}
class DashboardInitial extends DashboardState { const DashboardInitial(); }
class DashboardLoading extends DashboardState { const DashboardLoading(); }
class DashboardLoaded extends DashboardState {
  final DashboardSummary summary;
  final List<Map<String, dynamic>> recentJobs;
  const DashboardLoaded({required this.summary, required this.recentJobs});
  @override List<Object?> get props => [summary];
}
class DashboardError extends DashboardState {
  final String message;
  const DashboardError(this.message);
  @override List<Object?> get props => [message];
}

// ── Events ───────────────────────────────────────────────
abstract class DashboardEvent extends Equatable {
  const DashboardEvent();
  @override List<Object?> get props => [];
}
class DashboardLoadRequested extends DashboardEvent { const DashboardLoadRequested(); }
class DashboardRefreshRequested extends DashboardEvent { const DashboardRefreshRequested(); }

// ── BLoC ─────────────────────────────────────────────────
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  DashboardBloc() : super(const DashboardInitial()) {
    on<DashboardLoadRequested>(_onLoad);
    on<DashboardRefreshRequested>(_onLoad);
  }

  Future<void> _onLoad(DashboardEvent event, Emitter<DashboardState> emit) async {
    if (state is! DashboardLoaded) emit(const DashboardLoading());
    try {
      final results = await Future.wait([
        ApiClient.instance.get('/admin/reports/summary'),
        ApiClient.instance.get('/admin/jobs', queryParameters: {'limit': 5, 'sortBy': 'created_at', 'sortDir': 'desc'}),
      ]);
      final summary = DashboardSummary.fromJson(results[0].data as Map<String, dynamic>);
      final recentJobs = List<Map<String, dynamic>>.from((results[1].data['data'] as List? ?? []));
      emit(DashboardLoaded(summary: summary, recentJobs: recentJobs));
    } catch (e) {
      emit(DashboardError(e.toString()));
    }
  }
}
