import { useState } from "react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "sonner";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          <Route path="signup" element={<SignupScreen />} />
          <Route path="signin" element={<LoginScreen />} />

          <Route path="/" element={<ProtectedRoute><DashboardScreen /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboardScreen /></ProtectedRoute>} />
          <Route path="/lobby" element={<ProtectedRoute><LobbyScreen /></ProtectedRoute>} />
          <Route path="meeting" element={<ProtectedRoute><MeetingScreen /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
