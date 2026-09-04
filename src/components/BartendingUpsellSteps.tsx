import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CreditCard, Tag } from "lucide-react";
import { InstallmentEditor, type Installment } from "./InstallmentEditor";

export interface BartendingAddon {
  id: string;
  name: string;
  price: number;
  description?: string;
  features?: string[];
}

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function UpsellSelectStep({
  addons,
  loading,
  selectedAddon,
  onSelect,
  onContinue,
}: {
  addons: BartendingAddon[];
  loading: boolean;
  selectedAddon: BartendingAddon | null;
  onSelect: (a: BartendingAddon) => void;
  onContinue: () => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (addons.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
        No bartending add-ons found in your catalog. Add bartending packages in
        Settings → Packages & Add-ons (toggle "Bartending upsell").
      </div>
    );
  }
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
        {addons.map((addon) => (
          <button
            key={addon.id}
            onClick={() => onSelect(addon)}
            className={`w-full text-left rounded-xl border p-4 transition-all ${selectedAddon?.id === addon.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold">{addon.name}</p>
                {addon.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {addon.description}
                  </p>
                )}
                {addon.features && addon.features.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {addon.features.slice(0, 4).map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold">{fmtMoney(addon.price)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-3 border-t mt-3 shrink-0">
        <Button onClick={onContinue} disabled={!selectedAddon}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function UpsellPlanStep({
  selectedAddon,
  listPrice,
  discount,
  totalDue,
  deposit,
  setDeposit,
  remainingAfterDeposit,
  installments,
  setInstallments,
  applyDiscount,
  setApplyDiscount,
  hasCardOnFile,
  cardLast4,
  staffNote,
  setStaffNote,
  onBack,
  onContinue,
}: {
  selectedAddon: BartendingAddon;
  listPrice: number;
  discount: number;
  totalDue: number;
  deposit: number;
  setDeposit: (v: number) => void;
  remainingAfterDeposit: number;
  installments: Installment[];
  setInstallments: (v: Installment[]) => void;
  applyDiscount: boolean;
  setApplyDiscount: (v: boolean) => void;
  hasCardOnFile: boolean;
  cardLast4: string;
  staffNote: string;
  setStaffNote: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="overflow-y-auto flex-1 space-y-4 pr-1">
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {selectedAddon.name} — list price
          </span>
          <span className="font-medium">{fmtMoney(listPrice)}</span>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyDiscount}
              onChange={(e) => setApplyDiscount(e.target.checked)}
              className="rounded border-input"
            />
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Existing Honeysuckle Haus bride discount
            </span>
          </label>
          <span className="font-medium text-destructive">
            -{fmtMoney(discount)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Total due</span>
          <span className="text-primary">{fmtMoney(totalDue)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Deposit (charge card on file now)</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          max={totalDue}
          value={deposit || ""}
          onChange={(e) =>
            setDeposit(Math.max(0, parseFloat(e.target.value) || 0))
          }
          placeholder="0.00"
          disabled={!hasCardOnFile && totalDue > 0}
        />
        <div className="flex items-center gap-2 text-xs">
          {hasCardOnFile ? (
            <Badge variant="secondary" className="gap-1">
              <CreditCard className="h-3 w-3" /> Card on file
              {cardLast4 && ` •••• ${cardLast4}`}
            </Badge>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              No card on file — deposit must be $0. Bride needs a saved card
              before you can charge.
            </span>
          )}
          {deposit >= totalDue && totalDue > 0 && (
            <Badge variant="secondary">Pay in full</Badge>
          )}
        </div>
      </div>

      {remainingAfterDeposit > 0.01 && (
        <div className="space-y-2">
          <Label className="text-xs">
            Remaining installments ({fmtMoney(remainingAfterDeposit)})
          </Label>
          <InstallmentEditor
            installments={installments}
            onChange={setInstallments}
            minDate={new Date().toISOString().split("T")[0]}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="staff-note-upsell" className="text-xs">
          Note to bride (optional, shown in contract email)
        </Label>
        <Textarea
          id="staff-note-upsell"
          value={staffNote}
          onChange={(e) => setStaffNote(e.target.value)}
          placeholder="Add a personal note about their bartending package..."
          rows={2}
        />
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue}>Review & Sign</Button>
      </div>
    </div>
  );
}

export function UpsellReviewStep({
  selectedAddon,
  listPrice,
  discount,
  totalDue,
  deposit,
  remainingAfterDeposit,
  installments,
  hasCardOnFile,
  cardLast4,
  stripeCustomerId,
  clientEmail,
  onBack,
  onSignAndPay,
}: {
  selectedAddon: BartendingAddon;
  listPrice: number;
  discount: number;
  totalDue: number;
  deposit: number;
  remainingAfterDeposit: number;
  installments: Installment[];
  hasCardOnFile: boolean;
  cardLast4: string;
  stripeCustomerId: string | null;
  clientEmail: string;
  onBack: () => void;
  onSignAndPay: () => void;
}) {
  return (
    <div className="overflow-y-auto flex-1 space-y-4 pr-1">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex justify-between font-semibold">
          <span>Package</span>
          <span>{selectedAddon.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">List price</span>
          <span>{fmtMoney(listPrice)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">HH bride discount</span>
            <span className="text-destructive">-{fmtMoney(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-medium border-t pt-2">
          <span>Total due</span>
          <span className="text-primary">{fmtMoney(totalDue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Deposit (charge now)</span>
          <span>{fmtMoney(deposit)}</span>
        </div>
        {remainingAfterDeposit > 0.01 && installments.length > 0 && (
          <div className="text-sm space-y-1 border-t pt-2">
            <p className="text-muted-foreground">Future installments:</p>
            {installments.map((inst, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {inst.date || "TBD"} — {inst.label || `Installment #${i + 1}`}
                </span>
                <span>{fmtMoney(Number(inst.amount) || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {deposit > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          {hasCardOnFile ? (
            <span>
              Charging <strong>{fmtMoney(deposit)}</strong> to card on file
              {cardLast4 && ` ending ${cardLast4}`}
              {stripeCustomerId && ` (cus_…${stripeCustomerId.slice(-6)})`}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              No card on file — deposit must be $0
            </span>
          )}
        </div>
      )}

      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-muted-foreground">
        A separate <strong>Bartending Services Agreement (placeholder)</strong>{" "}
        will be sent to {clientEmail || "the bride"}. The photography contract
        is not affected.
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onSignAndPay}
          disabled={deposit > 0 && !hasCardOnFile}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          {deposit > 0 ? "Sign & Pay" : "Sign & Add"}
        </Button>
      </div>
    </div>
  );
}
