import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuthStore } from "../store/auth.ts";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      // Decode role from access token payload
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <form onSubmit={submit} style={{ background: "#fff", padding: 40, borderRadius: 12, width: 360, boxShadow: "0 2px 16px rgba(0,0,0,.08)" }}>
        <h1 style={{ marginBottom: 8, color: "#3b5bdb" }}>MotiPaper</h1>
        <p style={{ color: "#888", marginBottom: 24 }}>Admin Panel</p>
        {error && <p style={{ color: "#e03131", marginBottom: 16 }}>{error}</p>}
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#555" }}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }} />
        </label>
        <label style={{ display: "block", marginBottom: 24 }}>
          <span style={{ fontSize: 13, color: "#555" }}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }} />
        </label>
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: "10px 0", background: "#3b5bdb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
