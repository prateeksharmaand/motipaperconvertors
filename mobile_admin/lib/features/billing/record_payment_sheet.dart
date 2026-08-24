import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/app_toast.dart';

class RecordPaymentSheet extends StatefulWidget {
  final String? invoiceId;
  final String? clientId;
  final String? clientName;
  final double? maxAmount;
  const RecordPaymentSheet({super.key, this.invoiceId, this.clientId, this.clientName, this.maxAmount});

  @override
  State<RecordPaymentSheet> createState() => _RecordPaymentSheetState();
}

class _RecordPaymentSheetState extends State<RecordPaymentSheet> {
  final _amountCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _mode = 'cash';
  String _type = 'against_invoice';
  bool _saving = false;
  String? _error;

  static const _modes = ['cash', 'upi', 'cheque', 'neft', 'rtgs', 'other'];
  static const _types = ['advance', 'against_invoice', 'adjustment'];

  @override
  void dispose() { _amountCtrl.dispose(); _refCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountCtrl.text);
    if (amount == null || amount <= 0) { setState(() => _error = 'Enter a valid amount'); return; }
    setState(() { _saving = true; _error = null; });
    try {
      await ApiClient.instance.post('/admin/billing/payments', data: {
        'amount': amount,
        'paymentMode': _mode,
        'type': _type,
        if (widget.invoiceId != null) 'invoiceId': widget.invoiceId,
        if (widget.clientId != null) 'clientId': widget.clientId,
        if (_refCtrl.text.isNotEmpty) 'referenceNumber': _refCtrl.text,
        if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text,
        'paymentDate': DateTime.now().toIso8601String().substring(0, 10),
      });
      AppToast.success('Payment recorded successfully');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      AppToast.error('Failed to record payment');
      setState(() { _saving = false; _error = 'Failed to record payment'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Record Payment', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        if (widget.clientName != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text('Client: ${widget.clientName}', style: const TextStyle(color: AppColors.textMuted, fontSize: 13))),
        if (_error != null) Container(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: AppColors.errorLight, borderRadius: BorderRadius.circular(8)), child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13))),
        TextField(
          controller: _amountCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: 'Amount (₹) *',
            prefixText: '₹ ',
            helperText: widget.maxAmount != null ? 'Balance due: ₹${widget.maxAmount!.toStringAsFixed(2)}' : null,
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _mode,
          decoration: const InputDecoration(labelText: 'Payment Mode'),
          items: _modes.map((m) => DropdownMenuItem(value: m, child: Text(m.toUpperCase()))).toList(),
          onChanged: (v) => setState(() => _mode = v ?? 'cash'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _type,
          decoration: const InputDecoration(labelText: 'Payment Type'),
          items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ').toUpperCase()))).toList(),
          onChanged: (v) => setState(() => _type = v ?? 'against_invoice'),
        ),
        if (_mode == 'cheque' || _mode == 'neft' || _mode == 'rtgs') ...[
          const SizedBox(height: 12),
          TextField(controller: _refCtrl, decoration: const InputDecoration(labelText: 'Reference / Cheque Number')),
        ],
        const SizedBox(height: 12),
        TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)'), maxLines: 2),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _saving ? null : _submit,
          child: _saving ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Record Payment'),
        ),
      ]),
    );
  }
}
