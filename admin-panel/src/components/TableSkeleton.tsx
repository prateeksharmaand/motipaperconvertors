import { useEffect, useState } from "react";

// Inject keyframe animation once
const STYLE_ID = "shimmer-keyframes";
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes shimmer {
      0% { background-position: -600px 0; }
      100% { background-position: 600px 0; }
    }
    .shimmer-cell {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 4px;
      display: inline-block;
    }
  `;
  document.head.appendChild(s);
}

function ShimmerCell({ width = "80%", height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div className="shimmer-cell" style={{ width, height, margin: "2px 0" }} />
  );
}

interface TableSkeletonProps {
  cols: number;
  rows?: number;
  /** Optional width hint per column (fraction or px string) */
  colWidths?: (string | number)[];
}

export default function TableSkeleton({ cols, rows = 7, colWidths }: TableSkeletonProps) {
  const [tick, setTick] = useState(0);
  // stagger rows slightly for visual polish
  useEffect(() => { setTick(1); }, []);

  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} style={{ borderBottom: "1px solid #f0f0f0", opacity: tick ? 1 : 0, transition: `opacity 0.3s ease ${r * 40}ms` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} style={{ padding: "14px 14px" }}>
              <ShimmerCell width={colWidths?.[c] ?? (c === 0 ? "40%" : c === cols - 1 ? "60%" : "70%")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
