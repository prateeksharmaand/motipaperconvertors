export default function PrintListButton({ label = "Print List" }: { label?: string }) {
  return (
    <button
      className="no-print"
      onClick={() => window.print()}
      style={{
        padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 7,
        cursor: "pointer", background: "#fff", fontSize: 13, fontWeight: 500,
        color: "#374151", display: "flex", alignItems: "center", gap: 6,
      }}
    >
      🖨 {label}
    </button>
  );
}
