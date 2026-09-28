import {
  Briefcase,
  Calendar,
  Home,
  LayoutDashboard,
  Inbox,
  Users,
  Settings,
  PlusSquare,
  Activity,
  MessageSquare,
  DollarSign,
  Receipt,
  TrendingUp,
  CreditCard,
  Globe,
  Crown,
  Shield,
  GraduationCap,
  MapPin,
} from "lucide-react";

export const contractorNavItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/opportunities" },
  { icon: Calendar, label: "Assignments", path: "/assignments" },
  { icon: Receipt, label: "Invoices", path: "/invoices" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
];

export const editorNavItems = [
  { icon: LayoutDashboard, label: "Portal", path: "/editor" },
  { icon: Receipt, label: "Invoices", path: "/editor/invoices" },
];

export const managerNavGroups = [
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
      { icon: GraduationCap, label: "Training", path: "/manager/training" },
      { icon: Settings, label: "Settings", path: "/manager/settings" },
      { icon: Activity, label: "Activity Log", path: "/manager/activity" },
    ],
  },
];

// Areas nav item — the single Areas page (Areas.tsx at /manager/areas),
// visible to super_admin + owner. The old /manager/territories route is kept
// for bookmarks but is hidden from the sidebar.
export const areasNavItem = {
  icon: MapPin,
  label: "Areas",
  path: "/manager/areas",
};

// Legacy exports kept so Layout.tsx imports keep compiling. They are no longer
// rendered: Areas is served via areasNavItem, and Territory Fleet is hidden.
export const territoryFleetNavItem = {
  icon: Globe,
  label: "Territory Fleet",
  path: "/manager/territories",
};

// Proxy exports that Layout.tsx imports and appends for super_admin in the
// System Control group. royaltyNavItem now also points at the Areas page so
// super admins see exactly one "Areas" item; stripePayoutNavItem is a no-op
// (rendered only as a duplicate guard) — set to Areas to keep a single source
// of truth.
export const royaltyNavItem = {
  icon: MapPin,
  label: "Areas",
  path: "/manager/areas",
};

export const stripePayoutNavItem = {
  icon: MapPin,
  label: "Areas",
  path: "/manager/areas",
};

// Owner-specific nav item for their royalty dashboard
export const ownerRoyaltyNavItem = {
  icon: Crown,
  label: "Royalty Dashboard",
  path: "/owner/royalty",
};
