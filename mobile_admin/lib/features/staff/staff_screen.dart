import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../models/pagination_model.dart';

// ── Model ─────────────────────────────────────────────────
class StaffMember extends Equatable {
  final String id;
  final String name;
  final String email;
  final String role;
  final String status;
  final String? staffType;
  final String? phone;

  const StaffMember({required this.id, required this.name, required this.email, required this.role, required this.status, this.staffType, this.phone});

  factory StaffMember.fromJson(Map<String, dynamic> j) => StaffMember(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    email: j['email'] as String? ?? '',
    role: j['role'] as String? ?? 'staff',
    status: j['status'] as String? ?? 'active',
    staffType: j['staff_type'] as String?,
    phone: j['phone'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── Events ────────────────────────────────────────────────
abstract class StaffEvent extends Equatable {
  const StaffEvent();
  @override List<Object?> get props => [];
}
class StaffLoadRequested extends StaffEvent { const StaffLoadRequested(); }
class StaffSearchChanged extends StaffEvent {
  final String query;
  const StaffSearchChanged(this.query);
  @override List<Object?> get props => [query];
}
class StaffRoleFilterChanged extends StaffEvent {
  final String? role;
  const StaffRoleFilterChanged(this.role);
  @override List<Object?> get props => [role];
}
class StaffStatusToggled extends StaffEvent {
  final String id;
  final String newStatus;
  const StaffStatusToggled(this.id, this.newStatus);
  @override List<Object?> get props => [id];
}
class StaffDeleted extends StaffEvent {
  final String id;
  const StaffDeleted(this.id);
  @override List<Object?> get props => [id];
}
class StaffPasswordChanged extends StaffEvent {
  final String id;
  final String password;
  const StaffPasswordChanged(this.id, this.password);
  @override List<Object?> get props => [id];
}

// ── State ─────────────────────────────────────────────────
class StaffState extends Equatable {
  final List<StaffMember> members;
  final bool isLoading;
  final String search;
  final String? roleFilter;
  final String? error;
  final String? successMessage;

  const StaffState({this.members = const [], this.isLoading = false, this.search = '', this.roleFilter, this.error, this.successMessage});

  StaffState copyWith({List<StaffMember>? members, bool? isLoading, String? search, String? roleFilter, bool clearRole = false, String? error, bool clearError = false, String? successMessage, bool clearSuccess = false}) =>
      StaffState(
        members: members ?? this.members,
        isLoading: isLoading ?? this.isLoading,
        search: search ?? this.search,
        roleFilter: clearRole ? null : (roleFilter ?? this.roleFilter),
        error: clearError ? null : (error ?? this.error),
        successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
      );

  @override List<Object?> get props => [members, isLoading, search, roleFilter];
}

// ── BLoC ─────────────────────────────────────────────────
class StaffBloc extends Bloc<StaffEvent, StaffState> {
  StaffBloc() : super(const StaffState()) {
    on<StaffLoadRequested>(_onLoad);
    on<StaffSearchChanged>(_onSearch);
    on<StaffRoleFilterChanged>(_onRoleFilter);
    on<StaffStatusToggled>(_onToggleStatus);
    on<StaffDeleted>(_onDelete);
    on<StaffPasswordChanged>(_onPasswordChange);
  }

  Map<String, dynamic> get _params => {
    'limit': 50,
    if (state.search.isNotEmpty) 'search': state.search,
    if (state.roleFilter != null) 'role': state.roleFilter,
  };

  Future<void> _onLoad(StaffLoadRequested _, Emitter<StaffState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/users', queryParameters: _params);
      final r = PaginatedResult.fromJson(res.data as Map<String, dynamic>, StaffMember.fromJson);
      emit(state.copyWith(members: r.data, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: e.toString()));
    }
  }

  Future<void> _onSearch(StaffSearchChanged event, Emitter<StaffState> emit) async {
    emit(state.copyWith(search: event.query));
    await _onLoad(const StaffLoadRequested(), emit);
  }

  Future<void> _onRoleFilter(StaffRoleFilterChanged event, Emitter<StaffState> emit) async {
    emit(state.copyWith(roleFilter: event.role, clearRole: event.role == null));
    await _onLoad(const StaffLoadRequested(), emit);
  }

  Future<void> _onToggleStatus(StaffStatusToggled event, Emitter<StaffState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/users/${event.id}/status', data: {'status': event.newStatus});
      emit(state.copyWith(successMessage: 'Status updated'));
      add(const StaffLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: 'Failed to update status'));
    }
  }

