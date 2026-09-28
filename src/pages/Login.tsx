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

// Brand loading screen shown for ~3s after a successful sign-in, before the
// user is routed to their destination. The logo zooms to fill the screen and
// a progress bar + caption play out beneath it.
function BootScreen({ caption }: { caption: string }) {
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setZoom(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/40 overflow-hidden">
      <img
        src={LOGIN_LOGO_URL}
        alt="Portal Logo"
        className="object-contain transition-all duration-[1200ms] ease-out will-change-transform"
        style={{
          width: zoom ? "min(33vw, 33vh)" : "125px",
          transform: zoom ? "scale(1)" : "scale(0.92)",
          opacity: zoom ? 1 : 0.85,
        }}
      />
      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="text-lg font-medium tracking-wide text-foreground">
          {caption}
          <span className="inline-flex w-6">
            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
            <span className="animate-bounce [animation-delay:-0.15s]">.</span>
            <span className="animate-bounce">.</span>
          </span>
        </p>
        <div className="w-64 max-w-[70vw] h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[3000ms] ease-linear"
            style={{ width: zoom ? "100%" : "0%" }}
          />
        </div>
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
  const [bootCaption, setBootCaption] = useState("Loading your workspace");
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
    }, 3000);
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

      const caption =
        type === "manager" || isSuperAdminEmail(email)
          ? "Loading your dashboard"
          : type === "editor"
            ? "Loading the editor"
            : "Loading your workspace";

      // Emulate a loading screen before routing the user in.
      setBootDest(dest);
      setBootCaption(caption);
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
