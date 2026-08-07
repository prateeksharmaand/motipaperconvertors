import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/jobs_provider.dart';

const _statusColor = {
  'enquiry': Color(0xFF868E96),
  'quotation': Color(0xFF1971C2),
  'design': Color(0xFF7048E8),
  'approval': Color(0xFFF59F00),
  'print': Color(0xFF2F9E44),
  'finishing': Color(0xFF0C8599),
  'qc': Color(0xFFE67700),
  'ready': Color(0xFF2B8A3E),
  'delivered': Color(0xFF1864AB),
  'cancelled': Color(0xFFC92A2A),
};

class JobsListScreen extends ConsumerWidget {
  const JobsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(jobsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Jobs'), centerTitle: false),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/jobs/new'),
        child: const Icon(Icons.add),
      ),
      body: jobsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (jobs) => ListView.separated(
          itemCount: jobs.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, i) {
            final job = jobs[i];
            final color = _statusColor[job['status']] ?? Colors.grey;
            return ListTile(
              leading: CircleAvatar(
                backgroundColor: color.withOpacity(.15),
                child: Text('${job['job_number']}', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
              ),
              title: Text(job['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${job['client_name'] ?? 'No client'} · ${job['due_date'] ?? ''}'),
              trailing: Chip(
                label: Text(job['status'] ?? '', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                backgroundColor: color.withOpacity(.1),
                side: BorderSide(color: color.withOpacity(.3)),
                padding: EdgeInsets.zero,
              ),
              onTap: () => context.go('/jobs/${job['id']}'),
            );
          },
        ),
      ),
    );
  }
}
