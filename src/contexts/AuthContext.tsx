import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { findManagerAccount, findEditorAccount } from "@/lib/auth-helpers";
import { AuthLoadingScreen } from "@/components/AuthLoadingScreen";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type UserRole =
  | "super_admin"
  | "owner"
  | "owner_readonly"
  | "manager"
  | "contractor"
  | "editor";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password?: string,
    type?: "super_admin" | "manager" | "contractor" | "editor",
  ) => Promise<void>;
  logout: () => void;
  impersonate: (user: User) => void;
  stopImpersonating: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    const loadUser = async (session: any) => {
      try {
        let savedRole = "contractor";
        try {
          savedRole = localStorage.getItem("veydra_role") || "contractor";
        } catch (e) {}

        const manager = await findManagerAccount(
          session.user.id,
          session.user.email,
        );
        const editor = await findEditorAccount(
          session.user.id,
          session.user.email,
        );

        if (!isMounted) return;

        // Auto-activate manager/editor if they logged in or session restored while invited
        if (session.user.id && session.user.email) {
          if (manager && manager.status === "invited") {
            await supabase
              .from("managers")
              .update({ status: "active", id: session.user.id })
              .ilike("email", session.user.email);
            manager.status = "active";
          }
          if (editor && editor.status === "invited") {
            await supabase
              .from("editors")
              .update({ status: "active", id: session.user.id })
              .ilike("email", session.user.email);
            editor.status = "active";
          }
        }

        const isSuperAdmin =
          savedRole === "super_admin" ||
          savedRole === "manager" ||
          savedRole === "editor" ||
          isSuperAdminEmail(session.user.email) ||
          manager?.role === "super_admin";

        let role: UserRole = "contractor";
        let name =
          session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] ||
          "Contractor";

        if (savedRole === "editor" && (editor || manager || isSuperAdmin)) {
          role = "editor";
          name = editor?.name || manager?.name || "Editor";
        } else if (manager) {
          if (manager.role === "editor" || manager.status === "active-editor") {
            role = "editor";
          } else if (manager.role === "owner_readonly") {
            role = "owner_readonly";
          } else if (manager.role === "super_admin" || isSuperAdmin) {
            role = "super_admin";
          } else {
            role = (manager.role as UserRole) || "manager";
          }
          name = manager.name || "Manager";
        } else if (isSuperAdmin) {
          role = "super_admin";
          name = "Super Admin";
        } else if (editor) {
          role = "editor";
          name = editor.name || "Editor";
        }

        let finalId = session.user.id;

        if (role === "contractor" && session.user.email) {
          const { data: contractor } = await supabase
            .from("contractors")
            .select("id, first_name, last_name")
            .ilike("email", session.user.email)
            .maybeSingle();

          if (contractor) {
            finalId = contractor.id;
            const fullName =
              `${contractor.first_name || ""} ${contractor.last_name || ""}`.trim();
            if (fullName) name = fullName;
          }
        }

        setUser({
          id: finalId,
          name,
          email: session.user.email || "",
          role,
        });

        // Persist the effective role so the api write-guard can enforce
        // read-only access for owner_readonly accounts without a DB call.
        try {
          localStorage.setItem("veydra_effective_role", role);
        } catch (e) {}
      } catch (e) {
        console.error("Error loading user role:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const restoreSession = async () => {
      try {
        const impersonated = localStorage.getItem("impersonated_user");
        if (impersonated) {
          setUser(JSON.parse(impersonated));
          if (isMounted) setIsLoading(false);
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          await loadUser(session);
        } else {
          if (isMounted) setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (localStorage.getItem("impersonated_user")) return;

      if (event === "PASSWORD_RECOVERY") {
        // When a user clicks a password reset link, Supabase emits this event.
        // We need to redirect them to the reset password page before the hash is lost.
        window.location.href = "/reset-password";
        return;
      }

      if (event === "SIGNED_OUT") {
        if (isMounted) setUser(null);
        queryClient.clear();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        console.log("Auth updated:", event);
        // Avoid async deadlocks inside the callback
        // Trigger a data refetch here if needed
        queryClient.invalidateQueries();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password?: string,
    type?: "super_admin" | "manager" | "contractor" | "editor",
  ) => {
    const cleanEmail = email.trim();

    if (!password) {
      throw new Error("Password is required");
    }

    try {
      let result;
      try {
        const loginPromise = supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 30000),
        );
        result = (await Promise.race([loginPromise, timeoutPromise])) as any;
      } catch (err: any) {
        if (
          err.message === "TIMEOUT" ||
          err.message?.toLowerCase().includes("lock")
        ) {
          // Clear stuck local session data completely (except logo)
          try {
            const logo = localStorage.getItem("veydra_logo_url");
            localStorage.clear();
            sessionStorage.clear();
            if (logo) localStorage.setItem("veydra_logo_url", logo);
          } catch (e) {}

          // Retry once after clearing cache with a 10s timeout
          const retryPromise = supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          const retryTimeout = new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Login timed out. Please check your internet connection or try again in a moment.",
                  ),
                ),
              30000,
            ),
          );
          result = (await Promise.race([retryPromise, retryTimeout])) as any;
        } else {
          throw err;
        }
      }

      const { data, error } = result;

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        localStorage.setItem("veydra_role", type || "contractor");

        if (type === "manager" || type === "super_admin") {
          const isSuperAdmin = isSuperAdminEmail(data.user.email);

          let manager = null;
          let editor = null;

          if (!isSuperAdmin) {
            manager = await findManagerAccount(data.user.id, data.user.email);

            if (manager && manager.status === "invited" && data.user.id) {
              await supabase
                .from("managers")
                .update({ status: "active", id: data.user.id })
                .eq("email", data.user.email);
              manager.status = "active";
            }

            if (!manager) {
              editor = await findEditorAccount(data.user.id, data.user.email);
              if (!editor) {
                await supabase.auth.signOut().catch(() => {});
                throw new Error(
                  "Unauthorized: Account is not registered as a manager.",
                );
              }
            }
          }

          const finalRole =
            manager?.role === "editor" ||
            manager?.status === "active-editor" ||
            editor
              ? "editor"
              : manager?.role === "super_admin" || isSuperAdmin
                ? "super_admin"
                : manager?.role === "owner_readonly"
                  ? "owner_readonly"
                  : (manager?.role as UserRole) || "manager";

          setUser({
            id: data.user.id,
            name:
              manager?.name ||
              editor?.name ||
              (isSuperAdmin ? "Super Admin" : "Manager"),
            email: data.user.email!,
            role: finalRole,
          });
          try {
            localStorage.setItem("veydra_effective_role", finalRole);
          } catch (e) {}
        } else if (type === "editor") {
          const isSuperAdmin = isSuperAdminEmail(data.user.email);

          let editor = null;
          let isManager = false;

          if (!isSuperAdmin) {
            // Check if they are a manager first
            const { data: mData } = await supabase
              .from("managers")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle();

            if (mData) {
              isManager = true;
            } else {
              const { data: eData, error: eError } = await supabase
                .from("editors")
                .select("*")
                .eq("id", data.user.id)
                .maybeSingle();

              editor = eData;

              if (eError || !editor) {
                await supabase.auth.signOut().catch(() => {});
                throw new Error(
                  "Unauthorized: Account is not registered as an editor.",
                );
              }
            }
          }

          setUser({
            id: data.user.id,
            name:
              editor?.name ||
              (isSuperAdmin || isManager ? "Manager" : "Editor"),
            email: data.user.email!,
            role: "editor",
          });
        } else {
          // Contractor login — but first check if this account is actually a
          // manager/owner in the managers table. If so, escalate to that role
          // instead of stranding them as a contractor (which shows Training).
          const mgr = await findManagerAccount(data.user.id, data.user.email);

          if (mgr && mgr.status !== "invited") {
            let mgrRole: UserRole =
              mgr.role === "owner_readonly"
                ? "owner_readonly"
                : mgr.role === "super_admin"
                  ? "super_admin"
                  : (mgr.role as UserRole) || "manager";
            setUser({
              id: data.user.id,
              name: mgr.name || "Manager",
              email: data.user.email!,
              role: mgrRole,
            });
            try {
              localStorage.setItem("veydra_effective_role", mgrRole);
            } catch (e) {}
          } else {
            let contractorId = data.user.id;
            let contractorName =
              data.user.user_metadata?.full_name ||
              data.user.email?.split("@")[0] ||
              "Contractor";

            const { data: contractor } = await supabase
              .from("contractors")
              .select("id, first_name, last_name")
              .ilike("email", cleanEmail)
              .maybeSingle();

            if (contractor) {
              contractorId = contractor.id;
              const fullName =
                `${contractor.first_name || ""} ${contractor.last_name || ""}`.trim();
              if (fullName) contractorName = fullName;
            }

            setUser({
              id: contractorId,
              name: contractorName,
              email: data.user.email!,
              role: "contractor",
            });
          }
        }
      }
    } catch (err: any) {
      throw err;
    }
  };

  const impersonate = (targetUser: User) => {
    localStorage.setItem("impersonated_user", JSON.stringify(targetUser));
    setUser(targetUser);
  };

  const stopImpersonating = useCallback(() => {
    try {
      localStorage.removeItem("impersonated_user");
    } catch (e) {}
    window.location.href = "/manager";
  }, []);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem("impersonated_user");
    } catch (e) {}
    try {
      localStorage.removeItem("veydra_role");
    } catch (e) {}

    // Set user to null immediately to trigger UI update
    setUser(null);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      // Force navigation to clear any cached states and reload the app
      window.location.href = "/login";
    }
  }, []);

  useInactivityTimer(user, logout);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        impersonate,
        stopImpersonating,
        isLoading,
      }}
    >
      {isLoading ? <AuthLoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
