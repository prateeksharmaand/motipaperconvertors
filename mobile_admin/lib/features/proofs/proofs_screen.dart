import 'package:equatable/equatable.dart';
import '../../core/widgets/shell_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/app_toast.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';

// ── Models ────────────────────────────────────────────────
class Proof extends Equatable {
  final String id;
  final String jobId;
  final String status;
  final String? notes;
  final String? actionedByName;
  final String? actionedAt;
  final List<ProofVersion> versions;

  const Proof({required this.id, required this.jobId, required this.status, this.notes, this.actionedByName, this.actionedAt, this.versions = const []});

  factory Proof.fromJson(Map<String, dynamic> j) => Proof(
    id: j['id'] as String,
    jobId: j['job_id'] as String,
    status: j['status'] as String? ?? 'pending',
    notes: j['notes'] as String?,
    actionedByName: j['actioned_by_name'] as String?,
    actionedAt: j['actioned_at'] as String?,
    versions: (j['versions'] as List? ?? []).map((v) => ProofVersion.fromJson(v as Map<String, dynamic>)).toList(),
  );

  @override List<Object?> get props => [id];
}

class ProofVersion extends Equatable {
  final String id;
  final int versionNumber;
  final String? fileName;
  final String? fileType;
  final String? comment;
  final String? uploadedByName;
  final String? createdAt;

  const ProofVersion({required this.id, required this.versionNumber, this.fileName, this.fileType, this.comment, this.uploadedByName, this.createdAt});

  factory ProofVersion.fromJson(Map<String, dynamic> j) => ProofVersion(
    id: j['id'] as String,
    versionNumber: j['version_number'] as int? ?? 1,
    fileName: j['file_name'] as String?,
    fileType: j['file_type'] as String?,
    comment: j['comment'] as String?,
    uploadedByName: j['uploaded_by_name'] as String?,
    createdAt: j['created_at'] as String?,
  );

  @override List<Object?> get props => [id];
}

// ── Events & State ────────────────────────────────────────
abstract class ProofsEvent extends Equatable {
  const ProofsEvent();
  @override List<Object?> get props => [];
}
class ProofsJobSelected extends ProofsEvent {
  final String jobId;
  const ProofsJobSelected(this.jobId);
  @override List<Object?> get props => [jobId];
}
class ProofsLoadRequested extends ProofsEvent {
  final String jobId;
  const ProofsLoadRequested(this.jobId);
  @override List<Object?> get props => [jobId];
}
class ProofActionRequested extends ProofsEvent {
  final String proofId;
  final String action; // approve | reject | revision_requested
  final String? notes;
  const ProofActionRequested(this.proofId, this.action, {this.notes});
  @override List<Object?> get props => [proofId, action];
}

class ProofsState extends Equatable {
  final List<Map<String, dynamic>> jobs;
  final bool jobsLoading;
  final String? selectedJobId;
  final List<Proof> proofs;
  final bool proofsLoading;
  final String? error;
  final String? success;

  const ProofsState({this.jobs = const [], this.jobsLoading = false, this.selectedJobId, this.proofs = const [], this.proofsLoading = false, this.error, this.success});

  ProofsState copyWith({List<Map<String, dynamic>>? jobs, bool? jobsLoading, String? selectedJobId, List<Proof>? proofs, bool? proofsLoading, String? error, bool clearError = false, String? success, bool clearSuccess = false}) => ProofsState(
    jobs: jobs ?? this.jobs,
    jobsLoading: jobsLoading ?? this.jobsLoading,
    selectedJobId: selectedJobId ?? this.selectedJobId,
    proofs: proofs ?? this.proofs,
    proofsLoading: proofsLoading ?? this.proofsLoading,
    error: clearError ? null : (error ?? this.error),
    success: clearSuccess ? null : (success ?? this.success),
  );

  @override List<Object?> get props => [selectedJobId, proofs, proofsLoading];
}

// ── BLoC ─────────────────────────────────────────────────
class _ProofsInitRequested extends ProofsEvent { const _ProofsInitRequested(); }

class ProofsBloc extends Bloc<ProofsEvent, ProofsState> {
  ProofsBloc() : super(const ProofsState()) {
    on<_ProofsInitRequested>(_onInit);
    on<ProofsJobSelected>(_onJobSelected);
    on<ProofsLoadRequested>(_onLoad);
    on<ProofActionRequested>(_onAction);
    add(const _ProofsInitRequested());
  }

