import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SalesLeadIntel } from "@/lib/sales-activity-api";
import { STAGE_COLORS, SALES_COLORS } from "./SalesCharts";

export function LeadIntelTable({ leads }: { leads: SalesLeadIntel[] }) {
  if (!leads.length) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          💎 Lead Intelligence — sorted by estimated value
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">Name</th>
                <th className="py-1.5 pr-3 font-medium">Stage</th>
                <th className="py-1.5 pr-3 font-medium">Source</th>
                <th className="py-1.5 pr-3 font-medium text-right">
                  Est. Value
                </th>
                <th className="py-1.5 pr-3 font-medium text-right">Days</th>
                <th className="py-1.5 font-medium">Last Touch</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 15).map((li, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{li.name}</span>
                      {li.isNewInWindow && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold">
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                      style={{
                        borderColor: `${STAGE_COLORS[li.stage] || SALES_COLORS.blue}40`,
                        color: STAGE_COLORS[li.stage] || SALES_COLORS.blue,
                      }}
                    >
                      {li.stage.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {li.source}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {li.estimatedValue
                      ? `$${li.estimatedValue.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {li.daysSinceFirstContact ?? "—"}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {li.hoursAgo != null
                      ? `${li.hoursAgo}h ago`
                      : li.lastChannel || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length > 15 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing top 15 of {leads.length} leads.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
