import { useAuthStore } from "../store/auth.ts";

export default function DashboardPage() {
  const role = useAuthStore((s) => s.role);
  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: "#888" }}>Welcome back. You are signed in as <strong>{role}</strong>.</p>
      <p style={{ marginTop: 16, color: "#888" }}>Job stats and summary cards will appear here.</p>
    </div>
  );
}
