import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Loader2, Send, Mail } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

export function ClientPrepSheetGenerator({
  weddingId,
  weddingName,
  trigger,
}: {
  weddingId: string;
  weddingName: string;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: wedding, isLoading: isLoadingWedding } = useQuery({
    queryKey: ["wedding", weddingId],
    queryFn: () => api.getPublicWedding(weddingId),
    enabled: isOpen,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
    enabled: isOpen,
  });

  const { data: settings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: api.getPortalSettings,
    enabled: isOpen,
  });

  const isLoading = isLoadingWedding || isLoadingAssignments;

  const weddingAssignments = assignments.filter(
    (a: any) =>
      a.jobs?.weddings?.id === weddingId &&
      [
        "upcoming",
        "accepted",
        "confirmed",
        "assigned",
        "action required",
      ].includes(String(a.status || "").toLowerCase()),
  );

  // Calculate max hours from all jobs associated with the wedding
  const maxHours =
    wedding?.jobs?.reduce((max: number, job: any) => {
      return job.hours && job.hours > max ? job.hours : max;
    }, 0) || 0;

  const getEmailContent = () => {
    const portalUrl = `${window.location.origin}/bride-portal/${weddingId}`;

    let teamHtml = "";
    if (weddingAssignments.length > 0) {
      teamHtml = `
        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #374151;">Your Assigned Team</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${weddingAssignments
              .map(
                (a: any) => `
              <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                <strong>${a.jobs?.role}:</strong> ${a.contractors?.first_name} ${a.contractors?.last_name}
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    } else {
      teamHtml = `<p style="font-style: italic; color: #6b7280;">Your team details are being finalized and will be updated in your portal soon.</p>`;
    }

    const companyName = settings?.company_name || "Honeysuckle Haus";

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #111827;">Hello ${wedding?.client_name},</h2>
        <p>We are honored to be part of your special day!</p>
        <p>As your wedding approaches, we wanted to share a few important details to make sure everything runs smoothly.</p>
        
        <div style="margin: 25px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Event Overview</h3>
          <p><strong>Date:</strong> ${wedding?.date ? formatDisplayDate(wedding?.date) : "TBD"}</p>
          <p><strong>Location:</strong> ${wedding?.location || "TBD"}</p>
          ${maxHours > 0 ? `<p><strong>Coverage:</strong> ${maxHours} Hours</p>` : ""}
        </div>

        ${teamHtml}

        <div style="margin-top: 30px; text-align: center;">
          <a href="${portalUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Access Your Client Portal
          </a>
        </div>

        <p style="margin-top: 30px;">If you have any questions, please don't hesitate to reach out. We can't wait to celebrate with you!</p>
        
        <p style="margin-top: 40px; color: #6b7280; font-size: 14px;">
          Warmly,<br>
          <strong>${user?.name || "The Manager"}</strong><br>
          ${companyName}<br>
          ${user?.email ? `<a href="mailto:${user.email}" style="color: #4f46e5;">${user.email}</a>` : ""}
        </p>
      </div>
    `;
  };

  const handleSendTest = async () => {
    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "No Email Found",
        description: "Could not find your email address to send the test.",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const subject = `Test: Client Prep Sheet - ${wedding?.client_name}`;
      await api.sendOvantaEmail(
        user.email,
        subject,
        getEmailContent(),
        "Manager",
        true,
      );

      toast({
        title: "Test Email Sent",
        description: `A preview has been sent to ${user.email}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send test",
        description: error.message || "An error occurred while sending.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendToClient = async () => {
    const clientEmail =
      wedding?.client_email || wedding?.questionnaire_data?.contact_info?.email;

    if (!clientEmail) {
      toast({
        variant: "destructive",
        title: "No Client Email",
        description: "Could not find an email address for this client.",
      });
      return;
    }

    setIsSending(true);
    try {
      const subject = `Getting Ready for Your Big Day! - ${settings?.company_name || "Honeysuckle Haus"}`;
      await api.sendOvantaEmail(
        clientEmail,
        subject,
        getEmailContent(),
        wedding?.client_name || "Client",
        true,
      );

      toast({
        title: "Prep Sheet Sent!",
        description: `Successfully sent to ${clientEmail}.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: error.message || "An error occurred while sending.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            Client Prep Sheet
          </DropdownMenuItem>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Client Prep Sheet</DialogTitle>
          <DialogDescription>
            Preview and send the pre-wedding prep sheet to the client.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !wedding ? (
          <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
            Wedding not found.
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 bg-muted/30 rounded-md border p-4">
              <div
                className="bg-card p-6 rounded-lg shadow-sm border"
                dangerouslySetInnerHTML={{ __html: getEmailContent() }}
              />
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 mt-2">
              <Button
                variant="outline"
                onClick={handleSendTest}
                disabled={isSendingTest}
              >
                {isSendingTest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Test to Me
              </Button>
              <Button onClick={handleSendToClient} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Email to Client
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
