import { useState, useEffect } from "react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuthStore } from "./stores/useAuthStore";

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [accessToken]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#6b7280',
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated && !accessToken) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          {/* Auth Routes - No Protection */}
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/signin" element={<LoginScreen />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <LobbyScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting/:id"
            element={
              <ProtectedRoute>
                <MeetingScreen />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
