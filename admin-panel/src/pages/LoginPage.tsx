import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuthStore } from "../store/auth.ts";
import * as theme from "../theme.ts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
      setTokens(data.accessToken, data.refreshToken, payload.role, payload.tenantId, payload.sub);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    ...theme.input,
    display: "block",
    marginTop: 6,
    fontSize: 13,
    padding: "9px 12px",
    border: focused ? "1px solid #7c3aed" : "1px solid #e5e7eb",
    boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.1)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg)",
    }}>
      <form onSubmit={submit} style={{
        background: "#fff",
        padding: 40,
        borderRadius: 12,
        width: 400,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 4, fontSize: 24, fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.5px" }}>
          MotiPaper
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 28 }}>
          Press Management System
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 7,
            padding: "9px 12px",
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Email */}
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            required
            placeholder="you@example.com"
            style={inputStyle(focusedField === "email")}
          />
        </label>

        {/* Password */}
        <label style={{ display: "block", marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            required
            placeholder="••••••••"
            style={inputStyle(focusedField === "password")}
          />
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...theme.btnPrimary,
            width: "100%",
            padding: "10px 0",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
