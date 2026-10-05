import { useState, useEffect } from "react";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MailCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LOGIN_LOGO_URL =
  "https://assets.cdn.filesafe.space/76EKIVBXrGYIny0RbqcE/media/6abaa38a7ef452865a26c67d.gif";

const BOOT_LINES: Record<"manager" | "contractor" | "editor", string[]> = {
  editor: [
    "Loading the editor",
    "Checking your companies",
    "Sorting the edit queue",
    "Opening invoices",
  ],
  manager: [
    "Loading your dashboard",
    "Checking today's weddings",
    "Opening your area",
    "Ready",
  ],
  contractor: [
    "Loading your workspace",
    "Checking open jobs",
    "Matching your area",
    "Opening assignments",
  ],
};

function BootScreen({ lines }: { lines: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setStep((s) => Math.min(s + 1, lines.length - 1));
    }, 1100);
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#120c09] text-amber-50">
      <style>{`
        @keyframes dragon-glide {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
        @keyframes wing-flap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.55); }
        }
        @keyframes flame {
          0%, 100% { opacity: 0.45; transform: scaleX(0.8); }
          50% { opacity: 1; transform: scaleX(1.15); }
        }
        @keyframes ember {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(180,83,9,0.28),transparent_55%)]" />
      <div className="relative mb-8 h-44 w-64" style={{ animation: "dragon-glide 2.4s ease-in-out infinite" }}>
        <svg viewBox="0 0 320 200" className="h-full w-full drop-shadow-[0_12px_24px_rgba(251,146,60,0.35)]" aria-hidden="true">
          <ellipse cx="168" cy="168" rx="70" ry="10" fill="rgba(0,0,0,0.35)" />
          <path d="M40 118 C70 70 110 78 132 96" fill="none" stroke="#fb923c" strokeWidth="8" strokeLinecap="round" />
          <path d="M118 92 C150 40 210 46 236 86 C250 70 286 78 292 108 C270 100 246 112 230 108 C214 132 170 128 146 112 Z" fill="#9a3412" />
          <path d="M150 78 C168 28 214 24 236 62" fill="#c2410c" style={{ transformOrigin: "190px 70px", animation: "wing-flap 0.45s ease-in-out infinite" }} />
          <path d="M146 108 C170 118 188 116 206 104" fill="none" stroke="#fdba74" strokeWidth="3" />
          <circle cx="248" cy="96" r="16" fill="#7c2d12" />
          <circle cx="254" cy="93" r="2.5" fill="#fff7ed" />
          <path d="M262 100 C286 104 304 112 312 118" stroke="#fdba74" strokeWidth="6" strokeLinecap="round" style={{ transformOrigin: "262px 100px", animation: "flame 0.35s ease-in-out infinite" }} />
          <path d="M118 112 C86 126 62 122 46 108" fill="none" stroke="#9a3412" strokeWidth="8" strokeLinecap="round" />
        </svg>
        <span className="absolute left-8 top-16 h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animation: "ember 1.6s ease-out infinite" }} />
        <span className="absolute left-16 top-20 h-1 w-1 rounded-full bg-orange-400" style={{ animation: "ember 1.9s ease-out infinite 0.4s" }} />
      </div>
      <p className="relative text-lg font-medium tracking-wide">{lines[step]}</p>
      <div className="relative mt-6 h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-orange-400 transition-all duration-700" style={{ width: `${((step + 1) / lines.length) * 100}%` }} />
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "contractor" | "manager" | "editor"
  >("contractor");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [showMagicLinkModal, setShowMagicLinkModal] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  // Boot sequence state.
  const [booting, setBooting] = useState(false);
  const [bootDest, setBootDest] = useState("/");
  const [bootLines, setBootLines] = useState(BOOT_LINES.contractor);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || "/";

  // Route the user after the 3s boot screen finishes.
  useEffect(() => {
    if (!booting) return;
    const t = setTimeout(() => {
      navigate(bootDest, { replace: true });
    }, 4500);
    return () => clearTimeout(t);
  }, [booting, bootDest, navigate]);

  const handleLogin = async (
    e: React.FormEvent,
    type: "manager" | "contractor" | "editor",
  ) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email.trim(), password, type);

      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${type}.`,
      });

      const dest =
        type === "editor"
          ? from === "/"
            ? "/editor"
            : from
          : type === "manager" || isSuperAdminEmail(email)
            ? from === "/"
              ? "/manager"
              : from
            : from;

      const lines =
        type === "editor"
          ? BOOT_LINES.editor
          : type === "manager" || isSuperAdminEmail(email)
            ? BOOT_LINES.manager
            : BOOT_LINES.contractor;

      setBootDest(dest);
      setBootLines(lines);
      setBooting(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description:
          error.message || "Please check your credentials and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // NOTE: "Magic Link Logins" must be enabled in Supabase Dashboard -> Authentication -> Providers -> Email for this feature to work.
  const handleMagicLink = async () => {
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address first.",
      });
      return;
    }
    setIsSendingMagicLink(true);
    try {
      const redirectTo = `${window.location.origin}${activeTab === "editor" ? "/editor" : "/"}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMagicLinkEmail(email.trim());
      setEmail("");
      setPassword("");
      setShowMagicLinkModal(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Magic link failed",
        description:
          error.message || "Could not send magic link. Please try again.",
      });
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  if (booting) return <BootScreen lines={bootLines} />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={LOGIN_LOGO_URL}
              alt="Portal Logo"
              className="w-[125px] h-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Portal Login</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="contractor">Contractor</TabsTrigger>
              <TabsTrigger value="manager">Manager</TabsTrigger>
              <TabsTrigger value="editor">Editor</TabsTrigger>
            </TabsList>

            <TabsContent value="contractor">
              <form onSubmit={(e) => handleLogin(e, "contractor")}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-email">Email</Label>
                    <Input
                      id="c-email"
                      type="email"
                      placeholder="contractor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="c-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-xs text-primary hover:underline"
                        tabIndex={-1}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="c-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? "Signing in... (Please wait)"
                      : "Sign in as Contractor"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSendingMagicLink}
                    onClick={handleMagicLink}
                  >
                    {isSendingMagicLink ? "Sending link..." : "Send Magic Link"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="manager">
              <form onSubmit={(e) => handleLogin(e, "manager")}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="m-email">Manager Email</Label>
                    <Input
                      id="m-email"
                      type="email"
                      placeholder="manager@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="m-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-xs text-primary hover:underline"
                        tabIndex={-1}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="m-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? "Signing in... (Please wait)"
                      : "Sign in as Manager"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="editor">
              <form onSubmit={(e) => handleLogin(e, "editor")}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="e-email">Editor Email</Label>
                    <Input
                      id="e-email"
                      type="email"
                      placeholder="editor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="e-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-xs text-primary hover:underline"
                        tabIndex={-1}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="e-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? "Signing in... (Please wait)"
                      : "Sign in as Editor"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSendingMagicLink}
                    onClick={handleMagicLink}
                  >
                    {isSendingMagicLink ? "Sending link..." : "Send Magic Link"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Magic Link Confirmation Modal */}
      <Dialog open={showMagicLinkModal} onOpenChange={setShowMagicLinkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Check Your Email
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-3">
              A secure one-time login link has been sent to{" "}
              <span className="font-semibold text-foreground">
                {magicLinkEmail}
              </span>
              . Click the link in the email to sign in instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground text-center mt-2">
            <p>Don't see it? Check your spam or junk folder.</p>
            <p>The link expires shortly and can only be used once.</p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              className="w-full"
              onClick={() => setShowMagicLinkModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {booting && <BootScreen caption={bootCaption} />}
    </div>
  );
}
