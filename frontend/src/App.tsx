import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LobbyScreen } from "./screens/lobby/LobbyScreen";
import { MeetingScreen } from "./screens/meeting/MeetingScreen";
import { AdminDashboardScreen } from "./screens/admin/AdminDashboardScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ProfileScreen } from "./screens/auth/ProfileScreen";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Toaster } from "sonner";
import { useAuthStore } from "./stores/useAuthStore";
import React from "react";

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore();
  if (accessToken) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          <Route path="signup" element={<AuthRoute><SignupScreen /></AuthRoute>} />
          <Route path="signin" element={<AuthRoute><LoginScreen /></AuthRoute>} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/lobby" element={<LobbyScreen />} />
            <Route path="/meeting/:id" element={<MeetingScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>

          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminDashboardScreen />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
