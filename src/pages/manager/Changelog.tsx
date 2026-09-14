import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

// You can add new entries to the top of this array as we build out the app!
export const CHANGELOG_DATA = [
  {
    version: "v1.21.0",
    date: "2026-09-13",
    title: "Royalty Payback, ROAS Controls & Bride Payment UX",
    changes: [
      {
        type: "fix",
        text: "Royalty payback now moves remaining_balance when a period is marked paid — a shared DB trigger covers both manual Mark Paid and the Stripe webhook, with a one-time reconcile button to backfill already-collected amounts.",
      },
      {
        type: "feature",
        text: "Intelligence and Growth Hub ROAS now honor per-campaign Include toggles — excluded campaigns are dropped from spend, ROAS, and CAC totals, with an excluded-names chip list and clear revenue caption.",
      },
      {
        type: "improvement",
        text: "Bride Portal 'Update card' now opens the GHL invoice URL first, falls back to the legacy Stripe portal only for old customers, and shows a note for off-platform (Venmo/Cash App/Zelle) weddings instead of a dead button.",
      },
      {
        type: "fix",
        text: "Added CORS + OPTIONS handling to the scheduler edge function so the manager 'Run now' button no longer fails with a fetch error.",
      },
    ],
  },
  {
    version: "v1.20.0",
    date: "2026-09-13",
    title: "Off-Platform Payments, Proposal Resume & Readiness UX",
    changes: [
      {
        type: "feature",
        text: "Added off-platform payment collection (Venmo, Cash App, Zelle) with a blocking bride-side modal that defers invoice creation until the couple chooses card/bank.",
      },
      {
        type: "feature",
        text: "Staff can approve or reject off-platform claims from a unified modal on the Dashboard, Proposals, and Payment Audit — confirming books the wedding and records royalty.",
      },
      {
        type: "feature",
        text: "Proposal links now resume correctly: signed contracts skip the signature pad, existing invoices show 'Open invoice', and off-platform choices show the wait state.",
      },
      {
        type: "improvement",
        text: "Replaced the vague 'View gaps' link on the Weddings table with an inline readiness tooltip listing every missing item directly on the row.",
      },
      {
        type: "improvement",
        text: "Proposal tabs now follow the actual wedding state (booked, waiting payment, draft) instead of leftover 'viewed' status, with automatic duplicate detection.",
      },
      {
        type: "improvement",
        text: "Payment Audit row status now derives from cumulative paid_amount (Stripe + GHL merged) using a running-total model, so installments show Paid correctly after GHL payments post.",
      },
      {
        type: "fix",
        text: "Fixed contractor Profile tabs not switching on click — tab state now syncs with the URL search param.",
      },
    ],
  },
  {
    version: "v1.19.0",
    date: "2026-09-10",
    title: "Bartender Role, Territory Sync & Push Restoration",
    changes: [
      {
        type: "feature",
        text: "Added Bartender as a first-class specialty and job role with simplified onboarding (photo + basics only, no portfolio or gear list required).",
      },
      {
        type: "feature",
        text: "Bartender contractors skip Training Academy but still complete W-9, and only see Bartender jobs in Opportunities and Dashboard.",
      },
      {
        type: "feature",
        text: "Bartending upsell now creates a second GHL invoice instead of charging Stripe, with auto-insert of an unassigned Bartender job row.",
      },
      {
        type: "improvement",
        text: "Territory Sync now ships all off-platform and GHL invoice schema columns (proposals.wedding_id, wedding ghl_*, portal_settings handles) via a hardcoded fallback that always runs last.",
      },
      {
        type: "improvement",
        text: "Restored consistent owner push notifications: 9 AM daily digest triggered from the scheduler, plus instant push when a GHL payment posts via the webhook.",
      },
      {
        type: "fix",
        text: "Fixed ghl-invoice edge function bundling failures by inlining all schema-heal SQL and removing sibling file imports.",
      },
    ],
  },
  {
    version: "v1.18.0",
    date: "2026-09-07",
    title: "GHL Invoicing, Payment Schedules & Webhook",
    changes: [
      {
        type: "feature",
        text: "Replaced Stripe booking payments with GHL invoice creation and send, including payment schedules for custom payment plans with multiple installments.",
      },
      {
        type: "feature",
        text: "Added ghl-invoice-webhook to process InvoicePartiallyPaid and InvoicePaid events, updating paid_amount with idempotent delta math and booking on first payment.",
      },
      {
        type: "feature",
        text: "Added per-area invoice link domain in Settings so each territory's customer invoice URL uses the correct host.",
      },
      {
        type: "feature",
        text: "Payment Audit now supports manual Mark Paid / Mark Unpaid, Paid in Full for off-platform collection, and Sync GHL Invoices to pull live payment status.",
      },
      {
        type: "improvement",
        text: "Removed Stripe auto-charge and Stripe invoice link actions from Payment Audit; royalty Stripe charging remains untouched.",
      },
      {
        type: "improvement",
        text: "Custom payment plans now enforce that installment amounts sum to the contract total before Sign & Pay or save.",
      },
      {
        type: "fix",
        text: "Fixed GHL contact tagging — 'booked' on first payment and 'bartending booked' on bartending invoice create, with idempotent re-tagging.",
      },
    ],
  },
  {
    version: "v1.17.0",
    date: "2026-09-04",
    title: "New Area Setup, Gift Page & Payment Plan Approval",
    changes: [
      {
        type: "improvement",
        text: "Updated the New Area Setup Checklist to reflect GHL booking flow — no more Stripe webhook setup for booking payments.",
      },
      {
        type: "improvement",
        text: "Payment plan approval flow no longer cancels Stripe subscriptions; instead it creates a GHL invoice for remaining unpaid installments.",
      },
      {
        type: "fix",
        text: "Disabled the Gift Wedding page's Stripe checkout — gift payments now show a 'temporarily unavailable' message while keeping old links live.",
      },
    ],
  },
  {
    version: "v1.16.0",
    date: "2026-05-03",
    title: "Contractor Onboarding, 1099 Reporting & Dark Mode",
    changes: [
      {
        type: "feature",
        text: "Added a 3-step Contractor Onboarding flow for new invites to collect profile details before password setup.",
      },
      {
        type: "feature",
        text: "Added a 1099 Reporting Dashboard to calculate yearly payouts, flag those over $600, and export CSVs.",
      },
      {
        type: "feature",
        text: "Implemented full Dark Mode support with a global Light/Dark/System theme toggle.",
      },
      {
        type: "improvement",
        text: "Added Headshot and Bio fields to contractor profiles, complete with a live Bride Portal preview during onboarding.",
      },
    ],
  },
  {
    version: "v1.15.0",
    date: "2026-04-28",
    title: "Payouts Workflow, Impersonation & Editor Dashboard",
    changes: [
      {
        type: "feature",
        text: "Added payment method options (Zelle, Venmo, CashApp, PayPal, Other) to the Payout Approval modal and passed the selection via webhook.",
      },
      {
        type: "improvement",
        text: "Updated the 'Stop Impersonating' banner to safely return to the Manager Dashboard instead of logging out.",
      },
      {
        type: "improvement",
        text: "Streamlined the Editor Dashboard submission process to only require the Final Destination Folder and an acknowledgement checkbox.",
      },
      {
        type: "fix",
        text: "Fixed an issue where the Editor Dashboard displayed all active projects instead of only assigned projects.",
      },
      {
        type: "fix",
        text: "Fixed contractor profile fields appearing blank due to a caching conflict and made email lookups case-insensitive.",
      },
      {
        type: "fix",
        text: "Fixed the Venmo handle not displaying in Payouts and removed the hard block on approvals for missing Venmo handles.",
      },
      {
        type: "fix",
        text: "Bypassed the 24-hour duplicate email check on payout approvals to ensure notifications send immediately.",
      },
      {
        type: "feature",
        text: "Added comprehensive webhook logging to Settings > API Logs for payout notifications.",
      },
    ],
  },
  {
    version: "v1.14.0",
    date: "2026-04-21",
    title: "Action Required Workflow & Contractor Readiness",
    changes: [
      {
        type: "feature",
        text: "Added an 'Action Required' tab to Assignments for post-wedding media uploads, separating them from future jobs.",
      },
      {
        type: "improvement",
        text: "Past weddings automatically transition out of 'Upcoming' and trigger overdue alerts.",
      },
      {
        type: "feature",
        text: "Introduced an automatic rating penalty (1-star system rating) for contractors who submit media more than 7 days late.",
      },
      {
        type: "improvement",
        text: "Updated media upload instructions requiring photo culling (100-120 images) while keeping all raw video files.",
      },
      {
        type: "feature",
        text: "Added Readiness Scores and specific missing action item alerts to the 'On Deck' dashboard view.",
      },
      {
        type: "feature",
        text: "Added automated SMS alerts to notify contractors of incomplete prep items 5 days prior to a wedding.",
      },
    ],
  },
  {
    version: "v1.13.0",
    date: "2026-04-15",
    title: "SMS Automations & Notifications Redesign",
    changes: [
      {
        type: "feature",
        text: "Added Automated SMS Templates for Contractor Assignment, New Job Alerts, Upcoming Reminders, and Payouts.",
      },
      {
        type: "improvement",
        text: "Reorganized Settings into a dedicated Notifications tab, grouped by role (Contractors, Admin, Editors, Brides).",
      },
      {
        type: "feature",
        text: "Added an SMS Logs tab to track the delivery status and history of all automated text messages.",
      },
      {
        type: "feature",
        text: "Added a 'Test Template' button with mock data injection to preview SMS messages before enabling them.",
      },
      {
        type: "fix",
        text: "Improved error handling when testing SMS templates without saved Ovanta API credentials.",
      },
    ],
  },
  {
    version: "v1.12.0",
    date: "2026-04-10",
    title: "Post-Production Deadlines & Automation",
    changes: [
      {
        type: "feature",
        text: "Added a dynamic 'Deadline' column to the Post-Production table (3 weeks standard, 4 weeks during Sept-Nov busy season).",
      },
      {
        type: "improvement",
        text: "Automated the pipeline: when a contractor submits their invoice and media link, the wedding automatically moves to 'Ready to Edit'.",
      },
    ],
  },
  {
    version: "v1.11.0",
    date: "2026-04-05",
    title: "Post-Production Data Table",
    changes: [
      {
        type: "feature",
        text: "Replaced the Post-Production Kanban board with a high-density, filterable data table for faster bulk management.",
      },
      {
        type: "improvement",
        text: "Added inline status editing and a dedicated modal for managing media links directly from the table.",
      },
    ],
  },
  {
    version: "v1.10.0",
    date: "2026-04-02",
    title: "Security, Pagination & Contractor Filters",
    changes: [
      {
        type: "feature",
        text: "Added comprehensive search and filtering capabilities to the Contractors page.",
      },
      {
        type: "feature",
        text: "Added pagination to Contractors, Assignments, and Weddings tables for better performance.",
      },
      {
        type: "improvement",
        text: "Migrated pending contractor invitations from local storage to the secure database.",
      },
      {
        type: "fix",
        text: "Removed hardcoded admin credentials and secured the manager authentication flow.",
      },
    ],
  },
  {
    version: "v1.9.0",
    date: "2026-03-31",
    title: "On Deck, Auto-closing & Client Feedback",
    changes: [
      {
        type: "feature",
        text: "Added 'On Deck' section to the Manager Dashboard highlighting weddings in the next 14 days with quick action items.",
      },
      {
        type: "improvement",
        text: "System now automatically closes pending applications and notifies contractors when a position or entire wedding is filled.",
      },
      {
        type: "feature",
        text: "Created a native Client Feedback form to securely collect 1-5 star ratings and reviews directly from couples.",
      },
      {
        type: "fix",
        text: "Resolved clipboard permission errors when copying feedback and questionnaire links in strict browser environments.",
      },
    ],
  },
  {
    version: "v1.8.0",
    date: "2026-03-30",
    title: "Settings Redesign & Email Integrations",
    changes: [
      {
        type: "improvement",
        text: "Completely reorganized the Manager Settings page into clean tabs (General, Integrations, Email Config).",
      },
      {
        type: "feature",
        text: "Added Email Configuration (SMTP) with a toggle to switch between Webhooks and Direct SMTP delivery.",
      },
      {
        type: "feature",
        text: "Added a dedicated 'Contractor Assigned' Webhook URL to trigger automations when a contractor is assigned to a job.",
      },
    ],
  },
  {
    version: "v1.7.0",
    date: "2026-03-30",
    title: "Resource Hub & Contractor Payouts",
    changes: [
      {
        type: "feature",
        text: "Added a dedicated Invoices & Payouts section for contractors to track earnings and mark payments as received.",
      },
      {
        type: "improvement",
        text: "Upgraded the Resource Hub to use smooth sliding side panels instead of popups.",
      },
      {
        type: "feature",
        text: "Embedded full-screen YouTube training tutorials directly into the portal.",
      },
      {
        type: "improvement",
        text: "Updated contractor guidelines with a Raw File Workflow and comprehensive Pre/Post-Wedding Checklists.",
      },
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-03-30",
    title: "Global Header & Dashboard Updates",
    changes: [
      {
        type: "feature",
        text: "Moved Notifications and Changelog to a new global top navigation header with notification badges.",
      },
      {
        type: "improvement",
        text: "Streamlined the profile dropdown menu to focus on account settings and activity logs.",
      },
      {
        type: "feature",
        text: "Added Year-to-Date (YTD) earnings summary to the contractor dashboard.",
      },
      {
        type: "fix",
        text: "Implemented automatic image compression and resizing for profile picture uploads to prevent storage limits.",
      },
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-03-29",
    title: "Contractor Impersonation & Mock Data",
    changes: [
      {
        type: "feature",
        text: "Added a 'Log In As' button to the Contractors table so managers can view the portal exactly as a specific contractor sees it.",
      },
      {
        type: "feature",
        text: "Added a 'Generate Mock Data' button to quickly create a test contractor, a completed wedding, and a pending payout assignment for testing workflows.",
      },
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-03-29",
    title: "Contractor Invoicing & Media Delivery",
    changes: [
      {
        type: "feature",
        text: "Added 'Drive Folder Link' to Weddings so managers can specify where contractors should upload raw media.",
      },
      {
        type: "feature",
        text: "Contractors can now submit their raw media link and extra expenses directly from their assignment page once the wedding passes.",
      },
      {
        type: "feature",
        text: "Added a 'Pending Payouts' widget to the Manager Dashboard to easily review media links and approve payouts.",
      },
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-03-29",
    title: "Consolidated Operations & UI Polish",
    changes: [
      {
        type: "improvement",
        text: "Consolidated the Positions page into the Weddings page as a tab to reduce sidebar clutter.",
      },
      {
        type: "feature",
        text: "Added top-level tabs in Operations to easily switch between Weddings and Positions views.",
      },
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-03-29",
    title: "Mobile Redesign & Responsive UI",
    changes: [
      {
        type: "improvement",
        text: "Completely redesigned the mobile layout for the Manager Dashboard.",
      },
      {
        type: "feature",
        text: "Updated stats cards to display in a compact grid on mobile devices.",
      },
      {
        type: "improvement",
        text: "Optimized action items lists with text truncation to prevent layout breaking on small screens.",
      },
      {
        type: "improvement",
        text: "Made headers responsive across all manager pages so action buttons stack neatly.",
      },
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-03-29",
    title: "Changelog, Sidebar & Admin Roles",
    changes: [
      {
        type: "feature",
        text: "Added a Changelog page to track app updates and new features.",
      },
      {
        type: "feature",
        text: "Reorganized the manager navigation into a collapsible sidebar with grouped sections (Operations, Team, Settings).",
      },
      {
        type: "feature",
        text: "Added Administrator Profiles with avatars and roles (Super Admin, Manager, Read Only).",
      },
      {
        type: "improvement",
        text: "Added a 'My Profile' page for managers to update their own personal details securely.",
      },
      {
        type: "feature",
        text: "Added a Preparation Checklist for contractors on their assignment details page.",
      },
      {
        type: "improvement",
        text: "Updated the Wedding Readiness score to calculate based on 4 metrics (now includes contractor checklist completion).",
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-03-01",
    title: "Initial Release",
    changes: [
      { type: "feature", text: "Launched the Contractor Portal." },
      {
        type: "feature",
        text: "Added private job board, assignments, and messaging.",
      },
      {
        type: "feature",
        text: "Added manager dashboard for tracking weddings and open positions.",
      },
    ],
  },
];

export default function ManagerChangelog() {
  useEffect(() => {
    localStorage.setItem("last_seen_changelog", CHANGELOG_DATA[0].version);
    window.dispatchEvent(new Event("changelog-read"));
  }, []);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "feature":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "improvement":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "fix":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Changelog
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Keep track of the latest updates and improvements to the portal.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 mt-8">
        {CHANGELOG_DATA.map((release, index) => (
          <Card
            key={index}
            className="relative overflow-hidden border-t-4 border-t-primary shadow-sm"
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {release.title}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {release.version}
                    </Badge>
                    <span>•</span>
                    <span>
                      {new Date(release.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={`mt-0.5 capitalize min-w-[90px] justify-center ${getBadgeColor(change.type)} border-0`}
                    >
                      {change.type}
                    </Badge>
                    <span className="text-sm leading-relaxed text-foreground/90">
                      {change.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
