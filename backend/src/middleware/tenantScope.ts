import type { Request, Response, NextFunction } from "express";

// Ensures that tenant-scoped requests match the authenticated user's tenant.
// Super admins can optionally pass ?tenantId= to act on behalf of a tenant.
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const { role, tenantId } = req.user;

  if (role === "super_admin") {
    // Super admin can target any tenant via query/body param, or their own (null) scope
    const targetTenant = (req.query.tenantId ?? req.body?.tenantId ?? null) as string | null;
    req.user.tenantId = targetTenant;
    next();
    return;
  }

  if (!tenantId) {
    res.status(403).json({ error: "No tenant associated with this account" });
    return;
  }

  next();
}
