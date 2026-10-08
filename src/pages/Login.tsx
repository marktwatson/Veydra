import { useState, useEffect, useRef } from "react";
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
  const [mark, setMark] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setStep((s) => Math.min(s + 1, lines.length - 1));
    }, 1100);
    return () => clearInterval(t);
  }, [lines.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = LOGIN_LOGO_URL;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (g > 120 && g > r + 30 && g > b + 30) {
          d[i + 3] = 0;
        } else if (d[i + 3] > 0) {
          d[i] = 230;
          d[i + 1] = 196;
          d[i + 2] = 138;
        }
      }
      ctx.putImageData(frame, 0, 0);
      setMark(canvas.toDataURL("image/png"));
    };
  }, []);

  const embers = [8, 22, 38, 54, 70, 84];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#0c0907] text-[#e6c48a]">
      <style>{`
        @keyframes dragon-in {
          from { opacity: 0; transform: scale(0.94); filter: blur(6px); }
          to { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes dragon-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes gold-sheen {
          0% { transform: translateX(-60%); opacity: 0; }
          30% { opacity: 0.85; }
          100% { transform: translateX(60%); opacity: 0; }
        }
        @keyframes ember-rise {
          0% { transform: translateY(12px); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translateY(-90px); opacity: 0; }
        }
        @keyframes line-in {
          from { opacity: 0; letter-spacing: 0.55em; }
          to { opacity: 1; letter-spacing: 0.32em; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 0.7; transform: scale(1); }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,154,92,0.18),transparent_58%)]" />
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <div className="relative flex w-full max-w-sm flex-col items-center px-6">
        <div className="relative h-64 w-64">
          <div
            className="absolute inset-6 rounded-full bg-[#c99a5c]/30 blur-3xl"
            style={{ animation: "glow-pulse 3.6s ease-in-out infinite" }}
          />
          {mark && (
            <div style={{ animation: "dragon-breathe 4.8s ease-in-out infinite" }}>
              <img
                src={mark}
                alt=""
                className="relative h-64 w-64 object-contain"
                style={{ animation: "dragon-in 900ms ease-out both" }}
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(100deg, transparent 35%, rgba(255,244,220,0.95) 50%, transparent 65%)",
                  WebkitMaskImage: `url(${mark})`,
                  maskImage: `url(${mark})`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  animation: "gold-sheen 2.8s ease-in-out infinite",
                }}
              />
            </div>
          )}
          {embers.map((left, i) => (
            <span
              key={left}
              className="absolute bottom-6 h-1 w-1 rounded-full bg-[#f3e2c0]"
              style={{
                left: `${left}%`,
                animation: `ember-rise ${2.4 + (i % 3) * 0.4}s ease-in ${i * 0.35}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="relative mt-8 h-px w-52 overflow-hidden bg-[#c99a5c]/25">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8a6233] via-[#f6e7c1] to-[#e6c48a]"
            style={{
              width: `${((step + 1) / lines.length) * 100}%`,
              transition: "width 700ms ease",
              boxShadow: "0 0 12px rgba(230,196,138,0.8)",
            }}
          />
        </div>
        <p
          key={lines[step]}
          className="mt-6 text-center font-serif text-xs uppercase text-[#e6c48a]"
          style={{ animation: "line-in 700ms ease both" }}
        >
          {lines[step]}
        </p>
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
