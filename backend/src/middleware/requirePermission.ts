import type { Request, Response, NextFunction } from "express";
import type { Permission, Role } from "../types/index.js";

const OWNER_OR_ABOVE: Role[] = ["super_admin", "owner"];

// Owners and above bypass the permission check entirely.
// Sub-admins must have the specific flag. Staff/operators are rejected.
export function requirePermission(...perms: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role, permissions } = req.user;

    if (OWNER_OR_ABOVE.includes(role)) {
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
