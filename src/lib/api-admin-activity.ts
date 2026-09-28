import { supabase } from "./supabase";

/**
 * Standalone admin-activity logger (mirrors api.logAdminActivity) so the
 * territory-scoped settings/packages module can log without `this` binding.
 */
export async function logAdminActivity(
  action: string,
  details: string,
  isSystem = false,
): Promise<void> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Activity log timeout")),
      10000,
    );
  });

  await Promise.race([
    (async () => {
      try {
        let manager_id: string | null = null;
        let manager_name = "System";

        if (!isSystem) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          manager_id = session?.user?.id ?? null;
          manager_name =
            session?.user?.user_metadata?.full_name || session?.user?.email;

          if (!manager_id) return; // Not logged in

          if (!manager_name) {
            const { data: manager } = await supabase
              .from("managers")
              .select("name")
              .eq("id", manager_id)
              .maybeSingle();
            if (manager) manager_name = manager.name;
          }
        }

        await supabase.from("activity_logs").insert({
          manager_id: manager_id || null,
          manager_name: manager_name || "Unknown",
          action,
          details,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    })(),
    timeoutPromise,
  ]).catch(() => {
    /* best-effort logging */
  });
}
