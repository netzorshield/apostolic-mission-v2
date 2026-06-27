import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-iam-bg">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-iam-gold border-t-transparent" />
    </div>
  );
}

export function isApprovedMember(user) {
  if (!user) return false;
  if (user.role === "admin") return false;
  return Boolean(user.enrollment_complete && user.member_id && user.status === "active");
}

export function ProtectedRoute({ children, adminOnly = false, memberPortal = false, memberOnly = false }) {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (user?.status === "deletion_hold") logout();
  }, [user?.status, logout]);

  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "deletion_hold") return <RouteLoading />;
  if (user.status === "rejected") return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  if ((memberOnly || memberPortal) && user.role === "admin") return <Navigate to="/admin" replace />;
  if (memberPortal && !isApprovedMember(user)) return <Navigate to="/enrollment" replace />;

  return children;
}

export function GuestRoute({ children, allowPendingSwitch = false }) {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoading />;

  if (user) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (isApprovedMember(user)) return <Navigate to="/dashboard" replace />;
    if (!allowPendingSwitch) return <Navigate to="/enrollment" replace />;
  }

  return children;
}
