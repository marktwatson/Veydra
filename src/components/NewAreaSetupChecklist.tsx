import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  ListChecks,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Step = {
  key: string;
  label: string;
  detail: string;
  defaultDone?: boolean;
};

const STORAGE_KEY = "veydra_area_setup_progress";

const STEPS: Step[] = [
  {
    key: "sync",
    label: "Sync territory schema & functions",
    detail:
      "Run Upload Sources + Sync in Territories to create tables and deploy edge functions.",
    defaultDone: true,
  },
  {
    key: "cron",
    label: "Create the 10-minute Scheduled Function",
    detail:
      "Supabase Dashboard → Edge Functions → Schedules → New Schedule. Function: scheduler. Cron: */10 * * * *. This is the clock that fires offset notifications — sync does NOT copy it.",
  },
  {
    key: "timezone",
    label: "Set portal timezone",
    detail:
      "Set portal_settings.timezone (e.g. America/Chicago) so all date/time math uses the correct local time.",
  },
  {
    key: "booking-secrets",
    label: "Set booking Stripe secrets",
    detail:
      "stripe-webhook + stripe-checkout functions need STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET for this area's booking Stripe account.",
  },
  {
    key: "booking-webhook",
    label: "Create booking webhook in Stripe",
    detail:
      "Stripe → Developers → Webhooks → Add endpoint → https://<project>.supabase.co/functions/v1/stripe-webhook. Copy the whsec_ into the function secrets.",
  },
  {
    key: "royalty-secrets",
    label: "Set royalty Stripe secrets",
    detail:
      "royalty-processor function needs the royalty account secret key. Royalty bank-connect keys are saved in-app (Royalty → Settings). No royalty webhook is needed — the processor charges directly.",
  },
];

const CRON_SQL = `-- 10-minute scheduler cron (run once per new Supabase project)
select cron.schedule(
  'veydra-scheduler-10min',
  '*/10 * * * *',
  $$
    select
      net.http_post(
        url   := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/scheduler',
        headers := jsonb_build_object(
          'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      ) as request_id;
  $$
);

-- Verify it was created:
select jobname, schedule, active from cron.job;`;

function loadProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Default: only the "sync" step is pre-checked
  return { sync: true };
}

/**
 * Per-location setup checklist shown on the Territories page (super admin only).
 * Reminds super admins of the manual steps that territory sync does NOT copy
 * (cron schedule, secrets, webhooks, timezone). Checkboxes are interactive and
 * persisted to localStorage so progress survives refreshes.
 */
export function NewAreaSetupChecklist({ settings }: { settings?: any }) {
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Merge defaults with saved progress so a timezone set in Settings
    // auto-checks that step even if the user hasn't toggled it here.
    const saved = loadProgress();
    const merged: Record<string, boolean> = {};
    for (const step of STEPS) {
      if (step.key === "timezone" && settings?.timezone) {
        merged[step.key] = true;
      } else {
        merged[step.key] = saved[step.key] ?? step.defaultDone ?? false;
      }
    }
    setProgress(merged);
  }, [settings?.timezone]);

  const toggle = (key: string) => {
    setProgress((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(CRON_SQL);
      setCopied(true);
      toast.success("SQL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const doneCount = STEPS.filter((s) => progress[s.key]).length;
  const allDone = doneCount === STEPS.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-slate-200 bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" /> New Area Setup Checklist
              </CardTitle>
              <CardDescription>
                Manual steps territory sync does not copy. Click to{" "}
                {open ? "collapse" : "expand"}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={allDone ? "default" : "outline"}
                className="rounded-full"
              >
                {doneCount}/{STEPS.length} done
              </Badge>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            {STEPS.map((step) => {
              const done = !!progress[step.key];
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => toggle(step.key)}
                  className="flex w-full items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 text-left transition-colors"
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </button>
              );
            })}

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground mt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-foreground">
                  SQL to create the scheduler cron schedule
                </p>
                <button
                  type="button"
                  onClick={copySql}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mb-2">
                Run this once in the Supabase SQL Editor on each new project. It
                invokes the <code className="font-mono">scheduler</code> edge
                function every 10 minutes. Replace{" "}
                <code className="font-mono">YOUR_PROJECT_REF</code> and the anon
                key.
              </p>
              <pre className="bg-muted/50 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed font-mono whitespace-pre">
                {CRON_SQL}
              </pre>
              <p className="mt-2">
                If <code className="font-mono">net.http_post</code> is not
                available (older Supabase), use the pg_cron + pg_net extension,
                or set up the schedule via Dashboard → Edge Functions →
                Schedules instead.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
