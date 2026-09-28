import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SLUG_RE = /^[a-z0-9-]+$/;
const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface AddAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (t: {
    name: string;
    slug: string;
    royalty_percentage: number;
    payback_percentage: number;
    purchase_price: number;
    remaining_balance: number;
    processing_day_of_week: number;
  }) => void;
  pending: boolean;
}

export function AddAreaDialog({
  open,
  onOpenChange,
  onAdd,
  pending,
}: AddAreaDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [royalty, setRoyalty] = useState("");
  const [payback, setPayback] = useState("");
  const [purchase, setPurchase] = useState("");
  const [remaining, setRemaining] = useState("");
  const [processingDay, setProcessingDay] = useState("5");

  const slugValid = slug.length > 0 && SLUG_RE.test(slug);
  const nameValid = name.trim().length > 0;
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);

  const reset = () => {
    setName("");
    setSlug("");
    setRoyalty("");
    setPayback("");
    setPurchase("");
    setRemaining("");
    setProcessingDay("5");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Area</DialogTitle>
          <DialogDescription>
            Add a new area to this database. Same app, same Supabase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="area-name">Name</Label>
            <Input
              id="area-name"
              placeholder="e.g. Nashville, TN"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-slug">Slug</Label>
            <Input
              id="area-slug"
              placeholder="nashville-tn"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className={
                !slugValid && slug.length > 0 ? "border-destructive" : ""
              }
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only. Used for{" "}
              <code>/apply/{slug || "{slug}"}</code>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="area-royalty">Royalty %</Label>
              <Input
                id="area-royalty"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={royalty}
                onChange={(e) => setRoyalty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-payback">Payback %</Label>
              <Input
                id="area-payback"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={payback}
                onChange={(e) => setPayback(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="area-purchase">Purchase Price</Label>
              <Input
                id="area-purchase"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-remaining">Remaining Balance</Label>
              <Input
                id="area-remaining"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Processing Day of Week</Label>
            <Select value={processingDay} onValueChange={setProcessingDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!nameValid || !slugValid || pending}
            onClick={() =>
              onAdd({
                name: name.trim(),
                slug: slug.trim(),
                royalty_percentage: num(royalty),
                payback_percentage: num(payback),
                purchase_price: num(purchase),
                remaining_balance: num(remaining),
                processing_day_of_week: Number(processingDay) || 5,
              })
            }
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Kept (unused by Areas page now) so legacy imports do not break.
export function AddTerritoryDialog() {
  return null;
}
export function TokenDialog() {
  return null;
}
