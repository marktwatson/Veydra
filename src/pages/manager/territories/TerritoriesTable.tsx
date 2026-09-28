import { Plus, Star, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Territory } from "./constants";

interface Props {
  territories: Territory[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export function TerritoriesTable({ territories, onAdd, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Area
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Area</TableHead>
            <TableHead>Royalty %</TableHead>
            <TableHead className="text-right">Remaining Balance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {territories.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.name}
                  {t.is_primary && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
                      <Star className="h-2.5 w-2.5 mr-0.5 fill-primary" />
                      Main
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {Number(t.royalty_percentage ?? 0).toFixed(2)}%
              </TableCell>
              <TableCell className="text-right tabular-nums">
                $
                {Number(t.remaining_balance ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-7"
                  onClick={() => onDelete(t.id)}
                  disabled={t.is_primary}
                  title={
                    t.is_primary
                      ? "The main area cannot be deleted"
                      : "Delete area"
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
