import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { canAccessCommand } from "@/lib/command-access";

/**
 * Route guard for the Command page. Only the two allow-listed emails may
 * load it. Everyone else (owners, super admins, managers) is redirected to
 * /manager. Requires an authenticated manager-or-above session (same gate as
 * the rest of /manager).
 */
export function CommandRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Must be a manager-level account to be on /manager at all.
  if (
    !["super_admin", "owner", "owner_readonly", "manager"].includes(user.role)
  ) {
    return <Navigate to="/manager" replace />;
  }

  if (!canAccessCommand(user.email)) {
    return <Navigate to="/manager" replace />;
  }

  return <Layout>{children}</Layout>;
}
