import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import 'job_form_screen.dart';
import '../../core/utils/formatters.dart';
import '../../models/job_model.dart';
import 'jobs_bloc.dart';

// ── BLoC for a single job detail ─────────────────────────
abstract class JobDetailState {}
class JobDetailLoading extends JobDetailState {}
class JobDetailLoaded extends JobDetailState {
  final Job job;
  final List<JobStatusHistory> history;
  JobDetailLoaded(this.job, this.history);
}
class JobDetailError extends JobDetailState {
  final String message;
  JobDetailError(this.message);
}

abstract class JobDetailEvent {}
class JobDetailLoadRequested extends JobDetailEvent { final String jobId; JobDetailLoadRequested(this.jobId); }

class JobDetailBloc extends Bloc<JobDetailEvent, JobDetailState> {
  JobDetailBloc() : super(JobDetailLoading()) {
    on<JobDetailLoadRequested>(_onLoad);
  }
  Future<void> _onLoad(JobDetailLoadRequested event, Emitter<JobDetailState> emit) async {
    emit(JobDetailLoading());
    try {
      final res = await ApiClient.instance.get('/admin/jobs/${event.jobId}');
      final data = res.data as Map<String, dynamic>;
      final job = Job.fromJson(data);
      final rawHistory = data['history'] as List? ?? [];
      final history = rawHistory.map((h) => JobStatusHistory.fromJson(h as Map<String, dynamic>)).toList();
      emit(JobDetailLoaded(job, history));
    } catch (e) {
      emit(JobDetailError(e.toString()));
    }
  }
}

// ── Screen ────────────────────────────────────────────────
class JobDetailScreen extends StatelessWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => JobDetailBloc()..add(JobDetailLoadRequested(jobId)),
      child: _JobDetailView(jobId: jobId),
    );
  }
}

class _JobDetailView extends StatelessWidget {
  final String jobId;
  const _JobDetailView({required this.jobId});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<JobDetailBloc, JobDetailState>(
      builder: (context, state) {
        if (state is JobDetailLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        if (state is JobDetailError) {
          return Scaffold(appBar: AppBar(), body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(state.message),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: () => context.read<JobDetailBloc>().add(JobDetailLoadRequested(jobId)), child: const Text('Retry')),
          ])));
        }

        final loaded = state as JobDetailLoaded;
        final job = loaded.job;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: const Color(0xFF1F2937),
            foregroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            title: Text('#${job.jobNumber} ${job.jobType ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit_outlined, color: Colors.white),
                tooltip: 'Edit',
                onPressed: () async {
                  final updated = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => JobFormScreen(existing: job)));
                  if (updated == true && context.mounted) context.read<JobDetailBloc>().add(JobDetailLoadRequested(jobId));
                },
              ),
              IconButton(icon: const Icon(Icons.refresh_outlined, color: Colors.white), onPressed: () => context.read<JobDetailBloc>().add(JobDetailLoadRequested(jobId))),
              const SizedBox(width: 8),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Status + change button
              _StatusCard(job: job, onStatusChange: (newStatus, notes) {
                context.read<JobsBloc>().add(JobsStatusChanged(job.id, newStatus, notes: notes));
                context.read<JobDetailBloc>().add(JobDetailLoadRequested(jobId));
              }),
              const SizedBox(height: 16),
              // Client info
              _InfoCard(title: 'Client', children: [
                _InfoRow('Company', job.clientCompanyName ?? job.clientName ?? '—'),
                if (job.clientPhone != null) _InfoRow('Phone', job.clientPhone!),
              ]),
              const SizedBox(height: 12),
              // Basic info
              _InfoCard(title: 'Job Details', children: [
                _InfoRow('Job Type', job.jobType ?? '—'),
                _InfoRow('Order Type', job.orderType == 'in_house' ? 'In House' : (job.orderType ?? '—')),
                if (job.machineName != null) _InfoRow('Machine', job.machineName!),
                if (job.quantity != null) _InfoRow('Quantity', '${job.quantity}'),
                if (job.sheetSize != null) _InfoRow('Sheet Size', job.sheetSize!),
                if (job.sheetCount != null) _InfoRow('Sheet Count', '${job.sheetCount}'),
                if (job.printOperatorName != null) _InfoRow('Print Operator', job.printOperatorName!),
                if (job.isLamination == true) _InfoRow('Lamination', job.laminationType != null ? 'Yes – ${job.laminationType![0].toUpperCase()}${job.laminationType!.substring(1)}' : 'Yes'),
                _InfoRow('Created', Fmt.date(job.createdAt)),
                if (job.dueDate != null) _InfoRow('Due Date', Fmt.date(job.dueDate)),
                if (job.proofRequired == true) const _InfoRow('Proof Required', 'Yes'),
              ]),
              const SizedBox(height: 12),
              // Financial
              if (job.quotedPrice != null || job.advanceAmount != null || job.taxInvoiceNo != null || job.invoiceDate != null)
                _InfoCard(title: 'Financial', children: [
                  if (job.quotedPrice != null) _InfoRow('Quoted Price', Fmt.money(job.quotedPrice), highlight: true),
                  if (job.advanceAmount != null) _InfoRow('Advance', Fmt.money(job.advanceAmount)),
                  if (job.taxInvoiceNo != null) _InfoRow('Tax Invoice No', job.taxInvoiceNo!),
                  if (job.invoiceDate != null) _InfoRow('Invoice Date', Fmt.date(job.invoiceDate)),
                ]),
              if (job.papers.isNotEmpty) ...[
                const SizedBox(height: 12),
                _PapersCard(papers: job.papers),
              ],
              const SizedBox(height: 12),
              // Status timeline
              if (loaded.history.isNotEmpty) _TimelineCard(history: loaded.history),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}

