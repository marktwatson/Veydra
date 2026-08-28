import { Badge } from "@/components/ui/badge";
import { ApplicationStatus } from "@/data/mockData";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus | "Upcoming" | "In Progress" | "Completed" | string;
  className?: string;
}) {
  const getStyles = () => {
    switch (status?.toLowerCase()) {
      case "apply":
      case "open":
        return "bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:text-indigo-400 border-transparent shadow-sm";
      case "applied":
      case "under review":
      case "pending payout":
        return "bg-amber-50 text-amber-700 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-400 border-transparent shadow-sm";
      case "re-apply":
      case "declined":
      case "rejected":
      case "not selected":
      case "not_selected":
        return "bg-rose-50 text-rose-700 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:text-rose-400 border-transparent shadow-sm";
      case "awarded":
      case "completed":
      case "payment received":
      case "delivered":
        return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:text-emerald-400 border-transparent shadow-sm";
      case "upcoming":
        return "bg-blue-50 text-blue-700 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:text-blue-400 border-transparent shadow-sm";
      case "in progress":
      case "today":
        return "bg-purple-50 text-purple-700 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:text-purple-400 border-transparent shadow-sm";
      case "past":
        return "bg-orange-50 text-orange-700 hover:bg-orange-100/80 dark:bg-orange-950/30 dark:text-orange-400 border-transparent shadow-sm";
      case "manager review":
      case "revisions requested":
      case "ready to edit":
        return "bg-slate-50 text-slate-700 hover:bg-slate-100/80 dark:bg-slate-900/30 dark:text-slate-400 border-transparent shadow-sm";
      default:
        return "bg-slate-50 text-slate-700 hover:bg-slate-100/80 dark:bg-slate-900/30 dark:text-slate-400 border-transparent shadow-sm";
    }
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium rounded-full px-3 py-1 text-[11px] uppercase tracking-wider whitespace-nowrap",
        getStyles(),
        className,
      )}
    >
      {status}
    </Badge>
  );
}
