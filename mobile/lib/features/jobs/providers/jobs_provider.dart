import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../lib/api_client.dart';

part 'jobs_provider.g.dart';

@riverpod
Future<List<Map<String, dynamic>>> jobs(JobsRef ref) async {
  final client = ref.watch(apiClientProvider);
  final data = await client.getJobs();
  return List<Map<String, dynamic>>.from(data['jobs']);
}

@riverpod
Future<Map<String, dynamic>?> jobDetail(JobDetailRef ref, String jobId) async {
  final client = ref.watch(apiClientProvider);
  return client.getJob(jobId);
}