  Future<void> _onDelete(StaffDeleted event, Emitter<StaffState> emit) async {
    try {
      await ApiClient.instance.delete('/admin/users/${event.id}');
      add(const StaffLoadRequested());
    } catch (e) {
      emit(state.copyWith(error: 'Failed to delete. Staff must be inactive first.'));
    }
  }

  Future<void> _onPasswordChange(StaffPasswordChanged event, Emitter<StaffState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/users/${event.id}/password', data: {'password': event.password});
      emit(state.copyWith(successMessage: 'Password updated'));
    } catch (e) {
      emit(state.copyWith(error: 'Failed to change password'));
    }
  }
}

// ── Screen ────────────────────────────────────────────────
class StaffScreen extends StatelessWidget {
  const StaffScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => StaffBloc()..add(const StaffLoadRequested()),
        child: const _StaffView(),
      );
}

class _StaffView extends StatefulWidget {
  const _StaffView();
  @override State<_StaffView> createState() => _StaffViewState();
}

class _StaffViewState extends State<_StaffView> {
  final _searchCtrl = TextEditingController();
  final _roles = ['staff', 'operator', 'sub_admin'];

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: BlocConsumer<StaffBloc, StaffState>(
        listener: (context, state) {
          if (state.error != null) AppToast.error(state.error!);
          if (state.successMessage != null) AppToast.success(state.successMessage!);
        },
        builder: (context, state) => RefreshIndicator(
          onRefresh: () async => context.read<StaffBloc>().add(const StaffLoadRequested()),
          child: CustomScrollView(slivers: [
            SliverAppBar(
              floating: true, title: const Text('Staff'),
              backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(56),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => context.read<StaffBloc>().add(StaffSearchChanged(v)),
                    decoration: InputDecoration(
                      hintText: 'Search staff…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      isDense: true,
                      suffixIcon: _searchCtrl.text.isNotEmpty
                          ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); context.read<StaffBloc>().add(const StaffSearchChanged('')); })
                          : null,
                    ),
                  ),
                ),
              ),
            ),
            // Role filter chips
            SliverToBoxAdapter(child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Row(children: [
                _roleChip(context, state, null, 'All'),
                ..._roles.map((r) => _roleChip(context, state, r, _roleLabel(r))),
              ]),
            )),
            if (state.isLoading)
              const SliverShimmerList(count: 8, itemBuilder: ShimmerRow.new)
            else if (state.members.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.badge_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No staff members found', style: TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) => _StaffCard(member: state.members[i], onEdit: () => _showEditSheet(context, state.members[i])),
                  childCount: state.members.length,
                )),
              ),
          ]),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context),
        icon: const Icon(Icons.person_add_outlined),
        label: const Text('Add Staff'),
      ),
    );
  }

  String _roleLabel(String r) => switch (r) {
    'sub_admin' => 'Sub Admin',
    'operator' => 'Operator',
    _ => 'Staff',
  };

  Widget _roleChip(BuildContext context, StaffState state, String? role, String label) {
    final selected = state.roleFilter == role;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label, style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.w700 : FontWeight.normal)),
        selected: selected,
        onSelected: (_) => context.read<StaffBloc>().add(StaffRoleFilterChanged(role)),
        selectedColor: AppColors.primary,
        labelStyle: selected ? const TextStyle(color: Colors.white) : null,
        checkmarkColor: Colors.white,
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    final bloc = context.read<StaffBloc>();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    String selectedRole = 'staff';
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add Staff Member', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
          const SizedBox(height: 12),
          TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *')),
          const SizedBox(height: 12),
          TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Password *')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: selectedRole,
            decoration: const InputDecoration(labelText: 'Role'),
            items: const [
              DropdownMenuItem(value: 'staff', child: Text('Staff')),
              DropdownMenuItem(value: 'operator', child: Text('Operator')),
              DropdownMenuItem(value: 'sub_admin', child: Text('Sub Admin')),
            ],
            onChanged: (v) => setModal(() => selectedRole = v ?? 'staff'),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: saving ? null : () async {
              if (nameCtrl.text.isEmpty || emailCtrl.text.isEmpty || passCtrl.text.isEmpty) return;
              setModal(() => saving = true);
              try {
                await ApiClient.instance.post('/admin/users', data: {'name': nameCtrl.text, 'email': emailCtrl.text, 'password': passCtrl.text, 'role': selectedRole});
                if (ctx.mounted) Navigator.pop(ctx);
                bloc.add(const StaffLoadRequested());
              } catch (_) { setModal(() => saving = false); }
            },
            child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create'),
          ),
        ]),
      )),
    );
  }

  void _showEditSheet(BuildContext context, StaffMember member) {
    final bloc = context.read<StaffBloc>();
    final passCtrl = TextEditingController();

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) {
        bool changingPass = false;
        return Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              CircleAvatar(backgroundColor: AppColors.primaryLight, child: Text(member.name.substring(0, 1).toUpperCase(), style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(member.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text(member.email, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              ])),
            ]),
            const SizedBox(height: 20),
            const Divider(),
            ListTile(
              leading: Icon(member.status == 'active' ? Icons.toggle_on_outlined : Icons.toggle_off_outlined, color: member.status == 'active' ? AppColors.success : AppColors.textMuted),
              title: Text(member.status == 'active' ? 'Deactivate Staff' : 'Activate Staff'),
              onTap: () { Navigator.pop(ctx); bloc.add(StaffStatusToggled(member.id, member.status == 'active' ? 'inactive' : 'active')); },
            ),
            ListTile(
              leading: const Icon(Icons.lock_outline, color: AppColors.primary),
              title: const Text('Change Password'),
              onTap: () => setModal(() => changingPass = true),
            ),
            if (member.status == 'inactive')
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.error),
                title: const Text('Delete', style: TextStyle(color: AppColors.error)),
                onTap: () {
                  Navigator.pop(ctx);
                  showDialog(context: context, builder: (_) => AlertDialog(
                    title: const Text('Delete Staff?'),
                    content: const Text('This action cannot be undone.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                      ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.error), onPressed: () { Navigator.pop(context); bloc.add(StaffDeleted(member.id)); }, child: const Text('Delete')),
                    ],
                  ));
                },
              ),
            if (changingPass) ...[
              const Divider(),
              TextField(controller: passCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'New Password')),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: passCtrl.text.length < 6 ? null : () { Navigator.pop(ctx); bloc.add(StaffPasswordChanged(member.id, passCtrl.text)); },
                child: const Text('Update Password'),
              ),
            ],
          ]),
        );
      }),
    );
  }
}

