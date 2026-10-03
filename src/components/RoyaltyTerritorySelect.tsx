import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Super-admin-only area switcher for the Royalty page.
 *
 * Lists every territory (id, name) ordered by name and lets a super admin
 * view a different area's royalty / payback / periods. Owners and managers
 * never render this — they are locked to their own territory.
 */
export function RoyaltyTerritorySelect({
  selectedId,
  onChange,
}: {
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const { data: territories = [] } = useQuery({
    queryKey: ["royalty-territory-options"],
    queryFn: api.getRoyaltyTerritories,
  });

  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">
        Area
      </Label>
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger className="w-[220px] rounded-full">
          <SelectValue placeholder="Select area" />
        </SelectTrigger>
        <SelectContent>
          {territories.map((t: any) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
