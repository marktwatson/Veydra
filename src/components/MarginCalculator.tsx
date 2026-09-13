import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calculator, Info, RotateCcw } from "lucide-react";

interface MarginCalculatorProps {
  packages: any[];
}

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function MarginCalculator({ packages }: MarginCalculatorProps) {
  // ── Territory (for royalty/payback %) ───────────────────────────────────
  const { data: territory } = useQuery({
    queryKey: ["own-royalty-territory"],
    queryFn: () => api.getOwnRoyaltyTerritory(),
    retry: false,
  });

  // ── Global cost inputs (ad-hoc — reset on page reload) ──────────────────
  const [contractorRate, setContractorRate] = useState(50);
  const [stripeFeePct, setStripeFeePct] = useState(3);
  const [advertising, setAdvertising] = useState(200);
  const [travel, setTravel] = useState(0);
  const [edits, setEdits] = useState(200);
  const [opex, setOpex] = useState(20);
  const [commissionPct, setCommissionPct] = useState(5);
  const [targetMargin, setTargetMargin] = useState(30);

  // ── Royalty & Payback — auto from territory, override for what-if ───────
  const territoryRoyaltyPct = Number(territory?.royalty_percentage || 0);
  const territoryPaybackPct = Number(territory?.payback_percentage || 0);
  const [royaltyOverride, setRoyaltyOverride] = useState("");
  const [paybackOverride, setPaybackOverride] = useState("");
  const effectiveRoyaltyPct =
    royaltyOverride !== "" ? Number(royaltyOverride) : territoryRoyaltyPct;
  const effectivePaybackPct =
    paybackOverride !== "" ? Number(paybackOverride) : territoryPaybackPct;

  // ── Per-package hours (editable, defaults parsed from description) ─────
  const [packageHours, setPackageHours] = useState<
    Record<string, { photo: number; video: number }>
  >({});

  const getHours = (pkg: any) => {
    if (packageHours[pkg.id]) return packageHours[pkg.id];
    const match = (pkg.desc || "").match(/(\d+(?:\.\d+)?)/);
    const h = match ? parseFloat(match[1]) : 4;
    return { photo: h, video: h };
  };

  const setPackageHour = (
    id: string,
    field: "photo" | "video",
    value: number,
  ) => {
    const pkg = packages.find((p) => p.id === id);
    const current = pkg ? getHours(pkg) : { photo: 4, video: 4 };
    setPackageHours((prev) => ({
      ...prev,
      [id]: { ...current, [field]: value },
    }));
  };

  // ── Calculated rows ──────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const active = packages.filter((p) => !p.isArchived);
    return active.map((pkg) => {
      const price = Number(pkg.priceBoth) || 0;
      const { photo: photoH, video: videoH } = getHours(pkg);
      const contractorCost = (photoH + videoH) * contractorRate;
      const stripeFee = price * (stripeFeePct / 100);
      const commission = price * (commissionPct / 100);
      const royalty = price * (effectiveRoyaltyPct / 100);
      const payback = price * (effectivePaybackPct / 100);
      const totalCost =
        contractorCost +
        stripeFee +
        advertising +
        travel +
        edits +
        opex +
        commission +
        royalty +
        payback;
      const profit = price - totalCost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      const suggestedPrice =
        targetMargin > 0 && targetMargin < 100
          ? Math.round(totalCost / (1 - targetMargin / 100) / 50) * 50
          : price;
      return {
        id: pkg.id,
        name: pkg.name,
        price,
        photoH,
        videoH,
        contractorCost,
        stripeFee,
        commission,
        royalty,
        payback,
        totalCost,
        profit,
        margin,
        suggestedPrice,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    packages,
    packageHours,
    contractorRate,
    stripeFeePct,
    advertising,
    travel,
    edits,
    opex,
    commissionPct,
    effectiveRoyaltyPct,
    effectivePaybackPct,
    targetMargin,
  ]);

  const avgMargin =
    rows.length > 0 ? rows.reduce((s, r) => s + r.margin, 0) / rows.length : 0;
  const belowTarget = rows.filter((r) => r.margin < targetMargin).length;

  const marginColor = (m: number) =>
    m >= targetMargin
      ? "text-emerald-600 dark:text-emerald-400"
      : m >= 20
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" /> Margin Calculator
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Model profit margins for your active packages. Cost inputs are
              session-only and reset when you leave this page.
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <div className="text-right shrink-0">
              <div className={`text-2xl font-bold ${marginColor(avgMargin)}`}>
                {avgMargin.toFixed(1)}%
              </div>
              <div className="text-[11px] text-muted-foreground">
                avg margin · {belowTarget} below {targetMargin}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Cost inputs grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Contractor $/hr</Label>
            <Input
              type="number"
              value={contractorRate}
              onChange={(e) => setContractorRate(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Stripe Fee %</Label>
            <Input
              type="number"
              value={stripeFeePct}
              onChange={(e) => setStripeFeePct(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Commission %</Label>
            <Input
              type="number"
              value={commissionPct}
              onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Target Margin %</Label>
            <Input
              type="number"
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Advertising $</Label>
            <Input
              type="number"
              value={advertising}
              onChange={(e) => setAdvertising(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Edits $</Label>
            <Input
              type="number"
              value={edits}
              onChange={(e) => setEdits(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Travel $</Label>
            <Input
              type="number"
              value={travel}
              onChange={(e) => setTravel(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Op Expenses $</Label>
            <Input
              type="number"
              value={opex}
              onChange={(e) => setOpex(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* ── Royalty & Payback (from territory, override for what-if) ── */}
        <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Royalty &amp; Payback auto-filled from your territory config.
              Override to model what-if.
            </span>
          </div>
          <div className="flex items-end gap-3 ml-auto">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Royalty %</Label>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  Terr: {territoryRoyaltyPct}%
                </Badge>
                <Input
                  type="number"
                  value={royaltyOverride}
                  placeholder={`${territoryRoyaltyPct}`}
                  onChange={(e) => setRoyaltyOverride(e.target.value)}
                  className="h-8 w-20 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payback %</Label>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  Terr: {territoryPaybackPct}%
                </Badge>
                <Input
                  type="number"
                  value={paybackOverride}
                  placeholder={`${territoryPaybackPct}`}
                  onChange={(e) => setPaybackOverride(e.target.value)}
                  className="h-8 w-20 text-sm"
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 mb-1"
              onClick={() => {
                setRoyaltyOverride("");
                setPaybackOverride("");
              }}
              title="Reset to territory values"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Results table ── */}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active packages to calculate. Add packages below to get started.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-bold whitespace-nowrap">
                    Package
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Price
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center whitespace-nowrap">
                    Photo Hrs
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center whitespace-nowrap">
                    Video Hrs
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Contractor
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Stripe
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Commission
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Royalty
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Payback
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Total Cost
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Profit
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Margin
                  </TableHead>
                  <TableHead className="text-xs font-bold text-right whitespace-nowrap">
                    Suggested ({targetMargin}%)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.price)}
                    </TableCell>
                    <TableCell className="text-center p-1">
                      <Input
                        type="number"
                        value={r.photoH}
                        onChange={(e) =>
                          setPackageHour(
                            r.id,
                            "photo",
                            Number(e.target.value) || 0,
                          )
                        }
                        className="h-7 w-14 text-xs mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center p-1">
                      <Input
                        type="number"
                        value={r.videoH}
                        onChange={(e) =>
                          setPackageHour(
                            r.id,
                            "video",
                            Number(e.target.value) || 0,
                          )
                        }
                        className="h-7 w-14 text-xs mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.contractorCost)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.stripeFee)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.commission)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.royalty)}
                    </TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      ${fmtMoney(r.payback)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold whitespace-nowrap">
                      ${fmtMoney(r.totalCost)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-bold whitespace-nowrap ${
                        r.profit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ${fmtMoney(r.profit)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-bold whitespace-nowrap ${marginColor(r.margin)}`}
                    >
                      {r.margin.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary whitespace-nowrap">
                      ${fmtMoney(r.suggestedPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
