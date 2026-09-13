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
      { icon: Settings, label: "Settings", path: "/manager/settings" },
      { icon: Activity, label: "Activity Log", path: "/manager/activity" },
      { icon: Globe, label: "Territory Fleet", path: "/manager/territories" },
    ],
  },
];

// Royalty nav item — only visible to super_admin
export const royaltyNavItem = {
  icon: Crown,
  label: "Royalty & Payback",
  path: "/manager/royalty",
};

export const stripePayoutNavItem = {
  icon: CreditCard,
  label: "Stripe Payout Setup",
  path: "/manager/stripe-payout",
};

// Owner-specific nav item for their royalty dashboard
export const ownerRoyaltyNavItem = {
  icon: Crown,
  label: "Royalty Dashboard",
  path: "/owner/royalty",
};
