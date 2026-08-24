import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';
import '../../features/auth/auth_bloc.dart';
import '../../features/auth/auth_event.dart';

// ── Model ─────────────────────────────────────────────────
class SettingItem extends Equatable {
  final String id;
  final String name;
  const SettingItem({required this.id, required this.name});
  factory SettingItem.fromJson(Map<String, dynamic> j) =>
      SettingItem(id: j['id'] as String, name: j['name'] as String? ?? '');
  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class SettingsEvent extends Equatable {
  const SettingsEvent();
  @override List<Object?> get props => [];
}
class SettingsLoadRequested extends SettingsEvent { const SettingsLoadRequested(); }
class SettingsItemAdded extends SettingsEvent {
  final String key;
  final String name;
  const SettingsItemAdded(this.key, this.name);
  @override List<Object?> get props => [key, name];
}
class SettingsItemDeleted extends SettingsEvent {
  final String key;
  final String id;
  const SettingsItemDeleted(this.key, this.id);
  @override List<Object?> get props => [key, id];
}

class SettingsState extends Equatable {
  final bool isLoading;
  final Map<String, List<SettingItem>> data;
  final String? error;
  final String? successMessage;

  const SettingsState({this.isLoading = false, this.data = const {}, this.error, this.successMessage});

  SettingsState copyWith({bool? isLoading, Map<String, List<SettingItem>>? data, String? error, bool clearError = false, String? successMessage, bool clearSuccess = false}) => SettingsState(
    isLoading: isLoading ?? this.isLoading,
    data: data ?? this.data,
    error: clearError ? null : (error ?? this.error),
    successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
  );

  @override List<Object?> get props => [isLoading, data];
}

// ── BLoC ─────────────────────────────────────────────────
class SettingsBloc extends Bloc<SettingsEvent, SettingsState> {
  static const _keys = ['job-types', 'print-colors', 'plate-sources', 'staff-types'];

  SettingsBloc() : super(const SettingsState()) {
    on<SettingsLoadRequested>(_onLoad);
    on<SettingsItemAdded>(_onAdd);
    on<SettingsItemDeleted>(_onDelete);
  }

  Future<void> _onLoad(SettingsLoadRequested _, Emitter<SettingsState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final results = await Future.wait(_keys.map((k) => ApiClient.instance.get('/admin/settings/$k')));
      final data = <String, List<SettingItem>>{};
      for (var i = 0; i < _keys.length; i++) {
        final raw = results[i].data as List? ?? [];
        data[_keys[i]] = raw.map((j) => SettingItem.fromJson(j as Map<String, dynamic>)).toList();
      }
      emit(state.copyWith(data: data, isLoading: false));
    } catch (e) {
      emit(state.copyWith(isLoading: false, error: e.toString()));
    }
  }

  Future<void> _onAdd(SettingsItemAdded event, Emitter<SettingsState> emit) async {
    try {
      await ApiClient.instance.post('/admin/settings/${event.key}', data: {'name': event.name});
      emit(state.copyWith(successMessage: 'Added successfully'));
      add(const SettingsLoadRequested());
    } catch (_) {
      emit(state.copyWith(error: 'Failed to add item'));
    }
  }

  Future<void> _onDelete(SettingsItemDeleted event, Emitter<SettingsState> emit) async {
    try {
      await ApiClient.instance.delete('/admin/settings/${event.key}/${event.id}');
      emit(state.copyWith(successMessage: 'Deleted'));
      add(const SettingsLoadRequested());
    } catch (_) {
      emit(state.copyWith(error: 'Failed to delete item'));
    }
  }
}

// ── Screen ────────────────────────────────────────────────
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => SettingsBloc()..add(const SettingsLoadRequested()),
        child: const _SettingsView(),
      );
}

class _SettingsView extends StatelessWidget {
  const _SettingsView();

