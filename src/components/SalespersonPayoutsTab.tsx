import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";
import {
  healSalespersonPayoutSchema,
  healSalespersonPaymentInfo,
  getSalespersonPaymentNotes,
  saveSalespersonPaymentNote,
  getSalespersonSendFees,
  getSalespersonPayoutBatches,
  markSalespersonPaid,
  feeFor,
  DEFAULT_SALESPERSON_SEND_FEE,
  type SalespersonPayoutBatch,
} from "@/lib/salesperson-payouts";

interface OwedRep {
  email: string;
  name: string;
  count: number;
  amount: number;
  proposalIds: string[];
  clientNames: string[];
}

/**
 * Payouts page → "Sales reps" tab. Shows one pending row per salesperson with
 * owed send-fees (first-send only) and a paid-batch history. Staff-only; not
 * visible to contractors or the public builder. Reuses the same idempotent
 * mark-paid path as the Sales Reps page.
 */
interface DirectoryRep {
  email: string;
  name: string;
}

export function SalespersonPayoutsTab() {
  const { toast } = useToast();
  const [reps, setReps] = useState<OwedRep[]>([]);
  const [batches, setBatches] = useState<SalespersonPayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeByTerritory, setFeeByTerritory] = useState<Map<string, number>>(
    new Map(),
  );
  const [confirmRep, setConfirmRep] = useState<OwedRep | null>(null);
  const [paying, setPaying] = useState(false);
  const [territoryId, setTerritoryId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryRep[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    await healSalespersonPayoutSchema();
    await healSalespersonPaymentInfo();
    const territoryId = await currentTerritoryId();
    setTerritoryId(territoryId);

    // Sent salesperson proposals, scoped to the active area.
    let q = supabase
      .from("proposals")
      .select(
        "id, salesperson_email, salesperson_name, salesperson_paid_at, territory_id, client_name, sent_at",
      )
      .not("salesperson_email", "is", null)
      .not("sent_at", "is", null);
    if (territoryId) q = q.eq("territory_id", territoryId);
    const { data: proposals } = await q.order("created_at", {
      ascending: false,
    });

    const feeMap = await getSalespersonSendFees(
      (proposals || []).map((p: any) => p.territory_id),
    );
    setFeeByTerritory(feeMap);

    // Group owed (unpaid sent) per salesperson.
    const map = new Map<string, OwedRep>();
    for (const p of proposals || []) {
      const email = (p.salesperson_email || "").trim().toLowerCase();
      if (!email) continue;
      if (p.salesperson_paid_at) continue; // already paid
      const name = (p.salesperson_name || "").trim() || email;
      const fee = feeFor(feeMap, p.territory_id);
      let row = map.get(email);
      if (!row) {
        row = {
          email,
          name,
          count: 0,
          amount: 0,
          proposalIds: [],
          clientNames: [],
        };
        map.set(email, row);
      }
      row.count += 1;
      row.amount += fee;
      row.proposalIds.push(p.id);
      if (p.client_name) row.clientNames.push(p.client_name);
    }
    setReps(Array.from(map.values()).sort((a, b) => b.amount - a.amount));

    const people = new Map<string, string>();
    let peopleQuery = supabase
      .from("proposals")
      .select("salesperson_email, salesperson_name")
      .not("salesperson_email", "is", null);
    if (territoryId) peopleQuery = peopleQuery.eq("territory_id", territoryId);
    const { data: peopleRows } = await peopleQuery;
    for (const row of peopleRows || []) {
      const email = String(row.salesperson_email || "").trim().toLowerCase();
      if (!email) continue;
      if (!people.has(email)) {
        people.set(email, String(row.salesperson_name || "").trim() || email);
      }
    }
    setDirectory(
      Array.from(people.entries())
        .map(([email, name]) => ({ email, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );

    const savedNotes: Record<string, string> = {};
    if (territoryId) {
      const noteRows = await getSalespersonPaymentNotes(territoryId);
      for (const row of noteRows) {
        const email = String(row.email || "").trim().toLowerCase();
        if (email) savedNotes[email] = row.payment_note || "";
      }
    }
    setNotes(savedNotes);
    setDrafts(savedNotes);

    setBatches(await getSalespersonPayoutBatches());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleConfirmPay = async () => {
    if (!confirmRep) return;
    setPaying(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const res = await markSalespersonPaid({
        email: confirmRep.email,
        name: confirmRep.name,
        proposalIds: confirmRep.proposalIds,
        paidBy: user?.email || "staff",
        feeByTerritory,
      });
      if (res) {
        toast({
          title: "Sales rep paid",
          description: `Recorded $${res.amount.toLocaleString()} for ${res.count} proposal${res.count === 1 ? "" : "s"}.`,
        });
      } else {
        toast({
          title: "Nothing to pay",
          description: "These proposals were already marked paid.",
        });
      }
      setConfirmRep(null);
      await load();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to mark paid",
        description: e?.message || "Unknown error",
      });
    } finally {
      setPaying(false);
    }
  };

  const totalOwed = useMemo(
    () => reps.reduce((s, r) => s + r.amount, 0),
    [reps],
  );

  const saveNote = async (person: DirectoryRep) => {
    if (!territoryId) return;
    const next = drafts[person.email] ?? "";
    if ((notes[person.email] || "") === next) return;
    setSavingEmail(person.email);
    try {
      await saveSalespersonPaymentNote({
        territoryId,
        email: person.email,
        name: person.name,
        paymentNote: next,
      });
      setNotes((current) => ({ ...current, [person.email]: next }));
      toast({ title: "Payment info saved", description: person.name });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not save payment info",
        description: e?.message || "Unknown error",
      });
    } finally {
      setSavingEmail(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Salesperson send fee: ${DEFAULT_SALESPERSON_SEND_FEE} per first send.
        Not visible to salespeople.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Sales Rep Payouts</CardTitle>
          <CardDescription>
            Owed send-fees for proposals your salespeople have sent. First send
            only.{" "}
            {totalOwed > 0 && `Total owed: $${totalOwed.toLocaleString()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No owed salesperson payouts.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-center">Proposals</TableHead>
                  <TableHead className="text-right">Owed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((r) => (
                  <TableRow key={r.email}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {notes[r.email] || "No payment info yet"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{r.count}</TableCell>
                    <TableCell className="text-right font-bold text-green-600 dark:text-green-500">
                      ${r.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setConfirmRep(r)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark ${r.amount.toLocaleString()} paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where to pay them</CardTitle>
          <CardDescription>
            Venmo, Zelle, Cash App, or a short note. It stays on this email for
            this area and does not send the money.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!territoryId ? (
            <p className="text-sm text-muted-foreground">
              Choose one area in the area picker. Payment info is saved per
              area.
            </p>
          ) : directory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No salespeople in this area yet.
            </p>
          ) : (
            <div className="space-y-3">
              {directory.map((person) => (
                <div
                  key={person.email}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{person.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {person.email}
                    </div>
                  </div>
                  <Input
                    value={drafts[person.email] ?? ""}
                    placeholder="Venmo, Zelle email, or phone"
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [person.email]: event.target.value,
                      }))
                    }
                    onBlur={() => saveNote(person)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingEmail === person.email}
                    onClick={() => saveNote(person)}
                  >
                    {savingEmail === person.email ? "Saving" : "Save"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            Recorded salesperson payout batches, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recorded payouts yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-center">Proposals</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">
                        {b.salesperson_name || b.salesperson_email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.salesperson_email}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {b.proposal_count}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600 dark:text-green-500">
                      ${Number(b.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{b.paid_by || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.paid_at
                        ? new Date(b.paid_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmRep}
        onOpenChange={(open) => {
          if (!open) setConfirmRep(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark sales rep paid</AlertDialogTitle>
            <AlertDialogDescription>
              Record a ${confirmRep?.amount.toLocaleString()} payout for{" "}
              {confirmRep?.count} proposal
              {confirmRep?.count === 1 ? "" : "s"} sent by {confirmRep?.name} (
              {confirmRep?.email}). Not visible to the salesperson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmRep && confirmRep.clientNames.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Proposals
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {confirmRep.clientNames.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPay();
              }}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Yes, mark paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
