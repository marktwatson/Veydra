import { useState, useEffect, type FormEvent } from "react";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicListProposals } from "@/lib/public-list-proposals-api";

interface PublicBuilderGateModalProps {
  slug: string;
  /** True when the area has a sales PIN configured. The PIN VALUE is never
   *  passed to the browser; verification happens server-side. */
  areaHasPin?: boolean;
  companyName?: string | null;
  logoUrl?: string | null;
  onUnlock: (info: { name: string; email: string; pin: string }) => void;
}

/**
 * Gates the public proposal builder. If the area has a sales PIN, this modal
 * blocks the page until the salesperson enters their name, email, and the
 * correct PIN. The PIN is verified SERVER-SIDE via the public-list-proposals
 * edge function (verifyOnly mode) — the stored PIN never reaches the browser,
 * and failed attempts are rate-limited per IP (3 tries → 10 min lockout). One
 * bad IP only locks that IP; real salespeople are never affected.
 */
export function PublicBuilderGateModal({
  slug,
  areaHasPin,
  companyName,
  logoUrl,
  onUnlock,
}: PublicBuilderGateModalProps) {
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // Only gate when a PIN is configured for this area.
  useEffect(() => {
    if (areaHasPin) setOpen(true);
  }, [areaHasPin]);

  // Live lock countdown — re-evaluates every second while locked.
  useEffect(() => {
    if (!locked || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1000;
        if (next <= 0) {
          setLocked(false);
          setError("");
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [locked, remaining]);

  if (!open) return null;

  const formatRemaining = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setChecking(true);
    try {
      // Verify the PIN server-side. verifyOnly skips the listing and only
      // validates the PIN; the stored value is never exposed to the browser.
      await publicListProposals({
        slug,
        salespersonEmail: email.trim().toLowerCase(),
        pin: pin.trim(),
        verifyOnly: true,
      });
      onUnlock({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        pin: pin.trim(),
      });
      setOpen(false);
    } catch (err: any) {
      const retryAfter = err?.retryAfter;
      const attemptsRemaining = err?.attemptsRemaining;
      if (retryAfter && typeof retryAfter === "number") {
        // IP is locked by the server.
        setLocked(true);
        setRemaining(retryAfter * 1000);
        setPin("");
        setError("");
      } else if (typeof attemptsRemaining === "number") {
        setPin("");
        setError(
          `Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before this device is locked for 10 minutes.`,
        );
      } else {
        setError(err?.message || "Incorrect PIN.");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-lg">
        <div className="flex flex-col items-center gap-3 p-6 pb-2">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={companyName || "Area"}
              className="h-12 w-auto object-contain"
            />
          )}
          <div className="flex items-center gap-2 text-foreground">
            <Lock className="h-5 w-5" />
            <h2 className="text-xl font-serif">Salesperson Access</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {companyName ? `${companyName} — ` : ""}Enter your details and the
            area PIN to build proposals.
          </p>
        </div>

        {locked ? (
          <div className="flex flex-col items-center gap-3 p-6 pt-2 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h3 className="text-lg font-serif text-foreground">
              Too many attempts
            </h3>
            <p className="text-sm text-muted-foreground">
              Access is temporarily locked for this device. Try again in{" "}
              <span className="font-medium text-foreground">
                {formatRemaining(remaining)}
              </span>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gate-name">Your Name *</Label>
              <Input
                id="gate-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Sales"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-email">Your Email *</Label>
              <Input
                id="gate-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-pin">Area PIN *</Label>
              <Input
                id="gate-pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter the PIN for this area"
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={checking}>
              {checking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {checking ? "Unlocking..." : "Unlock Builder"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