class _StaffCard extends StatelessWidget {
  final StaffMember member;
  final VoidCallback onEdit;
  const _StaffCard({required this.member, required this.onEdit});

  Color get _roleColor => switch (member.role) {
    'owner' => AppColors.secondary,
    'sub_admin' => AppColors.primary,
    'operator' => AppColors.info,
    _ => AppColors.success,
  };

  @override
  Widget build(BuildContext context) {
    final active = member.status == 'active';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: active ? _roleColor.withValues(alpha: 0.15) : AppColors.borderLight,
          child: Text(member.name.isNotEmpty ? member.name[0].toUpperCase() : '?',
              style: TextStyle(color: active ? _roleColor : AppColors.textMuted, fontWeight: FontWeight.w700)),
        ),
        title: Row(children: [
          Expanded(child: Text(member.name, style: TextStyle(fontWeight: FontWeight.w600, color: active ? AppColors.textPrimary : AppColors.textMuted))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: _roleColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(5)),
            child: Text(member.role == 'sub_admin' ? 'Sub Admin' : member.role[0].toUpperCase() + member.role.substring(1),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _roleColor)),
          ),
        ]),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(member.email, style: const TextStyle(fontSize: 12)),
          if (member.staffType != null) Text(member.staffType!, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ]),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(color: active ? AppColors.success : AppColors.textMuted, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          IconButton(icon: const Icon(Icons.more_vert, size: 20), onPressed: onEdit),
        ]),
      ),
    );
  }
}
