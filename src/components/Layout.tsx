import {
  Briefcase,
  Calendar,
  Home,
  Bell,
  User,
  LayoutDashboard,
  Inbox,
  Users,
  Settings,
  PlusSquare,
  Webhook,
  Shield,
  MessageSquare,
  Activity,
  ChevronDown,
  LogOut,
  History,
  DollarSign,
  Receipt,
  Download,
  Video,
  Megaphone,
  Target,
  Smartphone,
  Share,
  PlusSquare as PlusSquareIcon,
  BookOpen,
  TrendingUp,
  CreditCard,
  Globe,
  Crown,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CHANGELOG_DATA } from "@/pages/manager/Changelog";
import {
  cn,
  playNotificationSound,
  parseRegions,
  DEFAULT_LOGO_URL,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

const contractorNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/opportunities" },
  { icon: Calendar, label: "Assignments", path: "/assignments" },
  { icon: Receipt, label: "Invoices", path: "/invoices" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
];

const editorNavItems = [
  { icon: LayoutDashboard, label: "Portal", path: "/editor" },
  { icon: Receipt, label: "Invoices", path: "/editor/invoices" },
];

const managerNavGroups = [
  {
    label: "Operations",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/manager" },
      { icon: Inbox, label: "Weddings", path: "/manager/weddings" },
      { icon: PlusSquare, label: "Proposals", path: "/manager/proposals" },
      { icon: Briefcase, label: "Applications", path: "/manager/applications" },
      { icon: Calendar, label: "Assignments", path: "/manager/assignments" },
      {
        icon: Activity,
        label: "Post-Production",
        path: "/manager/post-production",
      },
    ],
  },
  {
    label: "Intel & Growth",
    items: [
      { icon: TrendingUp, label: "Intelligence Hub", path: "/manager/growth" },
    ],
  },
  {
    label: "Financial Center",
    items: [
      { icon: DollarSign, label: "P&L Ledger", path: "/manager/accounting" },
      { icon: CreditCard, label: "Payment Audit", path: "/manager/payments" },
      { icon: DollarSign, label: "Payouts", path: "/manager/payouts" },
      { icon: Receipt, label: "Tax Reporting", path: "/manager/taxes" },
    ],
  },
  {
    label: "Team & Communication",
    items: [
      { icon: Users, label: "Contractors", path: "/manager/contractors" },
      { icon: Shield, label: "Team Management", path: "/manager/team" },
      { icon: MessageSquare, label: "Messages", path: "/manager/messages" },
    ],
  },
  {
    label: "System Control",
    items: [
      { icon: Settings, label: "Settings", path: "/manager/settings" },
      { icon: Activity, label: "Activity Log", path: "/manager/activity" },
      { icon: Globe, label: "Territory Fleet", path: "/manager/territories" },
    ],
  },
];

// Royalty nav item — only visible to super_admin
const royaltyNavItem = {
  icon: Crown,
  label: "Royalty & Payback",
  path: "/manager/royalty",
};

