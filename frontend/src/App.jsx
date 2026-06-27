import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, GuestRoute } from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AppWallpaper from "./components/AppWallpaper";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HelpPage from "./pages/HelpPage";
import EnrollmentPage from "./pages/EnrollmentPage";
import MemberDashboard from "./pages/MemberDashboard";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <>
      <AppWallpaper />
      <ErrorBoundary>
        <Routes>
        <Route index element={<HomePage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<GuestRoute allowPendingSwitch><LoginPage /></GuestRoute>} />
        <Route path="/enroll" element={<RegisterPage />} />
        <Route path="/register" element={<Navigate to="/enroll" replace />} />
        <Route path="/apply" element={<Navigate to="/enroll" replace />} />
        <Route path="/help" element={<ProtectedRoute memberOnly><HelpPage /></ProtectedRoute>} />
        <Route path="/enrollment" element={<ProtectedRoute memberOnly><EnrollmentPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute memberPortal><MemberDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </>
  );
}
