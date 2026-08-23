import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../models/pagination_model.dart';

// ── Model ─────────────────────────────────────────────────
class Tenant extends Equatable {
  final String id;
  final String name;
  final String slug;
  final String status;
  final String plan;
  final String? email;
  final String? phone;
  final String? city;
  final String? createdAt;

  const Tenant({required this.id, required this.name, required this.slug, required this.status, required this.plan, this.email, this.phone, this.city, this.createdAt});

  factory Tenant.fromJson(Map<String, dynamic> j) => Tenant(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    slug: j['slug'] as String? ?? '',
    status: j['status'] as String? ?? 'active',
    plan: j['plan'] as String? ?? 'free',
    email: j['email'] as String?,
    phone: j['phone'] as String?,
    city: j['city'] as String?,
    createdAt: j['created_at'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class TenantsEvent extends Equatable {
  const TenantsEvent();
  @override List<Object?> get props => [];
}
class TenantsLoadRequested extends TenantsEvent { const TenantsLoadRequested(); }
class TenantsNextPage extends TenantsEvent { const TenantsNextPage(); }
class TenantStatusChanged extends TenantsEvent {
  final String id;
  final String status;
  const TenantStatusChanged(this.id, this.status);
  @override List<Object?> get props => [id, status];
}
class TenantCreated extends TenantsEvent {
  final String pressName, ownerName, email, phone, password, city;
  const TenantCreated({required this.pressName, required this.ownerName, required this.email, required this.phone, required this.password, required this.city});
  @override List<Object?> get props => [email];
}

class TenantsState extends Equatable {
  final List<Tenant> tenants;
  final bool isLoading, isLoadingMore, hasMore;
  final int page, total;
  final String? error;
  final String? success;

  const TenantsState({this.tenants = const [], this.isLoading = false, this.isLoadingMore = false, this.hasMore = false, this.page = 1, this.total = 0, this.error, this.success});

  TenantsState copyWith({List<Tenant>? tenants, bool? isLoading, bool? isLoadingMore, bool? hasMore, int? page, int? total, String? error, bool clearError = false, String? success, bool clearSuccess = false}) => TenantsState(
    tenants: tenants ?? this.tenants,
    isLoading: isLoading ?? this.isLoading,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    hasMore: hasMore ?? this.hasMore,
    page: page ?? this.page,
    total: total ?? this.total,
    error: clearError ? null : (error ?? this.error),
    success: clearSuccess ? null : (success ?? this.success),
  );

  @override List<Object?> get props => [tenants, isLoading, page];
}

// ── BLoC ─────────────────────────────────────────────────
class TenantsBloc extends Bloc<TenantsEvent, TenantsState> {
  TenantsBloc() : super(const TenantsState()) {
    on<TenantsLoadRequested>(_onLoad);
    on<TenantsNextPage>(_onNextPage);
    on<TenantStatusChanged>(_onStatusChange);
    on<TenantCreated>(_onCreate);
  }

  Future<void> _onLoad(TenantsLoadRequested _, Emitter<TenantsState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/platform/tenants', queryParameters: {'limit': 20, 'page': 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Tenant.fromJson);
      emit(state.copyWith(tenants: r.data, isLoading: false, page: 1, total: r.total, hasMore: r.hasMore));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onNextPage(TenantsNextPage _, Emitter<TenantsState> emit) async {
    if (!state.hasMore || state.isLoadingMore) return;
    emit(state.copyWith(isLoadingMore: true));
    try {
      final res = await ApiClient.instance.get('/admin/platform/tenants', queryParameters: {'limit': 20, 'page': state.page + 1});
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, Tenant.fromJson);
      emit(state.copyWith(tenants: [...state.tenants, ...r.data], isLoadingMore: false, page: state.page + 1, hasMore: r.hasMore));
    } catch (_) { emit(state.copyWith(isLoadingMore: false)); }
  }

  Future<void> _onStatusChange(TenantStatusChanged event, Emitter<TenantsState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/platform/tenants/${event.id}/status', data: {'status': event.status});
      emit(state.copyWith(success: 'Tenant ${event.status}'));
      add(const TenantsLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to update status')); }
  }

  Future<void> _onCreate(TenantCreated event, Emitter<TenantsState> emit) async {
    try {
      await ApiClient.instance.post('/admin/platform/tenants', data: {
        'pressName': event.pressName,
        'ownerName': event.ownerName,
        'email': event.email,
        'phone': event.phone,
        'password': event.password,
        'city': event.city,
      });
      emit(state.copyWith(success: 'Tenant created'));
      add(const TenantsLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to create tenant')); }
  }
}

// ── Screen ────────────────────────────────────────────────
class TenantsScreen extends StatelessWidget {
  const TenantsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => TenantsBloc()..add(const TenantsLoadRequested()),
        child: const _TenantsView(),
      );
}

class _TenantsView extends StatefulWidget {
  const _TenantsView();
  @override State<_TenantsView> createState() => _TenantsViewState();
}

class _TenantsViewState extends State<_TenantsView> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
        context.read<TenantsBloc>().add(const TenantsNextPage());
      }
    });
  }

