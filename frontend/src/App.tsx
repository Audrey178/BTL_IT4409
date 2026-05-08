import { useState, useEffect } from "react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MeetingScreen } from "./screens/MeetingScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { LoginScreen } from "./screens/auth/LoginScreen";

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          {/* Auth Routes - No Protection */}
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/signin" element={<LoginScreen />} />

          <Route path="/" element={<DashboardScreen />} />
          <Route path="/admin" element={<AdminDashboardScreen />} />
          <Route path="/lobby" element={<LobbyScreen />} />
          <Route path="meeting" element={<MeetingScreen />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
