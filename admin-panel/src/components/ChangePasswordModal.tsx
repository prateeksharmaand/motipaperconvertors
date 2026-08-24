import { toast } from "sonner";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

export default function ChangePasswordModal({ userId, userName, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => api.patch(`/admin/users/${userId}/password`, { password }),
    onSuccess: () => { toast.success("Password changed successfully"); onClose(); },
    onError: (e: unknown) => { const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to change password."; setError(msg); toast.error(msg); },
  });

  function handleSave() {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    save.mutate();
  }

  const inputStyle: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, width: "100%", fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Change Password</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>{userName}</p>

        <label style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          New Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inputStyle} />
        </label>
        <label style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          Confirm Password
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSave()} />
        </label>

        {error && <div style={{ color: "#c92a2a", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={save.isPending}
            style={{ flex: 1, padding: "9px 0", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            {save.isPending ? "Saving…" : "Save Password"}
          </button>
          <button onClick={onClose}
            style={{ padding: "9px 16px", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", background: "#fff", fontSize: 14 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
