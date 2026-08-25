// ignore_for_file: use_build_context_synchronously
import '../../core/widgets/shell_scaffold.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';
import '../../core/widgets/app_shimmer.dart';

// ── Model ─────────────────────────────────────────────────
class Machine extends Equatable {
  final String id;
  final String name;
  final String? type;
  final String? model;
  final String status;
  final int? maxColors;
  final String? notes;

  const Machine({required this.id, required this.name, this.type, this.model, required this.status, this.maxColors, this.notes});

  factory Machine.fromJson(Map<String, dynamic> j) => Machine(
    id: j['id'] as String,
    name: j['name'] as String? ?? '',
    type: j['type'] as String?,
    model: j['model'] as String?,
    status: j['status'] as String? ?? 'active',
    maxColors: j['max_colors'] as int?,
    notes: j['notes'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── BLoC ─────────────────────────────────────────────────
abstract class MachinesEvent extends Equatable {
  const MachinesEvent();
  @override List<Object?> get props => [];
}
class MachinesLoadRequested extends MachinesEvent { const MachinesLoadRequested(); }
class MachineDeleted extends MachinesEvent { final String id; const MachineDeleted(this.id); @override List<Object?> get props => [id]; }
class MachineStatusUpdated extends MachinesEvent {
  final String id, status;
  const MachineStatusUpdated(this.id, this.status);
  @override List<Object?> get props => [id];
}

class MachinesState extends Equatable {
  final List<Machine> machines;
  final bool isLoading;
  final String? error;
  final String? success;

  const MachinesState({this.machines = const [], this.isLoading = false, this.error, this.success});
  MachinesState copyWith({List<Machine>? machines, bool? isLoading, String? error, bool clearError = false, String? success}) => MachinesState(
    machines: machines ?? this.machines,
    isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
    success: success ?? this.success,
  );
  @override List<Object?> get props => [machines, isLoading];
}

class MachinesBloc extends Bloc<MachinesEvent, MachinesState> {
  MachinesBloc() : super(const MachinesState()) {
    on<MachinesLoadRequested>(_onLoad);
    on<MachineDeleted>(_onDelete);
    on<MachineStatusUpdated>(_onStatusUpdate);
  }

  Future<void> _onLoad(MachinesLoadRequested _, Emitter<MachinesState> emit) async {
    emit(state.copyWith(isLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/machines', queryParameters: {'limit': 100});
      final raw = (res.data['data'] ?? res.data) as List? ?? [];
      emit(state.copyWith(machines: raw.map((j) => Machine.fromJson(j as Map<String, dynamic>)).toList(), isLoading: false));
    } catch (e) { emit(state.copyWith(isLoading: false, error: e.toString())); }
  }

  Future<void> _onDelete(MachineDeleted event, Emitter<MachinesState> emit) async {
    try {
      await ApiClient.instance.delete('/admin/machines/${event.id}');
      emit(state.copyWith(success: 'Machine deleted'));
      add(const MachinesLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to delete machine')); }
  }

  Future<void> _onStatusUpdate(MachineStatusUpdated event, Emitter<MachinesState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/machines/${event.id}', data: {'status': event.status});
      add(const MachinesLoadRequested());
    } catch (_) { emit(state.copyWith(error: 'Failed to update status')); }
  }
}

// ── Screen ────────────────────────────────────────────────
class MachinesScreen extends StatelessWidget {
  const MachinesScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => MachinesBloc()..add(const MachinesLoadRequested()),
        child: const _MachinesView(),
      );
}

class _MachinesView extends StatelessWidget {
  const _MachinesView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<MachinesBloc, MachinesState>(
      listener: (ctx, state) {
        if (state.error != null) AppToast.error(state.error!);
        if (state.success != null) AppToast.success(state.success!);
      },
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        body: RefreshIndicator(
          onRefresh: () async => context.read<MachinesBloc>().add(const MachinesLoadRequested()),
          child: CustomScrollView(slivers: [
            SliverAppBar(pinned: true, leading: IconButton(icon: const Icon(Icons.menu), color: Colors.white, onPressed: () => drawerScaffoldKey.currentState?.openDrawer()), title: const Text('Machines'), ),
            if (state.isLoading)
              const SliverShimmerList(count: 5, itemBuilder: ShimmerCard.new)
            else if (state.machines.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.precision_manufacturing_outlined, size: 56, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('No machines yet', style: TextStyle(color: AppColors.textMuted)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (_, i) => _MachineCard(machine: state.machines[i], onEdit: () => _showForm(context, state.machines[i])),
                  childCount: state.machines.length,
                )),
              ),
          ]),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _showForm(context),
          icon: const Icon(Icons.add),
          label: const Text('Add Machine'),
        ),
      ),
    );
  }

  void _showForm(BuildContext context, [Machine? existing]) {
    final bloc = context.read<MachinesBloc>();
    final nameCtrl = TextEditingController(text: existing?.name);
    final typeCtrl = TextEditingController(text: existing?.type);
    final modelCtrl = TextEditingController(text: existing?.model);
    final notesCtrl = TextEditingController(text: existing?.notes);
    final colorsCtrl = TextEditingController(text: existing?.maxColors?.toString());
    bool saving = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(existing == null ? 'Add Machine' : 'Edit Machine', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Machine Name *')),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextField(controller: typeCtrl, decoration: const InputDecoration(labelText: 'Type'))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: modelCtrl, decoration: const InputDecoration(labelText: 'Model'))),
          ]),
          const SizedBox(height: 12),
          TextField(controller: colorsCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max Colors')),
          const SizedBox(height: 12),
          TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes'), maxLines: 2),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: saving || nameCtrl.text.isEmpty ? null : () async {
              setModal(() => saving = true);
              try {
                final data = {'name': nameCtrl.text, if (typeCtrl.text.isNotEmpty) 'type': typeCtrl.text, if (modelCtrl.text.isNotEmpty) 'model': modelCtrl.text, if (colorsCtrl.text.isNotEmpty) 'maxColors': int.tryParse(colorsCtrl.text), if (notesCtrl.text.isNotEmpty) 'notes': notesCtrl.text};
                if (existing == null) {
                  await ApiClient.instance.post('/admin/machines', data: data);
                  AppToast.success('Machine created');
                } else {
                  await ApiClient.instance.patch('/admin/machines/${existing.id}', data: data);
                  AppToast.success('Machine updated');
                }
                if (ctx.mounted) Navigator.pop(ctx);
                bloc.add(const MachinesLoadRequested());
              } catch (_) { AppToast.error('Failed to save machine'); setModal(() => saving = false); }
            },
            child: saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(existing == null ? 'Add Machine' : 'Save'),
          ),
        ]),
      )),
    );
  }
}

