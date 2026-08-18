/** Converts an array of objects to CSV string buffer. */
export function exportToCsvBuffer(rows: Record<string, unknown>[]): Buffer {
  if (!rows.length) return Buffer.from("");
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ];
  return Buffer.from(lines.join("\n"), "utf-8");
}
