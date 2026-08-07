import type { Knex } from "knex";

type CounterField =
  | "last_job_number"
  | "last_quotation_number"
  | "last_challan_number"
  | "last_invoice_number";

// Atomically increments the tenant's counter and returns the new value.
// Must be called inside an existing transaction.
export async function nextNumber(
  trx: Knex.Transaction,
  tenantId: string,
  field: CounterField,
): Promise<number> {
  const [row] = await trx("tenant_job_counters")
    .where({ tenant_id: tenantId })
    .increment(field, 1)
    .returning(field);
  return row[field] as number;
}
