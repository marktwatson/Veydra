import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  includedCampaigns,
  excludedCampaignNames,
} from "@/lib/campaign-inclusion";

interface AdCampaignsTabProps {
  loadingCampaigns: boolean;
  rawCampaignsList: any[];
  excludedCampaignIds: string[];
  onToggleExclusion: (id: string) => void;
  onRefresh: () => void;
}

export function GrowthAdCampaignsTab(props: AdCampaignsTabProps) {
  const {
    loadingCampaigns,
    rawCampaignsList,
    excludedCampaignIds,
    onToggleExclusion,
    onRefresh,
  } = props;

  const included = includedCampaigns(rawCampaignsList, excludedCampaignIds);
  const excludedNames = excludedCampaignNames(
    rawCampaignsList,
    excludedCampaignIds,
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Meta / Facebook Ad Performance</h3>
          <p className="text-xs text-muted-foreground">
            Live ad tracking synced with your marketing account ·{" "}
            <span className="text-primary font-semibold">
              {included.length} of {rawCampaignsList.length} in Intelligence
            </span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          className="rounded-full"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Ads
        </Button>
      </div>

      {excludedNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground font-medium">
            Excluded from ROAS/spend:
          </span>
          {excludedNames.map((c) => (
            <Badge
              key={c.id}
              variant="outline"
              className="text-[10px] py-0 px-2 font-medium text-muted-foreground border-border/50"
            >
              {c.name}
            </Badge>
          ))}
          <Link
            to="/manager/ad-campaigns"
            className="text-primary underline font-medium ml-1"
          >
            Manage →
          </Link>
        </div>
      )}

      <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">Include</TableHead>
              <TableHead className="min-w-[200px]">Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingCampaigns ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  Fetching campaign data...
                </TableCell>
              </TableRow>
            ) : rawCampaignsList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No ad campaigns found. Connect your Meta Ad Account in
                  Settings.
                </TableCell>
              </TableRow>
            ) : (
              rawCampaignsList.map((c) => {
                const isExcluded = excludedCampaignIds.includes(c.id);
                return (
                  <TableRow
                    key={c.id}
                    className={isExcluded ? "opacity-50 bg-muted/20" : ""}
                  >
                    <TableCell>
                      <Button
                        size="sm"
                        variant={isExcluded ? "outline" : "default"}
                        className="h-7 text-[10px] rounded-full px-2.5"
                        onClick={() => onToggleExclusion(c.id)}
                      >
                        {isExcluded ? "Excluded" : "Active"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.objective}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      $
                      {c.spend?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.clicks?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {c.conversions}
                    </TableCell>
                    <TableCell className="text-right">
                      ${c.cpa ? c.cpa.toFixed(2) : "0.00"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className="text-emerald-600 border-emerald-600/30"
                      >
                        {c.roas ? `${c.roas}x` : "N/A"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
