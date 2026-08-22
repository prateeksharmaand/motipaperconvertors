class Job {
  final String id;
  final int jobNumber;
  final String? jobType;
  final String? clientName;
  final String? clientCompanyName;
  final String? clientPhone;
  final String status;
  final int? quantity;
  final String? sheetSize;
  final double? quotedPrice;
  final double? advanceAmount;
  final String? dueDate;
  final String? createdAt;
  final String? machineId;
  final String? printOperatorId;
  final String? designerId;
  final String? bindingOperatorId;
  final String? packingOperatorId;
  final String? qcOperatorId;
  final String? orderType;
  final bool? proofRequired;
  final List<JobPaper> papers;

  const Job({
    required this.id,
    required this.jobNumber,
    this.jobType,
    this.clientName,
    this.clientCompanyName,
    this.clientPhone,
    required this.status,
    this.quantity,
    this.sheetSize,
    this.quotedPrice,
    this.advanceAmount,
    this.dueDate,
    this.createdAt,
    this.machineId,
    this.printOperatorId,
    this.designerId,
    this.bindingOperatorId,
    this.packingOperatorId,
    this.qcOperatorId,
    this.orderType,
    this.proofRequired,
    this.papers = const [],
  });

  factory Job.fromJson(Map<String, dynamic> j) => Job(
    id: j['id'] as String,
    jobNumber: j['job_number'] as int? ?? 0,
    jobType: j['job_type'] as String?,
    clientName: j['client_name'] as String?,
    clientCompanyName: j['client_company_name'] as String?,
    clientPhone: j['client_phone'] as String?,
    status: j['status'] as String? ?? 'draft',
    quantity: j['quantity'] as int?,
    sheetSize: j['sheet_size'] as String?,
    quotedPrice: double.tryParse(j['quoted_price']?.toString() ?? ''),
    advanceAmount: double.tryParse(j['advance_amount']?.toString() ?? ''),
    dueDate: j['due_date'] as String?,
    createdAt: j['created_at'] as String?,
    machineId: j['machine_id'] as String?,
    printOperatorId: j['print_operator_id'] as String?,
    designerId: j['designer_id'] as String?,
    bindingOperatorId: j['binding_operator_id'] as String?,
    packingOperatorId: j['packing_operator_id'] as String?,
    qcOperatorId: j['qc_operator_id'] as String?,
    orderType: j['order_type'] as String?,
    proofRequired: j['proof_required'] as bool?,
    papers: (j['papers'] as List? ?? []).map((p) => JobPaper.fromJson(p as Map<String, dynamic>)).toList(),
  );
}

class JobPaper {
  final String id;
  final String paperStockId;
  final String? paperName;
  final int? gsm;
  final String? size;
  final String? unit;
  final int sheetCount;

  const JobPaper({
    required this.id,
    required this.paperStockId,
    this.paperName,
    this.gsm,
    this.size,
    this.unit,
    required this.sheetCount,
  });

  factory JobPaper.fromJson(Map<String, dynamic> j) => JobPaper(
    id: j['id'] as String,
    paperStockId: j['paper_stock_id'] as String,
    paperName: j['paper_name'] as String?,
    gsm: j['gsm'] as int?,
    size: j['size'] as String?,
    unit: j['unit'] as String?,
    sheetCount: j['sheet_count'] as int? ?? 0,
  );
}

class JobStatusHistory {
  final String id;
  final String? fromStatus;
  final String toStatus;
  final String? notes;
  final String? changedAt;
  final String? changedByName;

  const JobStatusHistory({
    required this.id,
    this.fromStatus,
    required this.toStatus,
    this.notes,
    this.changedAt,
    this.changedByName,
  });

  factory JobStatusHistory.fromJson(Map<String, dynamic> j) => JobStatusHistory(
    id: j['id'] as String,
    fromStatus: j['from_status'] as String?,
    toStatus: j['to_status'] as String,
    notes: j['notes'] as String?,
    changedAt: j['changed_at'] as String?,
    changedByName: j['changed_by_name'] as String?,
  );
}
