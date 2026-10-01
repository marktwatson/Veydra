import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Download,
  History,
  LogOut,
  Settings,
  Smartphone,
  Share,
  PlusSquare as PlusSquareIcon,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderClock } from "@/components/HeaderClock";
import { SuperAdminAreaSwitcher } from "@/components/SuperAdminAreaSwitcher";
import { cn, DEFAULT_LOGO_URL } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { CHANGELOG_DATA } from "@/pages/manager/Changelog";

interface LayoutHeaderProps {
  role: string;
  isManagerOrAdmin: boolean;
  isImpersonating: boolean;
  logoUrl: string;
  avatarUrl?: string | null;
  unreadNotificationsCount: number;
  stopImpersonating: () => void;
  onLogout: () => void;
}

/**
 * App header extracted from Layout.tsx so the super-admin area switcher can be
 * rendered directly in the JSX (reliable) instead of injected via a portal +
 * MutationObserver (which dropped the switcher on route changes).
 */
export function LayoutHeader({
  role,
  isManagerOrAdmin,
  isImpersonating,
  logoUrl,
  avatarUrl,
  unreadNotificationsCount,
  stopImpersonating,
  onLogout,
}: LayoutHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
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

  return (
    <>
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
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
            }}
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
          {role === "super_admin" && <SuperAdminAreaSwitcher />}
          {role === "super_admin" && <HeaderClock />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" asChild>
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
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
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
                onSelect={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
    </>
  );
}
