import '../../core/widgets/shell_scaffold.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';

// ── Model ─────────────────────────────────────────────────
class SubAdmin extends Equatable {
  final String id;
  final String name;
  final String email;
  final String status;
  final List<String> permissions;

  const SubAdmin({required this.id, required this.name, required this.email, required this.status, required this.permissions});

  factory SubAdmin.fromJson(Map<String, dynamic> j) => SubAdmin(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    email: j['email'] as String? ?? '',
    status: j['status'] as String? ?? 'active',
    permissions: [],
  );

  SubAdmin withPermissions(List<String> perms) => SubAdmin(id: id, name: name, email: email, status: status, permissions: perms);

  @override List<Object?> get props => [id];
}

// ── Permission matrix definition ──────────────────────────
const _permissionGroups = [
  (group: 'Jobs',       perms: ['jobs.view', 'jobs.create', 'jobs.edit', 'jobs.delete']),
  (group: 'Quotations', perms: ['quotation.view', 'quotation.create', 'quotation.edit_rates']),
  (group: 'Production', perms: ['production.view', 'production.update_status']),
  (group: 'Inventory',  perms: ['inventory.view', 'inventory.edit', 'inventory.create_po']),
  (group: 'Billing',    perms: ['billing.view', 'billing.create_invoice', 'billing.record_payment']),
  (group: 'Clients',    perms: ['clients.view', 'clients.edit']),
  (group: 'Staff',      perms: ['staff.view', 'staff.manage']),
  (group: 'Reports',    perms: ['reports.view_financial']),
  (group: 'Settings',   perms: ['settings.view', 'settings.edit']),
  (group: 'Activity Log', perms: ['activity_log.view']),
];

String _permLabel(String p) => p.split('.').last.replaceAll('_', ' ').split(' ').map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');

// ── Events & State ────────────────────────────────────────
abstract class SubAdminsEvent extends Equatable {
  const SubAdminsEvent();
  @override List<Object?> get props => [];
}
class SubAdminsLoadRequested extends SubAdminsEvent { const SubAdminsLoadRequested(); }
class SubAdminPermissionsUpdated extends SubAdminsEvent {
  final String id;
  final List<String> permissions;
  const SubAdminPermissionsUpdated(this.id, this.permissions);
  @override List<Object?> get props => [id];
}
class SubAdminCreated extends SubAdminsEvent {
  final String name, email, password;
  const SubAdminCreated(this.name, this.email, this.password);
  @override List<Object?> get props => [email];
}

class SubAdminsState extends Equatable {
  final List<SubAdmin> admins;
  final bool isLoading;
  final String? error;
  final String? success;

  const SubAdminsState({this.admins = const [], this.isLoading = false, this.error, this.success});
  SubAdminsState copyWith({List<SubAdmin>? admins, bool? isLoading, String? error, bool clearError = false, String? success, bool clearSuccess = false}) => SubAdminsState(
    admins: admins ?? this.admins,
    isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
    success: clearSuccess ? null : (success ?? this.success),
  );
  @override List<Object?> get props => [admins, isLoading];
}

// ── BLoC ─────────────────────────────────────────────────
class SubAdminsBloc extends Bloc<SubAdminsEvent, SubAdminsState> {
  SubAdminsBloc() : super(const SubAdminsState()) {
    on<SubAdminsLoadRequested>(_onLoad);
    on<SubAdminPermissionsUpdated>(_onUpdatePermissions);
    on<SubAdminCreated>(_onCreate);
  }

