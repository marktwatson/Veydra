import { useState, useEffect } from "react";
import {
  Bell,
  Loader2,
  Smartphone,
  CheckCircle2,
  BellOff,
  Info,
  Send,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isCurrentlySubscribed,
} from "@/lib/push";
import {
  getPushPreferences,
  savePushPreferences,
  sendTestPush,
  sendDigestNow,
  type PushPreferences,
} from "@/lib/push-api";

// iOS only allows the permission popup inside an installed PWA (standalone
// mode). In a regular Safari tab it silently returns "denied" with no popup,
// which is the most common reason owners see "connected" but never got a
// prompt. Detect that case so we can guide them.
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // iOS Safari standalone flag
    (navigator as any).standalone === true
  );
}

const CATEGORIES: {
  key: keyof Omit<PushPreferences, "enabled">;
  label: string;
  desc: string;
}[] = [
  {
    key: "bookings_payments",
    label: "Bookings & Payments",
    desc: "New bookings, payments received, failed charges",
  },
  {
    key: "royalty_finance",
    label: "Royalty & Finance",
    desc: "Royalty collected, bank disconnected, charge failed",
  },
  {
    key: "team_operations",
    label: "Team & Operations",
    desc: "New contractor applications, cancellations, questionnaire completed",
  },
  {
    key: "daily_digest",
    label: "Daily Summary Digest",
    desc: "One morning push: revenue, upcoming weddings, action items",
  },
];

export function PushNotificationsCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [supported] = useState(isPushSupported());
  const [permission, setPermission] = useState(getPushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const isOwnerOrAdmin =
    user?.role === "owner" ||
    user?.role === "owner_readonly" ||
    user?.role === "super_admin";

  useEffect(() => {
    if (!user?.id || !isOwnerOrAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [sub, p] = await Promise.all([
          isCurrentlySubscribed(),
          getPushPreferences(user.id).catch(() => null),
        ]);
        setSubscribed(sub);
        setPermission(getPushPermission());
        setPrefs(p);
      } catch (e) {
        console.warn("[Push] init failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, isOwnerOrAdmin]);

  if (!isOwnerOrAdmin) return null;

  const handleEnable = async () => {
    if (!user?.id) return;
    setEnabling(true);
    try {
      await subscribeToPush(user.id, user.email);
      setSubscribed(true);
      setPermission(getPushPermission());
      toast({
        title: "Push notifications enabled",
        description:
          "This device is registered for alerts. Tap Send Test to verify delivery.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not enable push",
        description: e.message || "Permission denied or push not supported.",
      });
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable = async () => {
    setEnabling(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast({
        title: "Push notifications disabled",
        description: "This device will no longer receive alerts.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to disable",
        description: e.message,
      });
    } finally {
      setEnabling(false);
    }
  };

  const handleTest = async () => {
    setSendingTest(true);
    try {
      const res: any = await sendTestPush();
      const detail = res?._detailSummary ? ` [${res._detailSummary}]` : "";
      toast({
        title: "Test sent",
        description:
          res?.sent > 0
            ? `Delivered to ${res.sent} device${res.sent > 1 ? "s" : ""}. Check your phone.${detail}`
            : `Request accepted — check your phone in a moment.${detail}`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Test failed",
        description: e.message || "Could not send test push.",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    try {
      const res: any = await sendDigestNow();
      const body = res?.body || "Digest sent.";
      toast({
        title: "Daily digest sent",
        description: body,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Digest failed",
        description: e.message || "Could not send the daily digest.",
      });
    } finally {
      setSendingDigest(false);
    }
  };

  const toggleCategory = async (key: keyof PushPreferences, value: boolean) => {
    if (!user?.id || !prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSavingPrefs(true);
    try {
      await savePushPreferences(user.id, updated);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to save preference",
        description: e.message,
      });
      setPrefs(prefs); // revert
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>
              Get alerts on your phone when you add this app to your home
              screen.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!supported && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            Push notifications aren't supported in this browser. On iPhone, use
            Safari and add the app to your Home Screen.
          </div>
        )}

        {/* iOS not installed to Home Screen — the permission popup will never
            appear in a regular Safari tab, so guide the owner to install first. */}
        {supported && isIOS() && !isStandalone() && (
          <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Info className="h-4 w-4 shrink-0" />
              Add to Home Screen first
            </div>
            <p>
              On iPhone, the notification permission popup only appears inside
              an installed app. Tap the Safari Share icon, then "Add to Home
              Screen", open the app from your home screen, and come back here to
              enable notifications.
            </p>
          </div>
        )}

        {/* Android — Chrome supports Web Push directly in the browser, so no
            Home Screen install is required. Let owners know they can enable
            right away. */}
        {supported && !isIOS() && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Info className="h-4 w-4 shrink-0" />
              Android users — enable right here
            </div>
            <p>
              On Android (Chrome), you can turn on notifications directly from
              this page without adding the app to your home screen. Just tap
              "Enable on this device" and allow the popup. Adding it to your
              home screen is optional but keeps notifications reliable in the
              background.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status + enable/disable */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {subscribed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {subscribed
                      ? "Enabled on this device"
                      : "Not enabled on this device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permission:{" "}
                    {permission === "granted"
                      ? "Granted"
                      : permission === "denied"
                        ? "Denied"
                        : "Not asked"}
                  </p>
                  {permission === "granted" && !subscribed && (
                    <p className="text-xs text-muted-foreground italic">
                      Permission was already granted, so no popup will appear —
                      just tap "Enable on this device" to register.
                    </p>
                  )}
                  {permission === "denied" && (
                    <p className="text-xs text-muted-foreground italic">
                      Permission was denied. Reset it in your browser/site
                      settings, then try again.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendDigest}
                  disabled={sendingDigest}
                  title="Send the daily digest to all owners & super admins now"
                >
                  {sendingDigest ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Digest Now
                </Button>
                {subscribed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTest}
                      disabled={sendingTest}
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Smartphone className="h-4 w-4 mr-2" />
                      )}
                      Send Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisable}
                      disabled={enabling}
                    >
                      {enabling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Disable"
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleEnable}
                    disabled={enabling || !supported}
                  >
                    {enabling ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Enable on this device
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:text-right -mt-1">
                "Send Digest Now" pushes the report to every owner &amp; super
                admin's phone — it works from any device, not just this one.
              </p>
            </div>

            {/* Category toggles */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Notification Categories
                </Label>
                {savingPrefs && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Choose which alerts you receive.{" "}
                {user?.role === "super_admin"
                  ? "Super admins can toggle every category."
                  : "Owners receive Bookings, Royalty, and the Daily Digest."}
              </p>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.label}</span>
                        {user?.role === "super_admin" &&
                          cat.key === "team_operations" && (
                            <Badge variant="secondary" className="text-[10px]">
                              Admin
                            </Badge>
                          )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cat.desc}
                      </p>
                    </div>
                    <Switch
                      checked={!!prefs?.[cat.key]}
                      onCheckedChange={(v) => toggleCategory(cat.key, v)}
                      disabled={!prefs || savingPrefs}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
