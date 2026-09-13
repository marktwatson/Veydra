import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export interface Installment {
  date: string;
  amount: number;
  label?: string;
}

export function InstallmentEditor({
  installments,
  onChange,
  minDate,
}: {
  installments: Installment[];
  onChange: (next: Installment[]) => void;
  minDate: string;
}) {
  const update = (idx: number, field: "date" | "amount", val: any) => {
    const next = [...installments];
    next[idx] = { ...next[idx], [field]: val };
    onChange(next);
  };
  const remove = (idx: number) =>
    onChange(installments.filter((_, i) => i !== idx));
  const add = () => onChange([...installments, { date: "", amount: 0 }]);

  return (
    <div className="space-y-2">
      {installments.map((inst, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            type="date"
            value={inst.date}
            min={minDate}
            onChange={(e) => update(idx, "date", e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            step="0.01"
            value={inst.amount || ""}
            onChange={(e) =>
              update(idx, "amount", parseFloat(e.target.value) || 0)
            }
            placeholder="Amount"
            className="w-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => remove(idx)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Installment
      </Button>
    </div>
  );
}
