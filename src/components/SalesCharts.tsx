import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { SalesFunnel, SalesHistoryRun } from "@/lib/sales-activity-api";

const C = {
  red: "hsl(0 84% 60%)",
  amber: "hsl(38 92% 50%)",
  blue: "hsl(217 91% 60%)",
  green: "hsl(142 71% 45%)",
  purple: "hsl(262 60% 60%)",
};

const STAGE_COLORS: Record<string, string> = {
  new: C.blue,
  contacted: C.purple,
  engaged: C.green,
  proposal_sent: C.amber,
  booked: C.red,
};

export function SalesTrendChart({ history }: { history: SalesHistoryRun[] }) {
  const trendData = history
    .slice()
    .reverse()
    .map((h) => ({
      date: new Date(h.ran_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      pool: h.pool_size,
      needsReply: h.needs_reply_count,
      goingCold: h.going_cold_count,
      avgResponse: h.avg_response_hours || 0,
    }));

  if (trendData.length <= 1) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          📈 Trends (last {trendData.length} runs)
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Pool size & unanswered
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="pool"
                  stroke={C.blue}
                  strokeWidth={2}
                  name="Pool"
                />
                <Line
                  type="monotone"
                  dataKey="needsReply"
                  stroke={C.red}
                  strokeWidth={2}
                  name="Needs Reply"
                />
                <Line
                  type="monotone"
                  dataKey="goingCold"
                  stroke={C.amber}
                  strokeWidth={2}
                  name="Going Cold"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Avg response time (hours)
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="avgResponse"
                  stroke={C.green}
                  strokeWidth={2}
                  name="Avg Response (h)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SalesFunnelChart({ funnel }: { funnel?: SalesFunnel }) {
  if (!funnel) return null;
  const funnelData = [
    { stage: "New", count: funnel.new, fill: STAGE_COLORS.new },
    {
      stage: "Contacted",
      count: funnel.contacted,
      fill: STAGE_COLORS.contacted,
    },
    { stage: "Engaged", count: funnel.engaged, fill: STAGE_COLORS.engaged },
    {
      stage: "Proposal Sent",
      count: funnel.proposal_sent,
      fill: STAGE_COLORS.proposal_sent,
    },
  ];
  if (funnelData.every((d) => d.count === 0)) return null;

  return (
    <Card>
      <CardContent className="pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          📊 Pipeline Funnel — {funnel.total} active unbooked leads
          {funnel.windowNewLeadsCount != null && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({funnel.windowNewLeadsCount} added in window)
            </span>
          )}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={funnelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 11 }}
              width={90}
            />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {funnelData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          {funnel.total ? Math.round((funnel.engaged / funnel.total) * 100) : 0}
          % of active leads have engaged (replied to outreach).
        </p>
      </CardContent>
    </Card>
  );
}

export { STAGE_COLORS, C as SALES_COLORS };
