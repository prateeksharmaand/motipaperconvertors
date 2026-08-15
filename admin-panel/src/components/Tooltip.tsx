import { useState } from "react";

export default function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1f2937", color: "#fff",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          padding: "4px 8px", borderRadius: 5,
          pointerEvents: "none", zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {text}
          {/* arrow */}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderWidth: "4px 4px 0", borderStyle: "solid",
            borderColor: "#1f2937 transparent transparent",
          }} />
        </div>
      )}
    </div>
  );
}
