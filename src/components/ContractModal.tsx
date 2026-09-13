import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer, Loader2, Save } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";

interface ContractModalProps {
  wedding: any;
  trigger?: React.ReactNode;
  showSaveSnapshot?: boolean;
}

export function ContractModal({
  wedding,
  trigger,
  showSaveSnapshot = false,
}: ContractModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
    enabled: isOpen,
  });

  const companyName = settings?.company_name || "Honeysuckle Haus";
  const companyState = (settings as any)?.state || "Tennessee";

  const contractDate = wedding?.contract_date
    ? formatDisplayDate(wedding.contract_date)
    : formatDisplayDate(wedding?.created_at || new Date().toISOString());

  const handleDownloadPdf = async () => {
    if (!contractRef.current) return;
    setIsGeneratingPdf(true);

    const element = contractRef.current;
    const originalMaxHeight = element.style.maxHeight;
    const originalOverflow = element.style.overflow;

    element.style.maxHeight = "none";
    element.style.overflow = "visible";

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();

        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();
        }
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(
        `${wedding?.client_name?.replace(/\s+/g, "_") || "Wedding"}_Contract.pdf`,
      );
      toast({
        title: "PDF Downloaded",
        description: "The contract PDF has been saved.",
      });
    } catch (error) {
      console.error("Error generating PDF", error);
      toast({
        variant: "destructive",
        title: "PDF Error",
        description: "Failed to generate contract PDF.",
      });
    } finally {
      element.style.maxHeight = originalMaxHeight || "";
      element.style.overflow = originalOverflow || "";
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    if (!contractRef.current) return;
    const printContent = contractRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      toast({
        variant: "destructive",
        title: "Print Blocked",
        description: "Please allow popups to print the contract.",
      });
      return;
    }

    const title = (wedding?.client_name || "Wedding") + " - Agreement";
    printWindow.document.write(
      "<!DOCTYPE html><html><head><title>" +
        title +
        "</title><style>" +
        "body { font-family: Georgia, serif; line-height: 1.7; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }" +
        "h2 { font-size: 22px; text-align: center; margin-bottom: 4px; }" +
        "h3 { font-size: 16px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }" +
        "p { margin: 12px 0; font-size: 14px; }" +
        "ul { font-size: 14px; padding-left: 20px; }" +
        ".signature-box { margin-top: 40px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; }" +
        "@media print { body { padding: 0; } @page { margin: 20mm; } }" +
        "</style></head><body>" +
        printContent +
        "<script>window.onload=function(){window.print();window.close();}</script></body></html>",
    );
    printWindow.document.close();
  };

  const handleSaveSnapshot = async () => {
    if (!contractRef.current || !wedding?.id) return;
    setIsSavingSnapshot(true);
    try {
      const html = contractRef.current.innerHTML;
      const { error } = await supabase
        .from("weddings")
        .update({ contract_snapshot: html })
        .eq("id", wedding.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["weddings"] });
      toast({
        title: "Snapshot Saved",
        description:
          "Contract snapshot saved to this wedding. It will be preserved even if the template changes.",
      });
    } catch (error: any) {
      console.error("Error saving contract snapshot:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save the contract snapshot.",
      });
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1.5" />
            Contract
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 pr-6">
          <div>
            <DialogTitle className="text-xl font-serif">
              Wedding Service Agreement
            </DialogTitle>
            <DialogDescription>
              Signed contract for {wedding?.client_name}.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {showSaveSnapshot && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSnapshot}
                disabled={isSavingSnapshot}
                className="gap-1.5"
              >
                {isSavingSnapshot ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isSavingSnapshot ? "Saving..." : "Save Snapshot"}
                </span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="gap-1.5"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isGeneratingPdf ? "Saving..." : "Download PDF"}
              </span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-2">
          <div
            ref={contractRef}
            className="border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-10 bg-white dark:bg-stone-900/40 text-sm space-y-6 contract-content text-stone-900 dark:text-stone-100 shadow-sm"
          >
            {wedding?.contract_snapshot ? (
              <div
                dangerouslySetInnerHTML={{ __html: wedding.contract_snapshot }}
              />
            ) : (
              <>
                <h2 className="text-2xl font-serif text-center mb-1 text-stone-900 dark:text-stone-50 font-bold">
                  Wedding Photography & Videography Agreement
                </h2>
                <p className="text-center text-stone-500 dark:text-stone-400 font-light mb-6">
                  ({companyName} — {companyState})
                </p>

                <p>
                  This Wedding Agreement ("Agreement") is entered into on{" "}
                  <strong>{contractDate}</strong> by and between:
                </p>
                <p>
                  <strong>Client(s):</strong> {wedding?.client_name}{" "}
                  {wedding?.partner_name ? `& ${wedding.partner_name}` : ""}
                </p>
                <p>
                  <strong>Service Provider:</strong> {companyName}, an
                  independently owned and operated limited liability company
                  based in {companyState} ("Photographer/Videographer").
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  1. Services
                </h3>
                <p>
                  {companyName} agrees to provide professional wedding
                  photography and/or videography services for the Client's event
                  as follows:
                </p>
                <p>
                  <strong>Wedding Date:</strong>{" "}
                  {wedding?.date ? formatDisplayDate(wedding.date) : "TBD"}
                </p>
                <p>
                  <strong>Venue:</strong> {wedding?.location || "TBD"}
                </p>
                <p>
                  <strong>Package Booked:</strong>{" "}
                  {wedding?.package || "Custom Package"}
                </p>
                {wedding?.addons &&
                  (Array.isArray(wedding.addons)
                    ? wedding.addons.length > 0
                    : true) && (
                    <p>
                      <strong>Add-ons:</strong>{" "}
                      {Array.isArray(wedding.addons)
                        ? wedding.addons.join(", ")
                        : wedding.addons}
                    </p>
                  )}
                <p>
                  <strong>Assigned Team:</strong>{" "}
                  {wedding?.package?.toLowerCase().includes("photo only")
                    ? "1 Photographer"
                    : wedding?.package?.toLowerCase().includes("video only")
                      ? "1 Videographer"
                      : "1 Photographer + 1 Videographer"}{" "}
                  (unless otherwise noted)
                </p>
                <p>
                  {companyName} reserves the right to assign qualified creative
                  professionals from its trusted network to ensure timely,
                  high-quality coverage.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  2. Deliverables
                </h3>
                <p>
                  The Photographer/Videographer agrees to deliver the following:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 mt-2">
                  {!wedding?.package?.toLowerCase().includes("video only") && (
                    <li>Professionally edited digital photo gallery</li>
                  )}
                  {!wedding?.package?.toLowerCase().includes("photo only") && (
                    <li>
                      Edited wedding film (highlight + optional documentary/full
                      ceremony edits, depending on package)
                    </li>
                  )}
                </ul>
                <p className="mt-3">
                  <strong>Delivery Timeline:</strong> Within approximately 3–4
                  weeks following the wedding date. During high-volume months
                  (such as October), timelines may extend slightly to maintain
                  editing quality.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  3. Payment Terms
                </h3>
                <p>
                  <strong>Total Investment:</strong> $
                  {(wedding?.total_amount || 0).toLocaleString()}
                </p>

                <p>
                  <strong>Retainer (Non-Refundable):</strong> $
                  {((wedding?.total_amount || 0) / 2).toLocaleString()} due upon
                  signing to reserve your wedding date. The retainer is 50% of
                  the contract value.
                </p>

                <p>
                  <strong>Remaining Balance:</strong> Due no later than 10 days
                  before the wedding date.
                </p>
                <p>
                  <strong>Accepted Payments:</strong> Credit Card only
                  (processed securely through {companyName}'s online payment
                  system).
                </p>
                <p>
                  Payments made via credit card include standard merchant
                  processing fees, which are built into the total investment.
                  <br />
                  Cash, check, or alternative payment methods are not accepted.
                </p>
                <p>
                  Failure to make timely payments may result in suspension or
                  cancellation of services and forfeiture of the retainer.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  4. Rescheduling & Cancellation
                </h3>
                <p>
                  <strong>Rescheduling:</strong> The retainer may be applied to
                  a new wedding date, subject to availability.
                </p>
                <p>
                  <strong>Cancellation:</strong> The retainer is non-refundable.
                  Any additional payments made beyond the retainer will be
                  refunded if cancellation occurs.
                </p>
                <p>
                  If {companyName} must cancel due to emergency or unforeseen
                  circumstances, all payments made by the Client will be
                  refunded in full, and best efforts will be made to assist in
                  finding an alternate provider.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  5. Creative Rights
                </h3>
                <p>
                  The Client acknowledges that {companyName} maintains complete
                  creative control over style, editing, and artistic decisions.
                  The Client has reviewed the company's portfolio and
                  understands the creative nature of the work.
                </p>
                <p>
                  All photographs and videos remain the copyrighted property of{" "}
                  {companyName}, which grants the Client a perpetual,
                  non-exclusive, personal-use license to download, print, share,
                  and display the media for personal use.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  6. Substitutions & Liability
                </h3>
                <p>
                  If a scheduled Photographer or Videographer is unable to
                  attend due to illness, emergency, or unforeseen event,{" "}
                  {companyName} will provide a qualified replacement whenever
                  possible.
                </p>
                <p>
                  {companyName} is not responsible for circumstances beyond
                  reasonable control (e.g., weather, equipment failure, venue
                  restrictions, or interference by guests).
                  <br />
                  Liability is limited to the return of all payments received.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  7. Client Cooperation
                </h3>
                <p>
                  {companyName} agrees to provide a safe and cooperative
                  environment for all team members. The Client understands that
                  full cooperation—including adherence to schedules,
                  communication, and participation from key individuals—directly
                  impacts the final quality of results.
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  8. Model Release
                </h3>
                <p>
                  The Client grants {companyName} permission to use images
                  and/or video clips from the event for portfolio, social media,
                  website, and promotional use.
                  <br />
                  (Optional: Clients may request in writing to opt out prior to
                  the wedding date.)
                </p>

                <h3 className="text-lg font-serif font-semibold mt-6 border-b pb-1">
                  9. Entire Agreement
                </h3>
                <p>
                  This Agreement represents the full understanding between the
                  Client and {companyName}. Any modifications or additions must
                  be made in writing and signed by both parties.
                </p>

                <div className="mt-10 pt-6 border-t border-stone-200 dark:border-stone-800 flex justify-between items-end">
                  <div>
                    <p className="text-xs text-stone-500 mb-1">
                      Client(s) Signature:
                    </p>
                    <p className="text-xl font-serif italic text-stone-900 dark:text-stone-50 font-bold">
                      {wedding?.client_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500 mb-1">Signed Date:</p>
                    <p className="text-sm font-medium">{contractDate}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
