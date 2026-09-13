import { sendOvantaEmail, sendOvantaSms } from "@/lib/api";
import { DEFAULT_LOGO_URL } from "@/lib/utils";

interface PortalSettingsLike {
  app_url?: string | null;
  company_name?: string | null;
  logo_url?: string | null;
  email_pipeline_rejected_enabled?: boolean;
  email_pipeline_rejected_subject?: string;
  email_pipeline_rejected_template?: string;
  sms_pipeline_rejected_enabled?: boolean;
  sms_pipeline_rejected_template?: string;
  email_applicant_welcome_enabled?: boolean;
  email_applicant_welcome_subject?: string;
  email_applicant_welcome_template?: string;
  sms_applicant_welcome_enabled?: boolean;
  sms_applicant_welcome_template?: string;
}

interface SendArgs {
  portalSettings: PortalSettingsLike;
  isRejected: boolean;
  firstName: string;
  email: string;
  companyName: string;
  logoUrl?: string | null;
}

/**
 * Sends the applicant welcome (or rejection) email + SMS based on the
 * portal settings. Errors are swallowed (logged) so a delivery failure
 * never blocks a successful application submission.
 */
export async function sendApplicantNotifications({
  portalSettings,
  isRejected,
  firstName,
  email,
  companyName,
  logoUrl,
}: SendArgs): Promise<void> {
  try {
    const appUrl = (portalSettings?.app_url || window.location.origin).replace(
      /\/$/,
      "",
    );

    if (isRejected) {
      if (
        portalSettings?.email_pipeline_rejected_enabled &&
        portalSettings?.email_pipeline_rejected_template
      ) {
        const subject = (
          portalSettings.email_pipeline_rejected_subject || "Application Update"
        )
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName);

        const content = portalSettings.email_pipeline_rejected_template
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{logo_url}}/g, logoUrl || DEFAULT_LOGO_URL)
          .replace(/{{contractor_name}}/g, firstName)
          .replace(/{{portal_link}}/g, appUrl);

        await sendOvantaEmail(email, subject, content);
      }
      if (
        portalSettings?.sms_pipeline_rejected_enabled &&
        portalSettings?.sms_pipeline_rejected_template
      ) {
        const message = portalSettings.sms_pipeline_rejected_template
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName)
          .replace(/{{portal_link}}/g, appUrl);

        await sendOvantaSms(email, message);
      }
    } else {
      if (
        portalSettings?.email_applicant_welcome_enabled &&
        portalSettings?.email_applicant_welcome_template
      ) {
        const subject = (
          portalSettings.email_applicant_welcome_subject ||
          "Application Received!"
        )
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName);

        const content = portalSettings.email_applicant_welcome_template
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{logo_url}}/g, logoUrl || DEFAULT_LOGO_URL)
          .replace(/{{contractor_name}}/g, firstName)
          .replace(/{{portal_link}}/g, appUrl);

        await sendOvantaEmail(email, subject, content);
      }

      if (
        portalSettings?.sms_applicant_welcome_enabled &&
        portalSettings?.sms_applicant_welcome_template
      ) {
        const message = portalSettings.sms_applicant_welcome_template
          .replace(/{{company_name}}/g, companyName)
          .replace(/{{contractor_name}}/g, firstName)
          .replace(/{{portal_link}}/g, appUrl);

        await sendOvantaSms(email, message);
      }
    }
  } catch (e) {
    console.error("Failed to send welcome/rejected email:", e);
  }
}