// Owner-specific nav item for their royalty dashboard
const ownerRoyaltyNavItem = {
  icon: Crown,
  label: "Royalty Dashboard",
  path: "/owner/royalty",
};

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
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Run daily heartbeat for automations
    api.runDailyHeartbeat().catch(console.error);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
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
          "avatar_url, training_completed, status, bio, venmo_handle, portfolio_url",
        )
        .ilike("email", user.email)
        .limit(1);
      const record = data?.[0];

      const isProfileIncomplete =
        record && (!record.avatar_url || !record.bio || !record.portfolio_url);

      return {
        avatar_url: record?.avatar_url || null,
        training_completed: record?.training_completed ?? false,
        status: record?.status,
        isProfileIncomplete,
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
    } else if (
      user?.role === "contractor" &&
      profile &&
      profile.training_completed !== false &&
      profile.isProfileIncomplete &&
      location.pathname !== "/" &&
      !isApplicant
    ) {
      navigate("/", { replace: true });
    }
  }, [user, profile, location.pathname, navigate]);

  const isImpersonating = !!localStorage.getItem("impersonated_user");

  const { data: availableJobsCount = 0 } = useQuery({
    queryKey: ["availableJobsCount", user?.id],
    queryFn: async () => {
      if (!user || user.role !== "contractor") return 0;

      const [jobs, applications, assignments, contractors] = await Promise.all([
        api.getJobs(),
        api.getApplications(),
        api.getAssignments(),
        api.getContractors(),
      ]);

      const currentUser = contractors.find(
        (c) =>
          c.email?.trim().toLowerCase() === user.email?.trim().toLowerCase(),
      );
      if (!currentUser) return 0;

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

      const visiblePositions = jobs.filter((p) => {
        if (p.status !== "open") return false;
        if (myBookedDates.has(p.weddings?.date)) return false;

        const isPhotoOnly =
          p.role?.toLowerCase().includes("photo") &&
          !p.role?.toLowerCase().includes("video");
        const requiresDrone =
          (p.drone_required === true || p.drone_required === "true") &&
          !isPhotoOnly;

        if (requiresDrone && !currentUser.drone_approved) return false;

        if (currentUser.specialty) {
          const specialty = (currentUser.specialty || "").toLowerCase();
          const role = (p.role || "").toLowerCase();
          if (!specialty.includes("both") && !specialty.includes("&")) {
            if (specialty.includes("video") && !role.includes("video"))
              return false;
            if (specialty.includes("photo") && !role.includes("photo"))
              return false;
            if (specialty.includes("content") && !role.includes("content"))
              return false;
          }
        }

        if (currentUser.region) {
          const regions = parseRegions(currentUser.region);
          if (regions.length > 0) {
            const isAllRegions = regions.some(
              (r: string) => r.toLowerCase() === "all regions",
            );
            if (!isAllRegions) {
              const jobLocation = (p.weddings?.location || "").toLowerCase();
              const weddingRegions = parseRegions(p.weddings?.region);

              let matchesRegion = false;
              if (weddingRegions.length > 0) {
                matchesRegion = regions.some((r) =>
                  weddingRegions.some(
                    (wr) => wr.toLowerCase() === r.toLowerCase(),
                  ),
                );
              } else {
                matchesRegion = regions.some((r) =>
                  jobLocation.includes(r.toLowerCase()),
                );
              }
              if (!matchesRegion) return false;
            }
          }
        }
        return true;
      });

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

  const [hasNewChangelog, setHasNewChangelog] = useState(false);

  useEffect(() => {
    const checkChangelog = () => {
      const lastSeen = localStorage.getItem("last_seen_changelog");
      setHasNewChangelog(lastSeen !== CHANGELOG_DATA[0].version);
    };
    checkChangelog();
    window.addEventListener("changelog-read", checkChangelog);
    return () => window.removeEventListener("changelog-read", checkChangelog);
  }, []);

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

  const visibleManagerNavGroups = managerNavGroups
    .map((group) => {
      if (role === "manager") {
        if (group.label === "Intel & Growth") return null;
        const filteredItems = group.items.filter(
          (item) =>
            item.path !== "/manager/team" &&
            item.path !== "/manager/accounting" &&
            item.path !== "/manager/team" &&
            item.path !== "/manager/accounting" &&
            item.path !== "/manager/growth" &&
            item.path !== "/manager/leads" &&
            item.path !== "/manager/ad-campaigns" &&
            item.path !== "/manager/territories",
        );
        if (filteredItems.length === 0) return null;
        return {
          ...group,
          items: filteredItems,
        };
      }
      // Add royalty nav for super_admin only
      if (role === "super_admin" && group.label === "System Control") {
        return {
          ...group,
          items: [...group.items, royaltyNavItem],
        };
      }
      // For owners (and owner_readonly): show full manager nav (minus territory fleet + royalty management)
      // plus their own royalty dashboard at the end.
      // NOTE: owner_readonly CAN see Intelligence Hub — only managers are restricted.
      if (role === "owner" || role === "owner_readonly") {
        const filteredItems = group.items.filter(
          (item) => item.path !== "/manager/territories",
        );
        if (filteredItems.length === 0) return null;
        // Append owner's royalty dashboard to the System Control group
        if (group.label === "System Control") {
          return {
            ...group,
            items: [...filteredItems, ownerRoyaltyNavItem],
          };
        }
        return { ...group, items: filteredItems };
      }
      return group;
    })
    .filter(Boolean) as typeof managerNavGroups;

  // Owners use the same filtered manager nav groups (with their royalty dashboard appended)
  const effectiveNavGroups = visibleManagerNavGroups;

  const flatNavItems = isManagerOrAdmin
    ? effectiveNavGroups.flatMap((g) => g.items)
    : role === "editor"
      ? editorNavItems
      : isTerminated
        ? [{ icon: Receipt, label: "Invoices", path: "/invoices" }]
        : isApplicant
          ? [{ icon: Home, label: "Candidate Portal", path: "/" }]
          : profile?.training_completed === false
            ? [{ icon: BookOpen, label: "Training Academy", path: "/training" }]
            : profile?.isProfileIncomplete
              ? [{ icon: User, label: "Complete Profile", path: "/" }]
              : contractorNavItems;

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
        {isImpersonating && (
          <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-4 z-50">
            <span>
              You are currently impersonating {user?.name} ({user?.role})
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 bg-white/10 border-white/20 hover:bg-white/20 text-white"
              onClick={stopImpersonating}
            >
              Stop Impersonating
            </Button>
          </div>
        )}
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-xl px-4">
          <div className="flex items-center gap-2">
            {role !== "editor" && (
              <SidebarTrigger className="-ml-2 hidden md:flex" />
            )}
            <img
              src={logoUrl}
              alt="Portal Logo"
              className={cn(
                "h-6 object-contain",
                role !== "editor" && "md:hidden",
              )}
            />
            {role === "editor" && (
              <nav className="flex items-center gap-4 ml-2 sm:ml-6">
                <Link
                  to="/editor"
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    location.pathname === "/editor"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  to="/editor/invoices"
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    location.pathname === "/editor/invoices"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  Invoices
                </Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  asChild
                >
                  <Link to="/notifications">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-sm border-2 border-background">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>

            {isManagerOrAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    asChild
                  >
                    <Link to="/manager/changelog">
                      <History className="h-5 w-5 text-muted-foreground" />
                      {hasNewChangelog && (
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-destructive"></span>
                      )}
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Changelog</TooltipContent>
              </Tooltip>
            )}

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-muted overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all ml-1"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to={isManagerOrAdmin ? "/manager/profile" : "/profile"}
                    className="cursor-pointer w-full"
                  >
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                {isManagerOrAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/manager/settings"
                        className="cursor-pointer w-full"
                      >
                        <Settings className="mr-2 h-4 w-4" /> Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/manager/export"
                        className="cursor-pointer w-full"
                      >
                        <Download className="mr-2 h-4 w-4" /> Export Source
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/manager/activity"
                        className="cursor-pointer w-full"
                      >
                        <Activity className="mr-2 h-4 w-4" /> Activity Log
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {role === "contractor" && (
                  <DropdownMenuItem
                    onClick={() => setIsInstallModalOpen(true)}
                    className="cursor-pointer"
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    Install App
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

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

      <Dialog open={isInstallModalOpen} onOpenChange={setIsInstallModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install the App</DialogTitle>
            <DialogDescription>
              Add the Veydra Contractor Portal to your home screen for quick
              access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {deferredPrompt ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Smartphone className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Install the app directly to your device for the best
                  experience.
                </p>
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (deferredPrompt) {
                      deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === "accepted") {
                        setDeferredPrompt(null);
                        setIsInstallModalOpen(false);
                      }
                    }
                  }}
                >
                  Install Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    iOS (Safari)
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Tap the <Share className="inline h-4 w-4 mx-1" />{" "}
                      <strong>Share</strong> button at the bottom of Safari
                    </li>
                    <li>
                      Scroll down and tap <strong>"Add to Home Screen"</strong>{" "}
                      <PlusSquareIcon className="inline h-4 w-4 mx-1" />
                    </li>
                    <li>
                      Tap <strong>"Add"</strong> in the top right
                    </li>
                  </ol>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    Android (Chrome)
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>
                      Tap the <strong>Menu</strong> (3 dots) in the top right
                    </li>
                    <li>
                      Tap <strong>"Add to Home screen"</strong>
                    </li>
                    <li>
                      Tap <strong>"Add"</strong> to confirm
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Nav */}
      {user?.role !== "editor" && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/40 bg-background/80 backdrop-blur-xl px-2 md:hidden overflow-x-auto no-scrollbar pb-safe">
          {flatNavItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" &&
                item.path !== "/editor" &&
                location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 p-2 text-[10px] font-medium transition-all duration-300 min-w-[64px] rounded-full mx-1",
                  isActive
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.label === "Messages" && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white shadow-sm border-2 border-background">
                      {unreadCount}
                    </span>
                  )}
                  {item.label === "Jobs" && availableJobsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm border-2 border-background">
                      {availableJobsCount}
                    </span>
                  )}
                </div>
                <span className="truncate w-full text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </SidebarProvider>
  );
}
