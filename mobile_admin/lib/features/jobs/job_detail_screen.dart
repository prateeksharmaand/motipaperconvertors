import 'package:flutter/material.dart';
class JobDetailScreen extends StatelessWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Job Detail')),
    body: Center(child: Text('Job: $jobId')),
  );
}
