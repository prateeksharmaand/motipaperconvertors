class Job {
  final String id;
  final int jobNumber;
  final String? jobType;
  final String? description;
  final String? clientName;
  final String? clientCompanyName;
  final String? clientPhone;
  final String status;
  final int? quantity;
  final String? sheetSize;
  final int? sheetCount;
  final double? quotedPrice;
  final double? advanceAmount;
  final double? approvedRate;
  final String? dueDate;
  final String? createdAt;
  final String? clientId;
  final String? machineId;
  final String? machineName;
  final String? printOperatorId;
  final String? designerId;
  final String? bindingOperatorId;
  final String? packingOperatorId;
  final String? qcOperatorId;
  final String? orderType;
  final bool? proofRequired;
  final String? printOperatorName;
  final String? laminationType;
  final bool? isLamination;
  // Print process
  final bool? isOffset;
  final bool? isDigital;
  final bool? isScreen;
  final int? colorsFont;
  final int? colorsBack;
  final String? printDate;
  // Pre-print costs
  final double? composingAmount;
  final String? composingDate;
  final double? plateCost;
  final double? dieCost;
  final String? plateSource;
  final double? helaCost;
  final double? otherCost;
  // Finishing flags
  final bool? isBinding;
  final bool? isUV;
  final bool? isFoil;
  final bool? isDieCutting;
  final bool? isHalfCutting;
  final bool? isCreasing;
  final bool? isPasting;
  final bool? isFolding;
  final bool? isGumming;
  final bool? isNumbering;
  final int? numberingFrom;
  final int? numberingTo;
  // Post-print & delivery
  final String? postPrintDate;
  final String? quotationRef;
  final String? indentNumber;
  final int? deliveryQuantity;
  final String? challanNumber;
  final String? challanDate;
  // Invoice
  final String? taxInvoiceNo;
  final String? invoiceDate;
  final List<JobPaper> papers;

  const Job({
    required this.id,
    required this.jobNumber,
    this.jobType,
    this.description,
    this.clientName,
    this.clientCompanyName,
    this.clientPhone,
    required this.status,
    this.quantity,
    this.sheetSize,
    this.sheetCount,
    this.quotedPrice,
    this.advanceAmount,
    this.approvedRate,
    this.dueDate,
    this.createdAt,
    this.clientId,
    this.machineId,
    this.machineName,
    this.printOperatorId,
    this.designerId,
    this.bindingOperatorId,
    this.packingOperatorId,
    this.qcOperatorId,
    this.orderType,
    this.proofRequired,
    this.printOperatorName,
    this.laminationType,
    this.isLamination,
    this.isOffset,
    this.isDigital,
    this.isScreen,
    this.colorsFont,
    this.colorsBack,
    this.printDate,
    this.composingAmount,
    this.composingDate,
    this.plateCost,
    this.dieCost,
    this.plateSource,
    this.helaCost,
    this.otherCost,
    this.isBinding,
    this.isUV,
    this.isFoil,
    this.isDieCutting,
    this.isHalfCutting,
    this.isCreasing,
    this.isPasting,
    this.isFolding,
    this.isGumming,
    this.isNumbering,
    this.numberingFrom,
    this.numberingTo,
    this.postPrintDate,
    this.quotationRef,
    this.indentNumber,
    this.deliveryQuantity,
    this.challanNumber,
    this.challanDate,
    this.taxInvoiceNo,
    this.invoiceDate,
    this.papers = const [],
  });

  factory Job.fromJson(Map<String, dynamic> j) => Job(
    id: j['id'] as String,
    jobNumber: j['job_number'] as int? ?? 0,
    jobType: j['job_type'] as String?,
    description: j['description'] as String?,
    clientName: j['client_name'] as String?,
    clientCompanyName: j['client_company_name'] as String?,
    clientPhone: j['client_phone'] as String?,
    status: j['status'] as String? ?? 'draft',
    quantity: j['quantity'] as int?,
    sheetSize: j['sheet_size'] as String?,
    sheetCount: j['sheet_count'] as int?,
    quotedPrice: double.tryParse(j['quoted_price']?.toString() ?? ''),
    advanceAmount: double.tryParse(j['advance_amount']?.toString() ?? ''),
    approvedRate: double.tryParse(j['approved_rate']?.toString() ?? ''),
    dueDate: j['due_date'] as String?,
    createdAt: j['created_at'] as String?,
    clientId: j['client_id'] as String?,
    machineId: j['machine_id'] as String?,
    machineName: j['machine_name'] as String?,
    printOperatorId: j['print_operator_id'] as String?,
    designerId: j['designer_id'] as String?,
    bindingOperatorId: j['binding_operator_id'] as String?,
    packingOperatorId: j['packing_operator_id'] as String?,
    qcOperatorId: j['qc_operator_id'] as String?,
    orderType: j['order_type'] as String?,
    proofRequired: j['proof_required'] as bool?,
    printOperatorName: j['print_operator_name'] as String?,
    laminationType: j['lamination_type'] as String?,
    isLamination: j['is_lamination'] as bool?,
    isOffset: j['is_offset'] as bool?,
    isDigital: j['is_digital'] as bool?,
    isScreen: j['is_screen'] as bool?,
    colorsFont: j['colors_font'] as int?,
    colorsBack: j['colors_back'] as int?,
    printDate: j['print_date'] as String?,
    composingAmount: double.tryParse(j['composing_amount']?.toString() ?? ''),
    composingDate: j['composing_date'] as String?,
    plateCost: double.tryParse(j['plate_cost']?.toString() ?? ''),
    dieCost: double.tryParse(j['die_cost']?.toString() ?? ''),
    plateSource: j['plate_source'] as String?,
    helaCost: double.tryParse(j['hela_cost']?.toString() ?? ''),
    otherCost: double.tryParse(j['other_cost']?.toString() ?? ''),
    isBinding: j['is_binding'] as bool?,
    isUV: j['is_uv'] as bool?,
    isFoil: j['is_foil'] as bool?,
    isDieCutting: j['is_die_cutting'] as bool?,
    isHalfCutting: j['is_half_cutting'] as bool?,
    isCreasing: j['is_creasing'] as bool?,
    isPasting: j['is_pasting'] as bool?,
    isFolding: j['is_folding'] as bool?,
    isGumming: j['is_gumming'] as bool?,
    isNumbering: j['is_numbering'] as bool?,
    numberingFrom: j['numbering_from'] as int?,
    numberingTo: j['numbering_to'] as int?,
    postPrintDate: j['post_print_date'] as String?,
    quotationRef: j['quotation_ref'] as String?,
    indentNumber: j['indent_number'] as String?,
    deliveryQuantity: j['delivery_quantity'] as int?,
    challanNumber: j['challan_number'] as String?,
    challanDate: j['challan_date'] as String?,
    taxInvoiceNo: j['tax_invoice_no'] as String?,
    invoiceDate: j['invoice_date'] as String?,
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
  final double? paperCost;
  final double? computedCost;

  const JobPaper({
    required this.id,
    required this.paperStockId,
    this.paperName,
    this.gsm,
    this.size,
    this.unit,
    required this.sheetCount,
    this.paperCost,
    this.computedCost,
  });

  double? get effectiveCost => paperCost ?? computedCost;

  factory JobPaper.fromJson(Map<String, dynamic> j) => JobPaper(
    id: j['id'] as String,
    paperStockId: j['paper_stock_id'] as String,
    paperName: j['paper_name'] as String?,
    gsm: j['gsm'] as int?,
    size: j['size'] as String?,
    unit: j['unit'] as String?,
    sheetCount: j['sheet_count'] as int? ?? 0,
    paperCost: double.tryParse(j['paper_cost']?.toString() ?? ''),
    computedCost: double.tryParse(j['computed_cost']?.toString() ?? ''),
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
