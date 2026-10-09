import {
  Briefcase,
  Calendar,
  Home,
  User,
  LayoutDashboard,
  Inbox,
  Users,
  PlusSquare,
  Webhook,
  Shield,
  MessageSquare,
  Menu,
  ChevronDown,
  DollarSign,
  Receipt,
  Video,
  Megaphone,
  Target,
  TrendingUp,
  CreditCard,
  Globe,
} from "lucide-react";
import {
  buildFlatNavItems,
  buildVisibleManagerNavGroups,
} from "@/lib/flat-nav-items";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  cn,
  playNotificationSound,
  DEFAULT_LOGO_URL,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getContractorByEmail } from "@/lib/contractor-by-email";
import { fetchOpenJobsForTerritory } from "@/lib/api-territory-scoped";
import { contractorCanSeeJob } from "@/lib/contractor-job-visibility";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LayoutHeader } from "@/components/LayoutHeader";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

import {
  contractorNavItems,
  editorNavItems,
  managerNavGroups,
  royaltyNavItem,
  stripePayoutNavItem,
  ownerRoyaltyNavItem,
} from "@/components/layout-nav";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, stopImpersonating } = useAuth();
  const queryClient = useQueryClient();
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem("veydra_logo_url") || DEFAULT_LOGO_URL;
    } catch (e) {
      return DEFAULT_LOGO_URL;
    }
  });
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    // Kick the scheduler worker as a backup (idempotent via dedupe_key) so
    // offset notifications still send even if the 10-min cron is down.
    // runDailyHeartbeat stays as a secondary backup but no longer is the
    // primary notification engine.
    api.runSchedulerBackup().catch(() => {});
    api.runDailyHeartbeat().catch(console.error);
  }, []);

  useEffect(() => {
    const loadLogo = () => {
      try {
        const localLogo = localStorage.getItem("veydra_logo_url");
        if (localLogo) setLogoUrl(localLogo);
      } catch (e) {}

      api
        .getPortalSettings()
        .then((settings) => {
          const logo = settings?.logo_url || DEFAULT_LOGO_URL;
          setLogoUrl(logo);
          try {
            localStorage.setItem("veydra_logo_url", logo);
            if (settings?.timezone) {
              localStorage.setItem("veydra_timezone", settings.timezone);
            }
          } catch (e) {}
          // Apply configured app icon (favicon + apple-touch-icon + manifest)
          if (settings?.app_icon_url) {
            import("@/components/AppIconUploader")
              .then(({ applyAppIcon }) => applyAppIcon(settings.app_icon_url))
              .catch(() => {});
          }
        })
        .catch((err) => console.error("Error fetching logo:", err));
    };

    loadLogo();

    window.addEventListener("logo-updated", loadLogo);
    return () => window.removeEventListener("logo-updated", loadLogo);
  }, []);

  const { data: profile } = useQuery<{
    avatar_url: string | null;
    training_completed?: boolean;
    status?: string;
    isProfileIncomplete?: boolean;
    specialty?: string | null;
  }>({
    queryKey: [
      user?.role === "manager" || user?.role === "super_admin"
        ? "manager-avatar"
        : "contractor-avatar",
      user?.email,
    ],
    queryFn: async () => {
      if (!user?.email) return { avatar_url: null };
      if (user.id === "m1") {
        return { avatar_url: localStorage.getItem("m1_avatar") };
      }

      if (user.role === "manager" || user.role === "super_admin") {
        const { data } = await supabase
          .from("managers")
          .select("avatar_url, status")
          .ilike("email", user.email)
          .limit(1);
        let avatar_url = data?.[0]?.avatar_url;
        let status = data?.[0]?.status;

        if (!avatar_url) {
          const { data: cData } = await supabase
            .from("contractors")
            .select("avatar_url")
            .ilike("email", user.email)
            .limit(1);
          if (cData?.[0]?.avatar_url) {
            avatar_url = cData[0].avatar_url;
          }
        }
        return {
          avatar_url: avatar_url || null,
          training_completed: true,
          status,
        };
      }

      if (user.role === "editor") {
        const { data } = await supabase
          .from("editors")
          .select("avatar_url, status")
          .ilike("email", user.email)
          .limit(1);
        let avatar_url = data?.[0]?.avatar_url;
        let status = data?.[0]?.status;

        if (!avatar_url) {
          const { data: mData } = await supabase
            .from("managers")
            .select("avatar_url")
            .ilike("email", user.email)
            .limit(1);
          if (mData?.[0]?.avatar_url) {
            avatar_url = mData[0].avatar_url;
          }
        }
        return {
          avatar_url: avatar_url || null,
          training_completed: true,
          status,
          isProfileIncomplete: false,
        };
      }

      const { data } = await supabase
        .from("contractors")
        .select(
          "avatar_url, training_completed, status, bio, venmo_handle, portfolio_url, specialty",
        )
        .ilike("email", user.email)
        .limit(1);
      let record = data?.[0];
      if (!record && user.id) {
        const { data: byId } = await supabase
          .from("contractors")
          .select(
            "avatar_url, training_completed, status, bio, venmo_handle, portfolio_url, specialty",
          )
          .eq("id", user.id)
          .maybeSingle();
        record = byId || undefined;
      }

      const isBartender = /bartender/i.test(record?.specialty || "");
      const isProfileIncomplete = record
        ? isBartender
          ? !record.avatar_url
          : !record.avatar_url || !record.bio || !record.portfolio_url
        : false;

      return {
        avatar_url: record?.avatar_url || null,
        training_completed:
          (record?.training_completed ?? false) || isBartender,
        status: record?.status,
        isProfileIncomplete,
        specialty: record?.specialty || null,
      };
    },
    enabled: !!user,
  });

  useEffect(() => {
    const isApplicant =
      user?.role === "contractor" &&
      profile?.status &&
      [
        "applied",
        "interview",
        "paperwork",
        "rejected",
        "declined",
        "not_selected",
      ].includes(profile.status.toLowerCase());
    const isTerminated =
      user?.role === "contractor" && profile?.status === "terminated";

    if (isTerminated) {
      if (
        location.pathname !== "/invoices" &&
        location.pathname !== "/profile"
      ) {
        navigate("/invoices", { replace: true });
      }
    } else if (
      user?.role === "contractor" &&
      profile &&
      profile.training_completed === false &&
      location.pathname !== "/training" &&
      !isApplicant
    ) {
      navigate("/training", { replace: true });
    }
  }, [user, profile, location.pathname, navigate]);

  const isImpersonating = !!localStorage.getItem("impersonated_user");

  const { data: availableJobsCount = 0 } = useQuery({
    queryKey: ["availableJobsCount", user?.id],
    queryFn: async () => {
      if (!user || user.role !== "contractor") return 0;

      const currentUser = await getContractorByEmail(user.email || "");
      if (!currentUser?.territory_id) return 0;

      const [jobs, applications, assignments] = await Promise.all([
        fetchOpenJobsForTerritory(currentUser.territory_id),
        api.getApplications(),
        api.getAssignments(),
      ]);

      const myActiveAssignments = assignments.filter(
        (a: any) =>
          a.contractor_id === currentUser.id &&
          [
            "upcoming",
            "accepted",
            "confirmed",
            "assigned",
            "action required",
          ].includes(
            String(a.status || "")
              .trim()
              .toLowerCase(),
          ),
      );

      const myBookedDates = new Set(
        myActiveAssignments
          .map((a: any) => a.jobs?.weddings?.date)
          .filter(Boolean),
      );

      const visiblePositions = jobs.filter((p) =>
        contractorCanSeeJob(p, currentUser, {
          filterRegion: false,
          bookedDates: myBookedDates,
        }),
      );

      const myApplications = applications.filter(
        (a) => a.contractor_id === currentUser.id,
      );

      const openJobs = visiblePositions.filter(
        (p) => !myApplications.some((a) => a.job_id === p.id),
      );

      return openJobs.length;
    },
    enabled: !!user && user.role === "contractor",
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [
      "unreadMessages",
      user?.role === "manager" || user?.role === "super_admin"
        ? "manager"
        : user?.id,
    ],
    queryFn: async () => {
      if (!user) return 0;
      const receiverId =
        user.role === "manager" || user.role === "super_admin"
          ? "manager"
          : user.id;
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", receiverId)
        .eq("read", false);
      if (error && error.code !== "42P01") {
        console.warn("Error fetching unread count:", error);
      }
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: unreadNotificationsCount = 0 } = useQuery({
    queryKey: ["unreadNotifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("contractor_id", user.id)
        .eq("read", false);
      if (error && error.code !== "42P01") {
        console.warn("Error fetching unread notifications count:", error);
      }
      return count || 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const receiverId =
      user.role === "manager" || user.role === "super_admin"
        ? "manager"
        : user.id;

    const channel = supabase
      .channel("realtime:unread_messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${receiverId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound();
          }
          queryClient.invalidateQueries({
            queryKey: ["unreadMessages", receiverId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!user || user.role !== "contractor") return;

    const setupNotifications = async () => {
      // We no longer auto-request permissions on mount as it is blocked on mobile.
      // Users must explicitly enable notifications via the Dashboard banner or Settings.
      if (
        "serviceWorker" in navigator &&
        Notification.permission === "granted"
      ) {
        try {
          await navigator.serviceWorker.register("/sw.js");
        } catch (e) {
          console.error("Service worker registration failed:", e);
        }
      }
    };

    setupNotifications();

    const channel = supabase
      .channel("realtime:notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `contractor_id=eq.${user.id}`,
        },
        (payload) => {
          playNotificationSound();
          const newNotif = payload.new as any;
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(newNotif.title, {
              body: newNotif.message,
              icon: logoUrl || "/favicon.svg",
            });
          }
          toast(newNotif.title, {
            description: newNotif.message,
          });
          queryClient.invalidateQueries({
            queryKey: ["unreadNotifications", user.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, logoUrl]);

  useEffect(() => {
    if (!user || user.role !== "contractor") return;

    const channel = supabase
      .channel("realtime:new_jobs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "jobs",
          filter: "status=eq.open",
        },
        (payload) => {
          playNotificationSound();
          toast("New Position Available!", {
            description:
              "A new job has been posted that might match your region and specialty.",
          });
          queryClient.invalidateQueries({
            queryKey: ["availableJobsCount", user.id],
          });
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!user || (user.role !== "manager" && user.role !== "super_admin"))
      return;

    const channel = supabase
      .channel("realtime:manager_weddings")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "weddings",
        },
        (payload) => {
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;

          if (
            oldRecord.editing_status !== "ready_to_edit" &&
            newRecord.editing_status === "ready_to_edit"
          ) {
            playNotificationSound();
            toast("Raw Media Uploaded", {
              description: `Raw media for ${newRecord.client_name} is ready to edit!`,
            });
          } else if (
            oldRecord.editing_status !== "client_review" &&
            newRecord.editing_status === "client_review"
          ) {
            playNotificationSound();
            toast("Ready for Review", {
              description: `The edit for ${newRecord.client_name} is now in client review.`,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const role = (user?.role as string) || "contractor";
  const isManagerOrAdmin = [
    "super_admin",
    "owner",
    "owner_readonly",
    "manager",
  ].includes(role);
  const isApplicant =
    role === "contractor" &&
    profile?.status &&
    [
      "applied",
      "interview",
      "paperwork",
      "rejected",
      "declined",
      "not_selected",
    ].includes(profile.status.toLowerCase());
  const isTerminated =
    role === "contractor" && profile?.status === "terminated";

  const visibleManagerNavGroups = buildVisibleManagerNavGroups(
    role,
    user?.email,
  );

  // Owners use the same filtered manager nav groups (with their royalty dashboard appended)
  const effectiveNavGroups = visibleManagerNavGroups;

  const flatNavItems = buildFlatNavItems({
    isManagerOrAdmin,
    role,
    isTerminated,
    isApplicant,
    trainingCompleted: profile?.training_completed,
    effectiveNavGroups,
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <SidebarProvider>
      {/* Desktop Sidebar */}
      {role !== "editor" && (
        <Sidebar collapsible="icon" className="hidden md:flex">
          <SidebarHeader className="py-4">
            <div className="flex items-center px-2">
              <img
                src={logoUrl}
                alt="Portal Logo"
                className="h-8 object-contain transition-all group-data-[collapsible=icon]:hidden"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
                }}
              />
              <div className="hidden h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold group-data-[collapsible=icon]:flex">
                V
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {isManagerOrAdmin ? (
              effectiveNavGroups.map((group) => (
                <Collapsible
                  key={group.label}
                  defaultOpen
                  className="group/collapsible"
                >
                  <SidebarGroup>
                    <SidebarGroupLabel asChild>
                      <CollapsibleTrigger>
                        {group.label}
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const isActive =
                            location.pathname === item.path ||
                            (item.path !== "/manager" &&
                              location.pathname.startsWith(item.path));
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={item.label}
                              >
                                <Link to={item.path}>
                                  <item.icon />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                              {item.label === "Messages" && unreadCount > 0 && (
                                <SidebarMenuBadge className="bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-1.5 min-w-5 flex items-center justify-center">
                                  {unreadCount}
                                </SidebarMenuBadge>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ))
            ) : (
              <SidebarGroup>
                <SidebarMenu>
                  {flatNavItems.map((item) => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== "/" &&
                        item.path !== "/editor" &&
                        location.pathname.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.label === "Messages" && unreadCount > 0 && (
                          <SidebarMenuBadge className="bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-1.5 min-w-5 flex items-center justify-center">
                            {unreadCount}
                          </SidebarMenuBadge>
                        )}
                        {item.label === "Jobs" && availableJobsCount > 0 && (
                          <SidebarMenuBadge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 rounded-full px-1.5 min-w-5 flex items-center justify-center">
                            {availableJobsCount}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </SidebarContent>
        </Sidebar>
      )}

      <SidebarInset className="flex flex-col flex-1 min-w-0 bg-muted/30">
        {/* Header */}
        <LayoutHeader
          role={role}
          isManagerOrAdmin={isManagerOrAdmin}
          isImpersonating={isImpersonating}
          logoUrl={logoUrl}
          avatarUrl={profile?.avatar_url}
          unreadNotificationsCount={unreadNotificationsCount}
          stopImpersonating={stopImpersonating}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 flex flex-col">
          {isTerminated && (
            <div className="bg-destructive text-destructive-foreground px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
              <Shield className="h-4 w-4" />
              Account Terminated: Your access to the platform has been revoked
              due to a contract violation. You may only view past invoices and
              payouts.
            </div>
          )}
          <div className="container max-w-6xl mx-auto p-4 md:p-8 flex-1 flex flex-col">
            {children}
          </div>
        </div>
      </SidebarInset>

      {/* Mobile Bottom Nav */}
      {user?.role !== "editor" && (
        <MobileTabBar
          items={flatNavItems}
          groups={isManagerOrAdmin ? effectiveNavGroups : []}
          pathname={location.pathname}
          unreadCount={unreadCount}
          availableJobsCount={availableJobsCount}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
        />
      )}
    </SidebarProvider>
  );
}

const PHONE_PRIMARY = [
  "/manager",
  "/manager/weddings",
  "/manager/proposals",
  "/manager/messages",
];

function pathActive(pathname: string, path: string) {
  return (
    pathname === path ||
    (path !== "/" && path !== "/editor" && pathname.startsWith(path))
  );
}

function MobileTabBar({
  items,
  groups,
  pathname,
  unreadCount,
  availableJobsCount,
  moreOpen,
  setMoreOpen,
}: {
  items: { icon: any; label: string; path: string }[];
  groups: { label: string; items: { icon: any; label: string; path: string }[] }[];
  pathname: string;
  unreadCount: number;
  availableJobsCount: number;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}) {
  const useMore = items.length > 5;
  const picked = PHONE_PRIMARY.map((path) =>
    items.find((item) => item.path === path),
  ).filter(Boolean) as { icon: any; label: string; path: string }[];
  const bar = useMore ? picked : items;
  const moreHasActive =
    useMore && items.some((item) => pathActive(pathname, item.path) && !bar.some((b) => b.path === item.path));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-border/40 bg-background/95 px-1 pb-safe backdrop-blur-xl md:hidden">
        {bar.map((item) => (
          <TabLink
            key={item.path}
            item={item}
            active={pathActive(pathname, item.path)}
            unreadCount={unreadCount}
            availableJobsCount={availableJobsCount}
          />
        ))}
        {useMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium",
              moreOpen || moreHasActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        )}
      </nav>
      {useMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl pb-8">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm",
                          pathActive(pathname, item.path)
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function TabLink({
  item,
  active,
  unreadCount,
  availableJobsCount,
}: {
  item: { icon: any; label: string; path: string };
  active: boolean;
  unreadCount: number;
  availableJobsCount: number;
}) {
  return (
    <Link
      to={item.path}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        <item.icon className="h-5 w-5" />
        {item.label === "Messages" && unreadCount > 0 && (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-destructive text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
        {item.label === "Jobs" && availableJobsCount > 0 && (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-emerald-500 text-[10px] font-bold text-white">
            {availableJobsCount}
          </span>
        )}
      </span>
      <span className="w-full truncate text-center">{item.label}</span>
    </Link>
  );
}
