import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.ts";
import LoginPage from "./pages/LoginPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import JobsPage from "./pages/JobsPage.tsx";
import ClientsPage from "./pages/ClientsPage.tsx";
import MachinesPage from "./pages/MachinesPage.tsx";
import InventoryPage from "./pages/InventoryPage.tsx";
import BillingPage from "./pages/BillingPage.tsx";
import ReportsPage from "./pages/ReportsPage.tsx";
import SubAdminsPage from "./pages/SubAdminsPage.tsx";
import TenantsPage from "./pages/TenantsPage.tsx";
import Layout from "./components/Layout.tsx";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const role = useAuthStore((s) => s.role);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        {(role === "owner" || role === "super_admin") && (
          <>
            <Route path="machines" element={<MachinesPage />} />
            <Route path="sub-admins" element={<SubAdminsPage />} />
          </>
        )}
        {role === "super_admin" && (
          <Route path="tenants" element={<TenantsPage />} />
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