// ── Status card with change button ───────────────────────
class _StatusCard extends StatelessWidget {
  final Job job;
  final void Function(String status, String? notes) onStatusChange;
  const _StatusCard({required this.job, required this.onStatusChange});

  static const _workflow = ['enquiry','quotation','design','approval','print','finishing','qc','ready','delivered'];

  @override
  Widget build(BuildContext context) {
    final status = job.status;
    final color = AppColors.statusColors[status] ?? AppColors.textMuted;
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Current Status', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withValues(alpha: 0.3))),
            child: Text(Fmt.statusLabel(status), style: TextStyle(fontWeight: FontWeight.w700, color: color, fontSize: 14)),
          ),
        ]),
        if (status != 'cancelled' && status != 'delivered')
          ElevatedButton.icon(
            icon: const Icon(Icons.swap_horiz, size: 16),
            label: const Text('Change Status'),
            onPressed: () => _showStatusDialog(context),
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), textStyle: const TextStyle(fontSize: 13)),
          ),
      ]),
    ])));
  }

  void _showStatusDialog(BuildContext context) {
    String? selected;
    final notesCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Change Job Status'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('New Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: _workflow.map((s) {
              final c = AppColors.statusColors[s] ?? AppColors.textMuted;
              return ChoiceChip(
                label: Text(Fmt.statusLabel(s), style: TextStyle(fontSize: 11, color: selected == s ? Colors.white : c, fontWeight: FontWeight.w600)),
                selected: selected == s,
                onSelected: (_) => setState(() => selected = s),
                selectedColor: c, backgroundColor: c.withValues(alpha: 0.1),
                side: BorderSide(color: c.withValues(alpha: 0.4)),
              );
            }).toList()),
            const SizedBox(height: 16),
            TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)', hintText: 'Add a note…'), maxLines: 2),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selected == null ? null : () { Navigator.pop(ctx); onStatusChange(selected!, notesCtrl.text.isEmpty ? null : notesCtrl.text); },
              child: const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Papers card ───────────────────────────────────────────
class _PapersCard extends StatelessWidget {
  final List<JobPaper> papers;
  const _PapersCard({required this.papers});
  @override
  Widget build(BuildContext context) => _InfoCard(
    title: 'Paper Used (${papers.length})',
    children: papers.map((p) {
      final cost = p.effectiveCost;
      final costStr = cost != null ? ' — ₹${cost.toStringAsFixed(0)}' : '';
      return _InfoRow(
        '${p.paperName ?? 'Paper'}${p.gsm != null ? " ${p.gsm}gsm" : ""}',
        '${p.sheetCount} sheets$costStr',
      );
    }).toList(),
  );
}

// ── Status timeline ───────────────────────────────────────
class _TimelineCard extends StatelessWidget {
  final List<JobStatusHistory> history;
  const _TimelineCard({required this.history});

  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Status History', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      const SizedBox(height: 12),
      ...history.asMap().entries.map((entry) {
        final i = entry.key;
        final h = entry.value;
        final color = AppColors.statusColors[h.toStatus] ?? AppColors.textMuted;
        final isLast = i == history.length - 1;
        return IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            if (!isLast) Expanded(child: Container(width: 2, color: AppColors.border)),
          ]),
          const SizedBox(width: 12),
          Expanded(child: Padding(padding: EdgeInsets.only(bottom: isLast ? 0 : 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                child: Text(Fmt.statusLabel(h.toStatus), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color))),
              if (h.changedByName != null) ...[
                const SizedBox(width: 6),
                Expanded(child: Text('by ${h.changedByName}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ]),
            if (h.changedAt != null) Text(Fmt.dateTime(h.changedAt), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
            if (h.notes != null) Text(h.notes!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]))),
        ]));
      }),
    ])));
  }
}

// ── Reusable widgets ──────────────────────────────────────
class _InfoCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _InfoCard({required this.title, required this.children});
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
    const SizedBox(height: 10),
    const Divider(height: 1),
    const SizedBox(height: 10),
    ...children,
  ])));
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  const _InfoRow(this.label, this.value, {this.highlight = false});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
      Text(value, style: TextStyle(fontSize: 13, fontWeight: highlight ? FontWeight.w700 : FontWeight.w500, color: highlight ? AppColors.primary : AppColors.textPrimary)),
    ]),
  );
}
