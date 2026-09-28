import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Territory,
  THIS_PROJECT_REF,
  THIS_SUPABASE_URL,
} from "./territories/constants";
import { TerritoriesTable } from "./territories/TerritoriesTable";
import { AddAreaDialog } from "./territories/TerritoriesDialogs";

export default function Territories() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: territories = [], isLoading } = useQuery<Territory[]>({
    queryKey: ["territories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("territories").select("*");
      if (error) throw error;
      const sorted = (data || []).sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (b.is_primary && !a.is_primary) return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      return sorted;
    },
    retry: 2,
  });

  const addTerritoryMutation = useMutation({
    mutationFn: async (t: any) => {
      const { error } = await supabase.from("territories").insert({
        name: t.name,
        slug: t.slug || null,
        project_ref: THIS_PROJECT_REF,
        supabase_url: THIS_SUPABASE_URL,
        access_token: "",
        is_primary: false,
        royalty_percentage: t.royalty_percentage ?? 0,
        payback_percentage: t.payback_percentage ?? 0,
        purchase_price: t.purchase_price ?? 0,
        remaining_balance: t.remaining_balance ?? 0,
        processing_day_of_week: t.processing_day_of_week ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
      setIsAddDialogOpen(false);
      toast.success("Area added");
    },
    onError: (e: any) =>
      toast.error("Failed to add area", { description: e.message }),
  });

  const deleteTerritoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("territories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
      toast.success("Area removed");
    },
    onError: (e: any) =>
      toast.error("Failed to delete", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Areas</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Each area is a row in this database. Same app, same Supabase.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Areas
          </CardTitle>
          <CardDescription>
            Each area is a row in this database. Same app, same Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : territories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No areas yet.</p>
              <p className="text-sm mt-1">
                Add your first area to get started.
              </p>
            </div>
          ) : (
            <TerritoriesTable
              territories={territories}
              onAdd={() => setIsAddDialogOpen(true)}
              onDelete={(id) => deleteTerritoryMutation.mutate(id)}
            />
          )}
        </CardContent>
      </Card>

      <AddAreaDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={(t) => addTerritoryMutation.mutate(t)}
        pending={addTerritoryMutation.isPending}
      />
    </div>
  );
}
