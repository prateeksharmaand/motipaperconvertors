import type React from "react";

export const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  overflow: "hidden",
};

export const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

export const btnSecondary: React.CSSProperties = {
  padding: "8px 14px",
  background: "#f9fafb",
  color: "#374151",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

export const btnDanger: React.CSSProperties = {
  padding: "6px 12px",
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fca5a5",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};

export const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  width: "100%",
  fontSize: 12,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export const th: React.CSSProperties = {
  padding: "6px 12px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  userSelect: "none",
  cursor: "pointer",
};

export const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#374151",
  borderBottom: "1px solid #f3f4f6",
};

export const badge = (
  color: "green" | "red" | "amber" | "blue" | "purple" | "gray"
): React.CSSProperties => {
  const map = {
    green:  { background: "#dcfce7", color: "#166534" },
    red:    { background: "#fee2e2", color: "#991b1b" },
    amber:  { background: "#fef3c7", color: "#92400e" },
    blue:   { background: "#eff6ff", color: "#1d4ed8" },
    purple: { background: "#ede9fe", color: "#6d28d9" },
    gray:   { background: "#f1f5f9", color: "#475569" },
  };
  return {
    ...map[color],
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    display: "inline-block",
  };
};

export const pageTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: "#111827",
  marginBottom: 20,
};

/** Convert snake_case status to Title Case: "partially_paid" → "Partially Paid" */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
