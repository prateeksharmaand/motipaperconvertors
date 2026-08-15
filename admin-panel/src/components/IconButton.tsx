import { useState } from "react";

interface IconButtonProps {
  icon: string;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  success?: boolean;
  style?: React.CSSProperties;
}

export default function IconButton({ icon, tooltip, onClick, disabled, danger, success, style }: IconButtonProps) {
  const [visible, setVisible] = useState(false);

  const borderColor = danger ? "#fdd" : success ? "#d3f9d8" : "#ddd";

  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: "4px 8px", fontSize: 15, border: `1px solid ${borderColor}`,
          borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
          background: "#fff", opacity: disabled ? 0.5 : 1,
          lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
          ...style,
        }}
      >
        {icon}
      </button>
      {visible && !disabled && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "#1f2937", color: "#fff",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
          padding: "4px 8px", borderRadius: 5,
          pointerEvents: "none", zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {tooltip}
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
