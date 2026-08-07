import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../providers/jobs_provider.dart';

class JobDetailScreen extends ConsumerWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobAsync = ref.watch(jobDetailProvider(jobId));

    return Scaffold(
      appBar: AppBar(title: const Text('Job Details')),
      body: jobAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (job) {
          if (job == null) return const Center(child: Text('Job not found'));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text('Job #${job['job_number']}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800))),
                          QrImageView(data: jobId, size: 72),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(job['title'] ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text(job['client_name'] ?? 'No client', style: TextStyle(color: Colors.grey[600])),
                      const SizedBox(height: 16),
                      _infoRow('Status', job['status'] ?? ''),
                      _infoRow('Due Date', job['due_date'] ?? '—'),
                      _infoRow('Machine', job['machine_name'] ?? '—'),
                      _infoRow('Operator', job['operator_name'] ?? '—'),
                      _infoRow('Quantity', '${job['quantity'] ?? '—'}'),
                      _infoRow('Size', job['size'] ?? '—'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Status history
              if (job['statusHistory'] != null) ...[
                Text('Status History', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                ...((job['statusHistory'] as List).map((h) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.circle, size: 10, color: Colors.blue),
                  title: Text('${h['from_status'] ?? 'Start'} → ${h['to_status']}'),
                  subtitle: Text(h['changed_by_name'] ?? ''),
                ))),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        SizedBox(width: 100, child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
      ],
    ),
  );
}
