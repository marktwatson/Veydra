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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  editorInvoices: any[];
  editors: any[];
  paidIds: Set<string>;
  onApprove: (weddingId: string) => void;
  onDelete: (weddingId: string) => void;
}

/** Editor-invoices table extracted from the Payouts page so that page stays
 *  under its size limit. Pure presentational; all actions are callbacks. */
export function EditorPayoutsTable({
  editorInvoices,
  editors,
  paidIds,
  onApprove,
  onDelete,
}: Props) {
  const { toast } = useToast();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Editor</TableHead>
          <TableHead>Wedding</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {editorInvoices.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center py-8 text-muted-foreground"
            >
              No editor invoices found.
            </TableCell>
          </TableRow>
        ) : (
          editorInvoices
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            )
            .map((wedding) => {
              const editor = editors.find((e) => e.id === wedding.editor_id);
              return (
                <TableRow key={wedding.id}>
                  <TableCell className="font-medium">
                    {editor?.name || "Unknown Editor"}
                  </TableCell>
                  <TableCell>{wedding.client_name}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      {wedding.editor_invoice_details?.photoCount > 0 && (
                        <span>
                          {wedding.editor_invoice_details.photoCount} Photos
                        </span>
                      )}
                      {wedding.editor_invoice_details?.videos?.length > 0 && (
                        <span>
                          {" "}
                          • {wedding.editor_invoice_details.videos.length}{" "}
                          Videos
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        wedding.editor_invoice_status === "paid"
                          ? "default"
                          : wedding.editor_invoice_status === "approved"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {wedding.editor_invoice_status === "paid"
                        ? "Paid"
                        : wedding.editor_invoice_status === "approved"
                          ? "Approved"
                          : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600 dark:text-green-500">
                    ${wedding.editor_payout_amount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {wedding.editor_invoice_status !== "paid" && (
                        <Button
                          size="sm"
                          disabled={paidIds.has(wedding.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            if (
                              !editor?.venmo_handle &&
                              !editor?.stripe_account_id
                            ) {
                              toast({
                                title: "Payment Info Missing",
                                description:
                                  "This editor hasn't connected a Stripe account or provided a Venmo handle, but you can still record the payout if you paid them another way.",
                              });
                            }
                            onApprove(wedding.id);
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" /> Approve and
                          pay
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                            onClick={() => onDelete(wedding.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Payout
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
        )}
      </TableBody>
    </Table>
  );
}