// ── Machine card ──────────────────────────────────────────
class _MachineCard extends StatelessWidget {
  final Machine machine;
  final VoidCallback onEdit;
  const _MachineCard({required this.machine, required this.onEdit});

  static const _statusColors = {'active': AppColors.success, 'maintenance': AppColors.warning, 'inactive': AppColors.textMuted};
  static const _statusLabels = {'active': 'Active', 'maintenance': 'Maintenance', 'inactive': 'Inactive'};

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[machine.status] ?? AppColors.textMuted;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(Icons.precision_manufacturing_outlined, color: color, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(machine.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(_statusLabels[machine.status] ?? machine.status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
              ),
            ]),
            if (machine.type != null || machine.model != null)
              Text([if (machine.type != null) machine.type!, if (machine.model != null) machine.model!].join(' · '), style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
            if (machine.maxColors != null)
              Text('${machine.maxColors} colors max', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
          ])),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'edit') {
                onEdit();
              } else if (v == 'maintenance') {
                context.read<MachinesBloc>().add(MachineStatusUpdated(machine.id, 'maintenance'));
              } else if (v == 'activate') {
                context.read<MachinesBloc>().add(MachineStatusUpdated(machine.id, 'active'));
              } else if (v == 'delete') {
                showDialog(context: context, builder: (_) => AlertDialog(
                  title: const Text('Delete Machine?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                      onPressed: () { Navigator.pop(context); context.read<MachinesBloc>().add(MachineDeleted(machine.id)); },
                      child: const Text('Delete'),
                    ),
                  ],
                ));
              }
            },
            itemBuilder: (_) => [
              if (machine.status != 'active') const PopupMenuItem(value: 'activate', child: Text('Set Active')),
              if (machine.status == 'active') const PopupMenuItem(value: 'maintenance', child: Text('Set Maintenance')),
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: AppColors.error))),
            ],
          ),
        ]),
      ),
    );
  }
}
