import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { buildAuditScheduleItems } from "@/lib/audit-schedule";
import { getCompanyTimezone } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, ArrowRight, AlertTriangle } from "lucide-react";

const STAFF_ROLES = ["owner", "owner_readonly", "super_admin", "manager"];
const POLL_MS = 60_000; // refresh wedding data every minute

/**
 * Returns the start of "today" in the portal timezone as a Date, so the
 * overdue / due-today boundary matches what the rest of the app considers
 * "today" (instead of the browser's local or UTC day, which can drift).
 */
function portalToday(): Date {
  const tz = getCompanyTimezone();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = +(parts.find((p) => p.type === "year")?.value || 0);
    const m = +(parts.find((p) => p.type === "month")?.value || 1) - 1;
    const d = +(parts.find((p) => p.type === "day")?.value || 1);
    return new Date(y, m, d, 12, 0, 0); // noon avoids any edge DST shift
  } catch {
    const todayStr = new Date().toISOString().split("T")[0];
    return new Date(todayStr + "T12:00:00");
  }
}

/**
 * Modal shown to owners, super admins, and managers when there are overdue or
 * due-today payment installments that need manual processing.
 *
 * Auto-charging is disabled by design — this modal reminds staff to go to the
 * Payment Audit page and push those payments manually.
 *
 * It pops up ONCE per login (when the role transitions from logged-out to a
 * staff role), not on every page refresh. It will not reappear until the user
 * logs out and back in. Role is read from localStorage (maintained by
 * AuthContext) and weddings are fetched directly via supabase, so this can
 * mount via portal from main.tsx without needing the React auth/query-client
 * context. It hides on public/auth pages.
 */
export function PaymentDueAlert() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [pathname, setPathname] = useState<string>(
    typeof window !== "undefined" ? window.location.pathname : "",
  );
  const [weddings, setWeddings] = useState<any[]>([]);

  // Tracks whether we've already shown the modal for the current login.
  // Resets to false when the user logs out (role becomes null), so the next
  // login shows it again.
  const shownForLogin = useRef(false);
  const prevRole = useRef<string | null>(null);

  const readRole = useCallback(() => {
    try {
      const r =
        localStorage.getItem("veydra_effective_role") ||
        localStorage.getItem("veydra_role");
      setRole(r);
    } catch (e) {
      setRole(null);
    }
  }, []);

  const fetchWeddings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("weddings")
        .select(
          "id,client_name,client_email,date,contract_date,created_at,total_amount,paid_amount,payment_plan,custom_payment_plan,notes,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,questionnaire_data,status",
        )
        .neq("status", "draft")
        .order("date", { ascending: true });
      if (error) return;
      setWeddings((data || []) as any[]);
    } catch (e) {
      // silent — alert is non-critical
    }
  }, []);

  useEffect(() => {
    readRole();
    fetchWeddings();

    const onStorage = () => {
      readRole();
    };
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("storage", onStorage);
    window.addEventListener("popstate", onPop);

    // Poll for SPA route changes + refresh role periodically.
    const interval = setInterval(() => {
      if (window.location.pathname !== pathname) {
        setPathname(window.location.pathname);
      }
      readRole();
    }, 2000);
    const dataInterval = setInterval(fetchWeddings, POLL_MS);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("popstate", onPop);
      clearInterval(interval);
      clearInterval(dataInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Re-fetch when role becomes a staff role (user just logged in).
  useEffect(() => {
    if (role && STAFF_ROLES.includes(role)) fetchWeddings();
  }, [role, fetchWeddings]);

  const canSee = role ? STAFF_ROLES.includes(role) : false;

  const { overdue, dueToday, overdueTotal, dueTodayTotal } = useMemo(() => {
    const activeWeddings = weddings.filter(
      (w) => w.status !== "pending" && w.status !== "draft",
    );
    const items = buildAuditScheduleItems(activeWeddings);
    const todayDate = portalToday();

    let overdue = 0;
    let dueToday = 0;
    let overdueTotal = 0;
    let dueTodayTotal = 0;

    items.forEach((it) => {
      if (it.status === "overdue") {
        overdue += 1;
        overdueTotal += Number(it.installmentAmount) || 0;
      } else if (it.status === "pending" && it.parsedDate) {
        const sameDay =
          it.parsedDate.getFullYear() === todayDate.getFullYear() &&
          it.parsedDate.getMonth() === todayDate.getMonth() &&
          it.parsedDate.getDate() === todayDate.getDate();
        if (sameDay) {
          dueToday += 1;
          dueTodayTotal += Number(it.installmentAmount) || 0;
        }
      }
    });

    return { overdue, dueToday, overdueTotal, dueTodayTotal };
  }, [weddings]);

  // Detect login: role transitions from null/non-staff to a staff role.
  // Show the modal once per such transition (if there are due payments).
  useEffect(() => {
    const wasStaff = prevRole.current
      ? STAFF_ROLES.includes(prevRole.current)
      : false;
    const isStaff = role ? STAFF_ROLES.includes(role) : false;

    if (isStaff && !wasStaff) {
      // Fresh login — reset the shown flag so the modal can appear,
      // unless we just navigated here from the alert's "Go to Payment
      // Audit" button (full reload resets the ref; sessionStorage survives).
      const justNavigated =
        sessionStorage.getItem("veydra_payment_alert_nav") === "1";
      if (justNavigated) {
        sessionStorage.removeItem("veydra_payment_alert_nav");
        shownForLogin.current = true;
      } else {
        shownForLogin.current = false;
      }
    }
    if (!isStaff && wasStaff) {
      // Logged out — reset so next login shows again.
      shownForLogin.current = false;
    }

    prevRole.current = role;

    const total = overdue + dueToday;
    if (isStaff && !shownForLogin.current && total > 0) {
      shownForLogin.current = true;
      setOpen(true);
    }
  }, [role, overdue, dueToday]);

  const isPublicPage =
    pathname === "/login" ||
    pathname === "/book" ||
    pathname === "/apply" ||
    pathname.startsWith("/bride-portal") ||
    pathname.startsWith("/proposal") ||
    pathname.startsWith("/payment-plan") ||
    pathname.startsWith("/gift") ||
    pathname.startsWith("/feedback") ||
    pathname.startsWith("/setup-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (isPublicPage) return null;

  const total = overdue + dueToday;
  if (total === 0) return null;

  const go = () => {
    setOpen(false);
    sessionStorage.setItem("veydra_payment_alert_nav", "1");
    window.location.href = "/manager/payments?date=today";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-left text-xl">
                Payments Need Your Attention
              </DialogTitle>
              <DialogDescription className="text-left">
                Manual processing required before continuing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {overdue > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {overdue} overdue payment{overdue === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Past their due date — process now.
                </p>
              </div>
              <p className="text-lg font-bold">
                $
                {overdueTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
          {dueToday > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{dueToday} due today</p>
                <p className="text-xs text-muted-foreground">
                  Ready to process today.
                </p>
              </div>
              <p className="text-lg font-bold">
                $
                {dueTodayTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Auto-charging is disabled. Go to Payment Audit to push these
            payments manually.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
          <Button onClick={go} className="gap-2">
            <DollarSign className="h-4 w-4" />
            Go to Payment Audit
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
