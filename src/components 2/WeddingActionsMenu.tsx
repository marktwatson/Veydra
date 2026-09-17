import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Send,
  MessageSquare,
  Music,
  RefreshCw,
  Receipt,
  Calendar,
  ArrowUpCircle,
  Wine,
  CheckCircle2,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBartendingModule } from "@/hooks/use-bartending-module";
import { api, DbWedding } from "@/lib/api";
import { CallSheetGenerator } from "@/components/CallSheetGenerator";
import {
  getBrideEmail,
  portalLinkFor,
  fillTemplate,
  copyToClipboard,
  sendPortalReminderEmail,
  sendPortalReminderSms,
  requestHighlightSongs,
  buildPaymentReceipt,
  sendDayAfterSms,
  sendBartendingUpsellSms,
} from "@/lib/wedding-actions-handlers";

export interface WeddingActionsMenuProps {
  wedding: DbWedding & Record<string, any>;
  settings: any;
  navigate: (path: string) => void;
  onChangePlan: (wedding: any) => void;
  onUpsell: (wedding: any) => void;
  onVerifyPayment: (weddingId: string, verified: boolean) => void;
  verifyPaymentPending: boolean;
  onEmailPreview: (
    data: { to: string; subject: string; html: string; recipientName: string },
    sendFn: () => Promise<void>,
  ) => void;
}

