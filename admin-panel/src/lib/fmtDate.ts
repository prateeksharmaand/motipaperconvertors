/** Format any ISO/YYYY-MM-DD date string to DD/MM/YYYY for display. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format an ISO timestamp to DD/MM/YYYY HH:MM for display. */
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const h = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hours = String(h % 12 || 12).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}