  Future<void> _onLoad(SubAdminsLoadRequested _, Emitter<SubAdminsState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/users', queryParameters: {'role': 'sub_admin', 'limit': 100});
      final rawList = List<Map<String, dynamic>>.from(res.data['data'] as List? ?? []);
      // Load permissions for each sub-admin
      final admins = await Future.wait(rawList.map((j) async {
        final sub = SubAdmin.fromJson(j);
        try {
          final pRes = await ApiClient.instance.get('/admin/users/${sub.id}/permissions');
          final perms = List<String>.from(pRes.data as List? ?? []);
          return sub.withPermissions(perms);
        } catch (_) { return sub; }
      }));
      emit(state.copyWith(admins: admins, isLoading: false));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onUpdatePermissions(SubAdminPermissionsUpdated event, Emitter<SubAdminsState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/users/${event.id}/permissions', data: {'permissions': event.permissions});
      emit(state.copyWith(success: 'Permissions updated'));
      add(const SubAdminsLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to update permissions')); }
  }

  Future<void> _onCreate(SubAdminCreated event, Emitter<SubAdminsState> emit) async {
    try {
      await ApiClient.instance.post('/admin/users', data: {'name': event.name, 'email': event.email, 'password': event.password, 'role': 'sub_admin'});
      emit(state.copyWith(success: 'Sub admin created'));
      add(const SubAdminsLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to create sub admin')); }
  }
}

// ── Screen ────────────────────────────────────────────────
class SubAdminsScreen extends StatelessWidget {
  const SubAdminsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => SubAdminsBloc()..add(const SubAdminsLoadRequested()),
        child: const _SubAdminsView(),
      );
}

class _SubAdminsView extends StatelessWidget {
  const _SubAdminsView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SubAdminsBloc, SubAdminsState>(
      listener: (ctx, state) {
        if (state.error != null) AppToast.error(state.error!);
        if (state.success != null) AppToast.success(state.success!);
      },
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<SubAdminsBloc>().add(const SubAdminsLoadRequested()),
          child: CustomScrollView(slivers: [
            SliverAppBar(pinned: true, leading: IconButton(icon: const Icon(Icons.menu), color: Colors.white, onPressed: () => drawerScaffoldKey.currentState?.openDrawer()), title: const Text('Sub Admins'), ),
            if (state.isLoading)
              const SliverShimmerList(count: 6, itemBuilder: ShimmerRow.new)
            else if (state.admins.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.admin_panel_settings_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No sub admins yet', style: TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) => _SubAdminCard(admin: state.admins[i]),
                  childCount: state.admins.length,
                )),
              ),
          ]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _showCreateSheet(context),
          icon: const Icon(Icons.person_add_outlined),
          label: const Text('Add Sub Admin'),
        ),
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    final bloc = context.read<SubAdminsBloc>();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add Sub Admin', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
          const SizedBox(height: 12),
          TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *')),
          const SizedBox(height: 12),
          TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Password *')),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: saving ? null : () async {
              if (nameCtrl.text.isEmpty || emailCtrl.text.isEmpty || passCtrl.text.isEmpty) return;
              setModal(() => saving = true);
              Navigator.pop(ctx);
              bloc.add(SubAdminCreated(nameCtrl.text, emailCtrl.text, passCtrl.text));
            },
            child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create'),
          ),
        ]),
      )),
    );
  }
}

// ── Sub Admin card with permission matrix ─────────────────
class _SubAdminCard extends StatefulWidget {
  final SubAdmin admin;
  const _SubAdminCard({required this.admin});
  @override State<_SubAdminCard> createState() => _SubAdminCardState();
}

class _SubAdminCardState extends State<_SubAdminCard> {
  bool _expanded = false;
  late Set<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = Set.from(widget.admin.permissions);
  }

  void _savePermissions() {
    context.read<SubAdminsBloc>().add(SubAdminPermissionsUpdated(widget.admin.id, _selected.toList()));
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.admin.status == 'active';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: _expanded ? const BorderRadius.vertical(top: Radius.circular(12)) : BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              CircleAvatar(
                backgroundColor: active ? AppColors.primaryLight : AppColors.borderLight,
                child: Text(widget.admin.name.isNotEmpty ? widget.admin.name[0].toUpperCase() : '?', style: TextStyle(color: active ? AppColors.primary : AppColors.textMuted, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.admin.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(widget.admin.email, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                Text('${_selected.length} permissions granted', style: const TextStyle(fontSize: 11, color: AppColors.primary)),
              ])),
              Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: AppColors.textMuted),
            ]),
          ),
        ),
        // Permission matrix
        if (_expanded) ...[
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ..._permissionGroups.map((group) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 6, top: 8),
                  child: Row(children: [
                    Text(group.group, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
                    const SizedBox(width: 8),
                    // Group toggle
                    InkWell(
                      onTap: () {
                        final allSelected = group.perms.every(_selected.contains);
                        setState(() {
                          if (allSelected) { for (final p in group.perms) _selected.remove(p); }
                          else { _selected.addAll(group.perms); }
                        });
                      },
                      child: Text(group.perms.every(_selected.contains) ? 'Remove all' : 'Select all', style: const TextStyle(fontSize: 11, color: AppColors.primary)),
                    ),
                  ]),
                ),
                Wrap(spacing: 6, runSpacing: 6, children: group.perms.map((perm) {
                  final sel = _selected.contains(perm);
                  return FilterChip(
                    label: Text(_permLabel(perm), style: TextStyle(fontSize: 11, color: sel ? Colors.white : AppColors.textSecondary, fontWeight: FontWeight.w600)),
                    selected: sel,
                    onSelected: (_) => setState(() { if (sel) _selected.remove(perm); else _selected.add(perm); }),
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.borderLight,
                    checkmarkColor: Colors.white,
                    side: BorderSide(color: sel ? AppColors.primary : AppColors.border),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  );
                }).toList()),
              ])),
              const SizedBox(height: 12),
              SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _savePermissions, child: const Text('Save Permissions'))),
            ]),
          ),
        ],
      ]),
    );
  }
}
