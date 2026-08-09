import type { Request, Response, NextFunction } from "express";
import type { Permission, Role } from "../types/index.js";

const OWNER_OR_ABOVE: Role[] = ["super_admin", "owner"];
// Staff/operators can access routes — row-level visibility is enforced in the query
const STAFF_ROLES: Role[] = ["staff", "operator"];

// Owners and above bypass entirely. Staff/operators pass through (query filters their data).
// Sub-admins must have the specific permission flag.
export function requirePermission(...perms: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role, permissions } = req.user;

    if (OWNER_OR_ABOVE.includes(role)) {
      next();
      return;
    }

    if (STAFF_ROLES.includes(role)) {
      next();
      return;
    }

    if (role === "sub_admin") {
      const hasAll = perms.every((p) => permissions.includes(p));
      if (hasAll) {
        next();
        return;
      }
    }

    res.status(403).json({ error: "Forbidden: insufficient permissions" });
  };
}

// Restrict to specific roles entirely (e.g. super_admin-only routes)
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (roles.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden: role not allowed" });
  };
}
