import { useEffect, useRef, useState } from "react";

interface FilterOption { label: string; value: string; }
interface FilterDef { key: string; label: string; options: FilterOption[]; }

interface TableControlsProps {
  search: string;
  onSearch: (s: string) => void;
  filters?: FilterDef[];
  activeFilters?: Record<string, string>;
  onFilter?: (key: string, value: string) => void;
  onReset?: () => void;
  placeholder?: string;
  rightSlot?: React.ReactNode;
}

// Debounce hook — delays calling fn until user stops typing
function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <span style={{ color: "#d1d5db", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "#7c3aed", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export default function TableControls({
  search, onSearch, filters = [], activeFilters = {}, onFilter, onReset, placeholder = "Search…", rightSlot,
}: TableControlsProps) {
  const [local, setLocal] = useState(search);
  const debounced = useDebounce(local);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onSearch(debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync if parent resets
  useEffect(() => { setLocal(search); }, [search]);

  const hasActiveFilters = Object.values(activeFilters).some(Boolean) || search;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      {/* Search input */}
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none", fontSize: 13 }}>🔍</span>
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "8px 10px 8px 32px",
            border: "1px solid #e5e7eb",
            borderRadius: 7,
            fontSize: 12,
            outline: "none",
            background: "#fff",
            fontFamily: "inherit",
          }}
        />
        {local && (
          <button onClick={() => { setLocal(""); onSearch(""); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      {filters.map((f) => (
        <select
          key={f.key}
          value={activeFilters[f.key] ?? ""}
          onChange={(e) => onFilter?.(f.key, e.target.value)}
          style={{
            padding: "8px 12px",
            border: `1px solid ${activeFilters[f.key] ? "#7c3aed" : "#e5e7eb"}`,
            borderRadius: 7,
            fontSize: 12,
            background: activeFilters[f.key] ? "#ede9fe" : "#fff",
            color: activeFilters[f.key] ? "#6d28d9" : "#374151",
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
          <option value="">{f.label}: All</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}

      {/* Reset */}
      {hasActiveFilters && (
        <button onClick={onReset} style={{
          padding: "8px 12px",
          border: "1px solid #e5e7eb",
          borderRadius: 7,
          background: "#f9fafb",
          fontSize: 12,
          color: "#6b7280",
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          Clear all
        </button>
      )}

      <div style={{ flex: 1 }} />
      {rightSlot}
    </div>
  );
}
