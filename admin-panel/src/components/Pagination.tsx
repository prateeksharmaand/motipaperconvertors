interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}

const btn = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  border: `1px solid ${active ? "#7c3aed" : "#e5e7eb"}`,
  borderRadius: 7,
  cursor: disabled ? "default" : "pointer",
  background: active ? "#7c3aed" : disabled ? "#f9fafb" : "#fff",
  color: active ? "#fff" : disabled ? "#d1d5db" : "#374151",
  fontWeight: active ? 700 : 400,
  fontSize: 12,
  fontFamily: "inherit",
});

export default function Pagination({ page, totalPages, total, limit, onPage }: PaginationProps) {
  if (totalPages <= 1) return (
    <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 12 }}>
      {total} result{total !== 1 ? "s" : ""}
    </div>
  );

  // Show up to 7 page buttons with ellipsis
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "#9ca3af", marginRight: 6 }}>
        {from}–{to} of {total}
      </span>
      <button style={btn(false, page === 1)} disabled={page === 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} style={{ padding: "6px 4px", color: "#9ca3af", fontSize: 12 }}>…</span>
        ) : (
          <button key={p} style={btn(p === page, false)} onClick={() => onPage(p as number)}>{p}</button>
        )
      )}
      <button style={btn(false, page === totalPages)} disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}
