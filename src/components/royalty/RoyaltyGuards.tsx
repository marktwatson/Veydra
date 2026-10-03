import { Loader2, Crown } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function RoyaltyLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/** Owner / manager with no territory_id — do NOT load Honeysuckle royalty. */
export function RoyaltyNoAreaState() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
        <Crown className="h-7 w-7 text-amber-500" /> Royalty & Payback
      </h1>
      <Card className="shadow-sm border-border/40 rounded-2xl bg-card max-w-lg">
        <CardHeader className="p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-lg font-bold">No area assigned</CardTitle>
          <CardDescription className="text-xs">
            Your account is not linked to a territory, so there is no royalty
            data to show. Ask a Super Admin to assign you an area.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