  Future<void> _onInit(_ProofsInitRequested _, Emitter<ProofsState> emit) async {
    try {
      final res = await ApiClient.instance.get('/admin/jobs', queryParameters: {'limit': 100, 'sortDir': 'desc'});
      final jobs = List<Map<String, dynamic>>.from(res.data['data'] as List? ?? []);
      emit(state.copyWith(jobs: jobs));
    } catch (_) {}
  }

  Future<void> _onJobSelected(ProofsJobSelected event, Emitter<ProofsState> emit) async {
    emit(state.copyWith(selectedJobId: event.jobId));
    add(ProofsLoadRequested(event.jobId));
  }

  Future<void> _onLoad(ProofsLoadRequested event, Emitter<ProofsState> emit) async {
    emit(state.copyWith(proofsLoading: true, clearError: true));
    try {
      final res = await ApiClient.instance.get('/admin/proofs', queryParameters: {'jobId': event.jobId});
      final raw = res.data as List? ?? [];
      final proofs = raw.map((j) => Proof.fromJson(j as Map<String, dynamic>)).toList();
      emit(state.copyWith(proofs: proofs, proofsLoading: false));
    } catch (e) {
      emit(state.copyWith(proofsLoading: false, error: e.toString()));
    }
  }

  Future<void> _onAction(ProofActionRequested event, Emitter<ProofsState> emit) async {
    try {
      await ApiClient.instance.patch('/admin/proofs/${event.proofId}/action', data: {
        'action': event.action,
        if (event.notes != null && event.notes!.isNotEmpty) 'notes': event.notes,
      });
      emit(state.copyWith(success: _actionLabel(event.action)));
      if (state.selectedJobId != null) add(ProofsLoadRequested(state.selectedJobId!));
    } catch (_) {
      emit(state.copyWith(error: 'Failed to ${event.action}'));
    }
  }

  String _actionLabel(String action) => switch (action) {
    'approve' => 'Proof approved ✓',
    'reject' => 'Proof rejected',
    _ => 'Revision requested',
  };
}

// ── Screen ────────────────────────────────────────────────
class ProofsScreen extends StatelessWidget {
  const ProofsScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => ProofsBloc(),
        child: const _ProofsView(),
      );
}

class _ProofsView extends StatelessWidget {
  const _ProofsView();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProofsBloc, ProofsState>(
      listener: (ctx, state) {
        if (state.error != null) AppToast.error(state.error!);
        if (state.success != null) AppToast.success(state.success!);
      },
      builder: (context, state) => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          leading: IconButton(icon: const Icon(Icons.menu), onPressed: () => drawerScaffoldKey.currentState?.openDrawer()),
          title: const Text('Proofs'),
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
        ),
        body: Column(children: [
          // Job selector
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: DropdownButtonFormField<String>(
              initialValue: state.selectedJobId,
              hint: const Text('Select a Job Card to view proofs', style: TextStyle(color: AppColors.textDisabled, fontSize: 13)),
              decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10), prefixIcon: Icon(Icons.work_outline, size: 18)),
              isExpanded: true,
              items: state.jobs.map((j) => DropdownMenuItem(
                value: j['id'] as String,
                child: Text('#${j['job_number']} ${j['job_type'] ?? ''}', overflow: TextOverflow.ellipsis),
              )).toList(),
              onChanged: (v) { if (v != null) context.read<ProofsBloc>().add(ProofsJobSelected(v)); },
            ),
          ),
          const Divider(height: 1),
          // Proof list
          Expanded(child: state.selectedJobId == null
            ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.image_search_outlined, size: 56, color: AppColors.textMuted),
                SizedBox(height: 12),
                Text('Select a job card to view proofs', style: TextStyle(color: AppColors.textMuted)),
              ]))
            : state.proofsLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: () async => context.read<ProofsBloc>().add(ProofsLoadRequested(state.selectedJobId!)),
                  child: state.proofs.isEmpty
                    ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(Icons.image_not_supported_outlined, size: 56, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No proofs for this job yet', style: TextStyle(color: AppColors.textMuted)),
                      ]))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: state.proofs.length,
                        itemBuilder: (_, i) => _ProofCard(proof: state.proofs[i]),
                      ),
                )),
        ]),
      ),
    );
  }
}

