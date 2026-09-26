import { Home, Receipt, BookOpen } from "lucide-react";
import { contractorNavItems, editorNavItems } from "@/components/layout-nav";

type NavItem = { icon: any; label: string; path: string };

export function buildFlatNavItems(opts: {
  isManagerOrAdmin: boolean;
  role: string;
  isTerminated: boolean;
  isApplicant: boolean;
  trainingCompleted?: boolean;
  effectiveNavGroups: { items: NavItem[] }[];
}): NavItem[] {
  const {
    isManagerOrAdmin,
    role,
    isTerminated,
    isApplicant,
    trainingCompleted,
    effectiveNavGroups,
  } = opts;

  return isManagerOrAdmin
    ? effectiveNavGroups.flatMap((g) => g.items)
    : role === "editor"
      ? editorNavItems
      : isTerminated
        ? [{ icon: Receipt, label: "Invoices", path: "/invoices" }]
        : isApplicant
          ? [{ icon: Home, label: "Candidate Portal", path: "/" }]
          : trainingCompleted === false
            ? [{ icon: BookOpen, label: "Training Academy", path: "/training" }]
            : contractorNavItems;
}