export function WeddingActionsMenu({
  wedding,
  settings,
  navigate,
  onChangePlan,
  onUpsell,
  onVerifyPayment,
  verifyPaymentPending,
  onEmailPreview,
}: WeddingActionsMenuProps) {
  const { toast } = useToast();
  const brideEmail = getBrideEmail(wedding);
  const portalLink = portalLinkFor(wedding, settings);
  const isCancelled = wedding.status?.toLowerCase() === "cancelled";
  const isUnpaidDraft = !!wedding.notes?.includes("[UNPAID_DRAFT]");
  const remainingBalance =
    (Number(wedding.total_amount) || 0) - (Number(wedding.paid_amount) || 0);
  const upsellEnabled = !!settings?.upsell_bartending_enabled;
  const bartendingModuleOn = useBartendingModule();

  const requireEmail = (msg?: string) => {
    if (!brideEmail) {
      toast({
        variant: "destructive",
        title: "No Email Found",
        description:
          msg ||
          "Please add the bride's email in the Manage > Details tab first.",
      });
      return false;
    }
    return true;
  };

  const requireUpsellConfigured = () => {
    if (!requireEmail("An email is required to look up the contact."))
      return false;
    if (!upsellEnabled) {
      toast({
        variant: "destructive",
        title: "Bartending upsell not configured",
        description:
          "Enable and configure the bartending upsell in Settings → Packages & Pricing first.",
      });
      return false;
    }
    return true;
  };

  const resendConfirmation = () => {
    if (!requireEmail()) return;
    if (
      !settings?.email_bride_welcome_template ||
      !settings?.email_bride_welcome_subject
    ) {
      toast({
        variant: "destructive",
        title: "Template Missing",
        description:
          "Please configure the Bride Welcome email template in Settings.",
      });
      return;
    }
    const subject = fillTemplate(
      settings.email_bride_welcome_subject,
      wedding,
      settings,
      portalLink,
    );
    const msg = fillTemplate(
      settings.email_bride_welcome_template,
      wedding,
      settings,
      portalLink,
    );
    onEmailPreview(
      {
        to: brideEmail!,
        subject,
        html: msg,
        recipientName: wedding.client_name,
      },
      async () => {
        await api.sendOvantaEmail(
          brideEmail!,
          subject,
          msg,
          wedding.client_name,
          true,
        );
        toast({
          title: "Email Sent!",
          description: `Confirmation Email successfully sent to ${brideEmail}`,
        });
      },
    );
  };

  const sendPaymentReceipt = () => {
    if (!wedding.client_email) {
      toast({
        title: "No Email",
        description: "This wedding does not have a client email.",
        variant: "destructive",
      });
      return;
    }
    const { subject, html } = buildPaymentReceipt(wedding, settings);
    onEmailPreview(
      {
        to: wedding.client_email,
        subject,
        html,
        recipientName: wedding.client_name,
      },
      async () => {
        await api.sendOvantaEmail(
          wedding.client_email,
          subject,
          html,
          wedding.client_name,
          true,
        );
        toast({
          title: "Receipt Sent",
          description: `Emailed to ${wedding.client_email}`,
        });
      },
    );
  };

  const sendBartendingUpsellEmail = () => {
    if (!requireUpsellConfigured()) return;
    const brideName = wedding.client_name || "there";
    const subject = fillTemplate(
      settings.upsell_bartending_email_subject ||
        "Add bartending to your wedding, {{bride_name}}!",
      wedding,
      settings,
      portalLink,
    );
    const html = fillTemplate(
      settings.upsell_bartending_email_template ||
        `<p>Hi ${brideName}, we now offer professional bartending for your wedding. See packages here: <a href="${portalLink}">${portalLink}</a></p>`,
      wedding,
      settings,
      portalLink,
    );
    onEmailPreview(
      { to: brideEmail!, subject, html, recipientName: wedding.client_name },
      async () => {
        await api.sendOvantaEmail(
          brideEmail!,
          subject,
          html,
          wedding.client_name,
          true,
        );
        await api.logAdminActivity(
          "Sent Bartending Upsell Email",
          `Sent bartending upsell email to ${wedding.client_name}`,
        );
        toast({
          title: "Upsell email sent",
          description: `Sent to ${brideEmail}`,
        });
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Actions
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Bride Communication
        </DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Send className="h-4 w-4 mr-2" />
            Send Portal Reminder
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => {
                  if (!requireEmail()) return;
                  sendPortalReminderEmail(
                    wedding,
                    brideEmail,
                    portalLink,
                    toast,
                  );
                }}
                className="cursor-pointer"
              >
                <Send className="h-4 w-4 mr-2" /> Email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (
                    !requireEmail(
                      "An email is required to look up the contact for SMS.",
                    )
                  )
                    return;
                  sendPortalReminderSms(wedding, brideEmail, portalLink, toast);
                }}
                className="cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> SMS
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem
          onClick={() => {
            if (!requireEmail()) return;
            requestHighlightSongs(
              wedding,
              brideEmail,
              settings,
              portalLink,
              toast,
            );
          }}
          className="cursor-pointer"
        >
          <Music className="h-4 w-4 mr-2" />
          Request Highlight Songs
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={resendConfirmation}
          className="cursor-pointer"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Resend Confirmation
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={sendPaymentReceipt}
          className="cursor-pointer"
        >
          <Receipt className="h-4 w-4 mr-2" />
          Send Payment Receipt
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!requireEmail()) return;
            sendDayAfterSms(wedding, brideEmail, settings, portalLink, toast);
          }}
          className="cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Send Day-After SMS
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Payments & Packages
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onChangePlan(wedding)}
          disabled={isCancelled || remainingBalance <= 0.01 || isUnpaidDraft}
          className="cursor-pointer"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Change Payment Plan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate(`/build-proposal?upgrade=${wedding.id}`)}
          className="cursor-pointer"
        >
          <ArrowUpCircle className="h-4 w-4 mr-2" />
          Upgrade Package
        </DropdownMenuItem>
        {bartendingModuleOn && (
          <>
            <DropdownMenuItem
              onClick={() => onUpsell(wedding)}
              disabled={isCancelled || isUnpaidDraft}
              className="cursor-pointer"
            >
              <Wine className="h-4 w-4 mr-2" />
              Add Bartending Package
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Wine className="h-4 w-4 mr-2" />
                Send Bartending Upsell
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={sendBartendingUpsellEmail}
                    className="cursor-pointer"
                  >
                    <Send className="h-4 w-4 mr-2" /> Email
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (!requireUpsellConfigured()) return;
                      sendBartendingUpsellSms(
                        wedding,
                        brideEmail,
                        settings,
                        portalLink,
                        toast,
                      );
                    }}
                    className="cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" /> SMS
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </>
        )}
        <DropdownMenuItem
          onClick={() =>
            onVerifyPayment(wedding.id, !wedding.final_payment_verified)
          }
          disabled={verifyPaymentPending}
          className="cursor-pointer"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          {wedding.final_payment_verified
            ? "Unverify Final Payment"
            : "Verify Final Payment"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Links & Documents
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            copyToClipboard(
              portalLink,
              "Bride portal link copied to clipboard.",
              toast,
            )
          }
          className="cursor-pointer"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Copy Bride Portal Link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            copyToClipboard(
              `${window.location.origin}/feedback/${wedding.id}`,
              "Feedback link copied to clipboard.",
              toast,
            )
          }
          className="cursor-pointer"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Copy Feedback Link
        </DropdownMenuItem>
        <CallSheetGenerator
          weddingId={wedding.id}
          weddingName={wedding.client_name}
          trigger={
            <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
              <FileText className="h-4 w-4 mr-2" />
              Call Sheet
            </div>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
