import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink, Search } from "lucide-react";
import { publicListProposals } from "@/lib/public-list-proposals-api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  slug: string;
  /** True when the area has a sales PIN configured. The PIN VALUE is never
   *  passed to the browser; verification happens server-side. */
  areaHasPin?: boolean;
}

const statusLabel = (s: string | null) => {
  if (!s) return "Draft";
  if (s === "draft") return "Draft";
  if (s === "sent") return "Sent";
  if (s === "accepted" || s === "paid" || s === "upcoming") return "Booked";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function PublicBuilderMyProposals({ slug, areaHasPin }: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["public-builder-mine", slug, query, pin],
    queryFn: () =>
      publicListProposals({
        slug,
        salespersonEmail: query,
        pin: pin || undefined,
      }),
    enabled: false,
  });

  const handleLoad = async () => {
    if (!email.trim()) {
      toast({
        title: "Your email required",
        description: "Enter the email you used when building proposals.",
        variant: "destructive",
      });
      return;
    }
    if (areaHasPin && !pin.trim()) {
      toast({
        title: "Area PIN required",
        description: "This area requires a PIN to view proposals.",
        variant: "destructive",
      });
      return;
    }
    setQuery(email.trim().toLowerCase());
    await refetch();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Proposals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the email you used when building proposals to see the ones
            you've created for this area.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Your Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            {areaHasPin && (
              <div className="space-y-2">
                <Label>Area PIN *</Label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter the PIN for this area"
                />
              </div>
            )}
          </div>
          <Button onClick={handleLoad} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Load my proposals
          </Button>
        </CardContent>
      </Card>

      {data && data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {data.length} proposal{data.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.map((p) => (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">
                    {p.client_name || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.wedding_date
                      ? new Date(p.wedding_date).toLocaleDateString()
                      : "No date"}{" "}
                    · ${p.total_amount.toLocaleString()} ·{" "}
                    {statusLabel(p.status)}
                  </div>
                  {p.sent_at && (
                    <div className="text-xs text-muted-foreground">
                      Sent {new Date(p.sent_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(p.link, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No proposals found for that email in this area.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