  @override
  void dispose() { _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TenantsBloc, TenantsState>(
      listener: (ctx, state) {
        if (state.error != null) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error!), backgroundColor: AppColors.error));
        if (state.success != null) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.success!), backgroundColor: AppColors.success));
      },
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<TenantsBloc>().add(const TenantsLoadRequested()),
          child: CustomScrollView(controller: _scrollCtrl, slivers: [
            SliverAppBar(
              floating: true,
              title: Row(children: [
                const Text('Tenants'),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                  child: Text('${state.total}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
                ),
              ]),
              backgroundColor: AppColors.surface,
              surfaceTintColor: Colors.transparent,
            ),
            if (state.isLoading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (state.tenants.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.business_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No tenants yet', style: TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (i == state.tenants.length) return state.isLoadingMore ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2))) : const SizedBox.shrink();
                    return _TenantCard(tenant: state.tenants[i]);
                  },
                  childCount: state.tenants.length + 1,
                )),
              ),
          ]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _showCreateSheet(context),
          icon: const Icon(Icons.add_business_outlined),
          label: const Text('New Tenant'),
        ),
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    final bloc = context.read<TenantsBloc>();
    final pressCtrl = TextEditingController();
    final ownerCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passCtrl  = TextEditingController();
    final cityCtrl  = TextEditingController();
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Create New Tenant', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: pressCtrl, decoration: const InputDecoration(labelText: 'Press Name *')),
          const SizedBox(height: 12),
          TextField(controller: ownerCtrl, decoration: const InputDecoration(labelText: 'Owner Name *')),
          const SizedBox(height: 12),
          TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Owner Email *')),
          const SizedBox(height: 12),
          TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone *')),
          const SizedBox(height: 12),
          TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Password *')),
          const SizedBox(height: 12),
          TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'City')),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: saving ? null : () async {
              if ([pressCtrl, ownerCtrl, emailCtrl, phoneCtrl, passCtrl].any((c) => c.text.isEmpty)) return;
              setModal(() => saving = true);
              Navigator.pop(ctx);
              bloc.add(TenantCreated(pressName: pressCtrl.text, ownerName: ownerCtrl.text, email: emailCtrl.text, phone: phoneCtrl.text, password: passCtrl.text, city: cityCtrl.text));
            },
            child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create Tenant'),
          ),
        ])),
      )),
    );
  }
}

class _TenantCard extends StatelessWidget {
  final Tenant tenant;
  const _TenantCard({required this.tenant});

  static const _planColors = {'free': AppColors.textMuted, 'starter': AppColors.info, 'pro': AppColors.secondary};
  static const _statusColors = {'active': AppColors.success, 'suspended': AppColors.error};

  @override
  Widget build(BuildContext context) {
    final active = tenant.status == 'active';
    final planColor = _planColors[tenant.plan] ?? AppColors.textMuted;
    final statusColor = _statusColors[tenant.status] ?? AppColors.textMuted;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: active ? AppColors.primaryLight : AppColors.borderLight, borderRadius: BorderRadius.circular(10)),
              child: Center(child: Text(tenant.name.isNotEmpty ? tenant.name[0].toUpperCase() : '?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: active ? AppColors.primary : AppColors.textMuted))),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tenant.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              Text(tenant.slug, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)), child: Text(tenant.status.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: statusColor))),
              const SizedBox(height: 4),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: planColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)), child: Text(tenant.plan.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: planColor))),
            ]),
          ]),
          if (tenant.email != null || tenant.city != null) ...[
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Row(children: [
              if (tenant.email != null) ...[
                const Icon(Icons.email_outlined, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(child: Text(tenant.email!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted), overflow: TextOverflow.ellipsis)),
              ],
              if (tenant.city != null) ...[
                const Icon(Icons.location_on_outlined, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 2),
                Text(tenant.city!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ],
              const Spacer(),
              Text(Fmt.date(tenant.createdAt), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            ]),
          ],
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            if (active)
              OutlinedButton.icon(
                onPressed: () => showDialog(context: context, builder: (_) => AlertDialog(
                  title: const Text('Suspend Tenant?'),
                  content: Text('This will suspend "${tenant.name}" and prevent all logins.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                    ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.error), onPressed: () { Navigator.pop(context); context.read<TenantsBloc>().add(TenantStatusChanged(tenant.id, 'suspended')); }, child: const Text('Suspend')),
                  ],
                )),
                icon: const Icon(Icons.pause_circle_outline, size: 16, color: AppColors.error),
                label: const Text('Suspend', style: TextStyle(color: AppColors.error)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
              )
            else
              ElevatedButton.icon(
                onPressed: () => context.read<TenantsBloc>().add(TenantStatusChanged(tenant.id, 'active')),
                icon: const Icon(Icons.play_circle_outline, size: 16),
                label: const Text('Activate'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.success, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
              ),
          ]),
        ]),
      ),
    );
  }
}
