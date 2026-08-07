import 'package:flutter/material.dart';

class QuotationScreen extends StatelessWidget {
  final String jobId;
  const QuotationScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quotation')),
      body: Center(child: Text('Quotation builder for job $jobId — coming soon')),
    );
  }
}