// ── Proof card ────────────────────────────────────────────
class _ProofCard extends StatelessWidget {
  final Proof proof;
  const _ProofCard({required this.proof});

  static const _statusColors = {
    'pending': AppColors.warning,
    'approved': AppColors.success,
    'rejected': AppColors.error,
    'revision_requested': AppColors.info,
  };
  static const _statusLabels = {
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'revision_requested': 'Revision Requested',
  };

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[proof.status] ?? AppColors.textMuted;
    final label = _statusLabels[proof.status] ?? proof.status;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Status header
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withValues(alpha: 0.3))),
              child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
            ),
            const Spacer(),
            if (proof.actionedByName != null)
              Text('by ${proof.actionedByName}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ]),
          if (proof.notes != null && proof.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(proof.notes!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ],

          // Versions
          if (proof.versions.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Versions', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
            const SizedBox(height: 6),
            ...proof.versions.map((v) => _VersionTile(version: v, proofId: proof.id)),
          ],

          // Action buttons — only shown for pending/revision_requested
          if (proof.status == 'pending' || proof.status == 'revision_requested') ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: OutlinedButton.icon(
                onPressed: () => _showActionDialog(context, proof.id, 'approve'),
                icon: const Icon(Icons.check_circle_outline, size: 16, color: AppColors.success),
                label: const Text('Approve', style: TextStyle(color: AppColors.success)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.success), padding: const EdgeInsets.symmetric(vertical: 8)),
              )),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(
                onPressed: () => _showActionDialog(context, proof.id, 'revision_requested'),
                icon: const Icon(Icons.edit_note_outlined, size: 16, color: AppColors.info),
                label: const Text('Revision', style: TextStyle(color: AppColors.info)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.info), padding: const EdgeInsets.symmetric(vertical: 8)),
              )),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(
                onPressed: () => _showActionDialog(context, proof.id, 'reject'),
                icon: const Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
                label: const Text('Reject', style: TextStyle(color: AppColors.error)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.error), padding: const EdgeInsets.symmetric(vertical: 8)),
              )),
            ]),
          ],
        ]),
      ),
    );
  }

  void _showActionDialog(BuildContext context, String proofId, String action) {
    final notesCtrl = TextEditingController();
    final colors = {'approve': AppColors.success, 'reject': AppColors.error, 'revision_requested': AppColors.info};
    final labels = {'approve': 'Approve Proof', 'reject': 'Reject Proof', 'revision_requested': 'Request Revision'};

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(labels[action] ?? action),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          if (action != 'approve')
            TextField(controller: notesCtrl, autofocus: true, maxLines: 3, decoration: const InputDecoration(labelText: 'Notes / reason', hintText: 'Add a note…')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: colors[action]),
            onPressed: () {
              Navigator.pop(context);
              context.read<ProofsBloc>().add(ProofActionRequested(proofId, action, notes: notesCtrl.text));
            },
            child: Text(action == 'approve' ? 'Approve' : action == 'reject' ? 'Reject' : 'Request'),
          ),
        ],
      ),
    );
  }
}

// ── Version tile ──────────────────────────────────────────
class _VersionTile extends StatelessWidget {
  final ProofVersion version;
  final String proofId;
  const _VersionTile({required this.version, required this.proofId});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(8)),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
          child: const Icon(Icons.insert_drive_file_outlined, size: 16, color: AppColors.primary),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('v${version.versionNumber} — ${version.fileName ?? 'File'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          if (version.comment != null) Text(version.comment!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('${version.uploadedByName ?? '—'} · ${Fmt.date(version.createdAt)}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ])),
        // Download button — gets presigned URL then launches
        IconButton(
          icon: const Icon(Icons.download_outlined, size: 20, color: AppColors.primary),
          tooltip: 'Download',
          onPressed: () async {
            try {
              final res = await ApiClient.instance.get('/admin/proofs/file/$proofId/${version.id}');
              final url = res.data['url'] as String?;
              if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
            } catch (_) {
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to get download link')));
            }
          },
        ),
      ]),
    );
  }
}
