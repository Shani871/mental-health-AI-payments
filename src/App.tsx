import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import TriageChat from "./pages/TriageChat";
import Therapists from "./pages/Therapists";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import TherapistSessions from "./pages/TherapistSessions";
import Payments from "./pages/Payments";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TherapistSignup from "./pages/TherapistSignup";
import RoleGuard from "./components/RoleGuard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="triage"
            element={
              <RoleGuard allowedRoles={["USER"]}>
                <TriageChat />
              </RoleGuard>
            }
          />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="therapist-signup" element={<TherapistSignup />} />
          <Route
            path="therapists"
            element={
              <RoleGuard allowedRoles={["USER"]}>
                <Therapists />
              </RoleGuard>
            }
          />
          <Route
            path="dashboard"
            element={
              <RoleGuard allowedRoles={["USER"]}>
                <Dashboard />
              </RoleGuard>
            }
          />
          <Route
            path="payments"
            element={
              <RoleGuard allowedRoles={["USER"]}>
                <Payments />
              </RoleGuard>
            }
          />
          <Route
            path="therapist"
            element={
              <RoleGuard allowedRoles={["THERAPIST"]}>
                <TherapistSessions />
              </RoleGuard>
            }
          />
          <Route
            path="admin"
            element={
              <RoleGuard allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </RoleGuard>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
