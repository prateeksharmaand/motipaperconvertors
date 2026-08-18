export type Role = "super_admin" | "owner" | "sub_admin" | "staff" | "operator";

export type Permission =
  | "jobs.view" | "jobs.create" | "jobs.edit" | "jobs.delete"
  | "quotation.view" | "quotation.create" | "quotation.edit_rates"
  | "production.view" | "production.update_status"
  | "inventory.view" | "inventory.edit" | "inventory.create_po"
  | "billing.view" | "billing.create_invoice" | "billing.record_payment"
  | "clients.view" | "clients.edit"
  | "staff.view" | "staff.manage"
  | "reports.view_financial"
  | "settings.edit"
  | "activity_log.view";

export interface JwtPayload {
  sub: string;        // user id
  tenantId: string | null;
  role: Role;
  iat?: number;
  exp?: number;
}

// Attached to req by auth middleware
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        tenantId: string | null;
        role: Role;
        permissions: Permission[];
      };
    }
  }
}
