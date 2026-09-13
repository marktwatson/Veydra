import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { DEFAULT_LOGO_URL } from "@/lib/utils";

export const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
    <div className="relative flex items-center justify-center mb-6">
      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"></div>
      <img
        src={DEFAULT_LOGO_URL}
        alt="Loading..."
        className="w-24 h-auto object-contain animate-pulse relative z-10"
        onError={(e) => {
          (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
        }}
      />
    </div>
  </div>
);

export const ProtectedRoute = ({
  children,
  requireRole,
  restrictRoles,
  superAdminOnly,
}: {
  children: React.ReactNode;
  requireRole?:
    | "super_admin"
    | "owner"
    | "owner_readonly"
    | "manager"
    | "contractor"
    | "editor";
  restrictRoles?: UserRole[];
  superAdminOnly?: boolean;
}) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (window.location.hash.includes("type=recovery")) {
    return <Navigate to={`/reset-password${window.location.hash}`} replace />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (superAdminOnly && user.role !== "super_admin") {
    return <Navigate to="/manager" replace />;
  }

  if (restrictRoles && restrictRoles.includes(user.role)) {
    return <Navigate to="/manager" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    if (
      requireRole === "manager" &&
      ["super_admin", "owner", "owner_readonly", "manager"].includes(user.role)
    ) {
      return <Layout>{children}</Layout>;
    }

    if (requireRole === "owner" && user.role === "owner_readonly") {
      return <Layout>{children}</Layout>;
    }

    if (
      ["super_admin", "owner", "owner_readonly", "manager"].includes(user.role)
    )
      return <Navigate to="/manager" replace />;
    if (user.role === "editor") return <Navigate to="/editor" replace />;
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

export const Mgr = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="manager">{children}</ProtectedRoute>
);

export const MgrOwner = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="manager" restrictRoles={["manager"]}>
    {children}
  </ProtectedRoute>
);