  static const _sections = [
    (key: 'job-types',    label: 'Job Types',    icon: Icons.work_outline),
    (key: 'print-colors', label: 'Print Colors', icon: Icons.palette_outlined),
    (key: 'plate-sources',label: 'Plate Sources',icon: Icons.layers_outlined),
    (key: 'staff-types',  label: 'Staff Types',  icon: Icons.badge_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<SettingsBloc, SettingsState>(
      listener: (context, state) {
        if (state.error != null) AppToast.error(state.error!);
        if (state.successMessage != null) AppToast.success(state.successMessage!);
      },
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<SettingsBloc>().add(const SettingsLoadRequested()),
          child: CustomScrollView(slivers: [
            SliverAppBar(
              pinned: true, title: const Text('Settings'),
              backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
            ),
            if (state.isLoading)
              const SliverShimmerList(count: 5, itemBuilder: ShimmerCard.new)
            else
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList(delegate: SliverChildListDelegate([
                  // Dropdown config sections
                  ..._sections.map((s) => _ConfigSection(
                    title: s.label,
                    icon: s.icon,
                    items: state.data[s.key] ?? [],
                    onAdd: () => _showAddDialog(context, s.key, s.label),
                    onDelete: (id) => context.read<SettingsBloc>().add(SettingsItemDeleted(s.key, id)),
                  )),
                  const SizedBox(height: 8),
                  // Account section
                  _AccountSection(),
                  const SizedBox(height: 24),
                ])),
              ),
          ]),
        ),
      ),
    );
  }

  void _showAddDialog(BuildContext context, String key, String label) {
    final bloc = context.read<SettingsBloc>();
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Add $label'),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(labelText: 'Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () { if (ctrl.text.isNotEmpty) { Navigator.pop(context); bloc.add(SettingsItemAdded(key, ctrl.text.trim())); } },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}

// ── Config section card ───────────────────────────────────
class _ConfigSection extends StatefulWidget {
  final String title;
  final IconData icon;
  final List<SettingItem> items;
  final VoidCallback onAdd;
  final void Function(String id) onDelete;

  const _ConfigSection({required this.title, required this.icon, required this.items, required this.onAdd, required this.onDelete});

  @override
  State<_ConfigSection> createState() => _ConfigSectionState();
}

class _ConfigSectionState extends State<_ConfigSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: _expanded ? const BorderRadius.vertical(top: Radius.circular(12)) : BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Icon(widget.icon, size: 20, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
                child: Text('${widget.items.length}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
              const SizedBox(width: 8),
              Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: AppColors.textMuted),
            ]),
          ),
        ),
        if (_expanded) ...[
          const Divider(height: 1),
          if (widget.items.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Text('No items yet', style: TextStyle(color: AppColors.textMuted, fontSize: 13)))
          else
            ...widget.items.map((item) => ListTile(
              dense: true,
              title: Text(item.name, style: const TextStyle(fontSize: 13)),
              trailing: IconButton(
                icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                onPressed: () => showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: Text('Delete "${item.name}"?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                      ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.error), onPressed: () { Navigator.pop(context); widget.onDelete(item.id); }, child: const Text('Delete')),
                    ],
                  ),
                ),
              ),
            )),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: TextButton.icon(
              onPressed: widget.onAdd,
              icon: const Icon(Icons.add, size: 18),
              label: Text('Add ${widget.title}'),
            ),
          ),
        ],
      ]),
    );
  }
}

// ── Account section ───────────────────────────────────────
class _AccountSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Align(alignment: Alignment.centerLeft, child: Text('Account', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textMuted))),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.info_outline, color: AppColors.primary),
          title: const Text('App Version', style: TextStyle(fontSize: 13)),
          trailing: const Text('1.0.0', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
        ),
        const Divider(height: 1),
        ListTile(
          leading: const Icon(Icons.logout, color: AppColors.error),
          title: const Text('Sign Out', style: TextStyle(color: AppColors.error, fontSize: 13)),
          onTap: () => showDialog(
            context: context,
            builder: (_) => AlertDialog(
              title: const Text('Sign Out?'),
              content: const Text('You will be logged out of the admin panel.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                  onPressed: () { Navigator.pop(context); context.read<AuthBloc>().add(const AuthLogoutRequested()); },
                  child: const Text('Sign Out'),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}
