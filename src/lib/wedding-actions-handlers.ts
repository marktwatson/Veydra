import { api, DbWedding } from "@/lib/api";
import { generateHTMLReceipt, DEFAULT_LOGO_URL } from "@/lib/utils";
import type { useToast } from "@/hooks/use-toast";

type Toast = ReturnType<typeof useToast>["toast"];

export function getBrideEmail(wedding: any): string | undefined {
  return (
    wedding.client_email ||
    wedding.questionnaire_data?.contact_info?.email ||
    wedding.questionnaire_data?.email ||
    wedding.notes?.match(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/,
    )?.[1]
  );
}

export function portalLinkFor(wedding: any, settings: any) {
  const appUrl = (settings?.app_url || window.location.origin).replace(
    /\/$/,
    "",
  );
  return `${appUrl}/bride-portal/${wedding.id}`;
}

export function fillTemplate(
  template: string,
  wedding: any,
  settings: any,
  portalLink: string,
) {
  return template
    .replace(/{{company_name}}/g, settings?.company_name || "us")
    .replace(/{{logo_url}}/g, settings?.logo_url || DEFAULT_LOGO_URL)
    .replace(/{{bride_name}}/g, wedding.client_name || "Bride")
    .replace(/{{portal_link}}/g, portalLink);
}

export function copyToClipboard(
  link: string,
  successMsg: string,
  toast: Toast,
) {
  const fallbackCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = link;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      toast({ title: "Link Copied!", description: successMsg });
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy link automatically.",
      });
    }
    document.body.removeChild(textArea);
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(link)
        .then(() => toast({ title: "Link Copied!", description: successMsg }))
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  } catch {
    fallbackCopy();
  }
}

export async function sendPortalReminderEmail(
  wedding: any,
  brideEmail: string | undefined,
  portalLink: string,
  toast: Toast,
) {
  const subject = "Please complete your wedding questionnaire";
  const msg = `Hi ${wedding.client_name.split(" ")[0]},<br><br>Please fill out your wedding details and timeline questionnaire here: <a href="${portalLink}">${portalLink}</a><br><br>Thank you!`;
  toast({
    title: "Sending Reminder...",
    description: `Sending email to ${brideEmail}`,
  });
  try {
    await api.sendOvantaEmail(
      brideEmail!,
      subject,
      msg,
      wedding.client_name,
      true,
    );
    toast({
      title: "Reminder Sent!",
      description: `Email successfully sent to ${brideEmail}`,
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "Failed to send",
      description: err.message,
    });
  }
}

export async function sendPortalReminderSms(
  wedding: any,
  brideEmail: string | undefined,
  portalLink: string,
  toast: Toast,
) {
  const smsMsg = `Hi ${wedding.client_name.split(" ")[0]}! Please complete your wedding details and timeline questionnaire here: ${portalLink}`;
  toast({
    title: "Sending SMS Reminder...",
    description: `Sending SMS to ${brideEmail}`,
  });
  try {
    await api.sendOvantaSms(brideEmail!, smsMsg, wedding.client_name, true);
    toast({
      title: "SMS Reminder Sent!",
      description: `SMS successfully sent to ${brideEmail}`,
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "SMS Failed",
      description: err.message,
    });
  }
}

export async function requestHighlightSongs(
  wedding: any,
  brideEmail: string | undefined,
  settings: any,
  portalLink: string,
  toast: Toast,
) {
  let sentAny = false;
  if (
    settings?.email_bride_songs_enabled &&
    settings?.email_bride_songs_template &&
    settings?.email_bride_songs_subject
  ) {
    const subject = fillTemplate(
      settings.email_bride_songs_subject,
      wedding,
      settings,
      portalLink,
    );
    const msg = fillTemplate(
      settings.email_bride_songs_template,
      wedding,
      settings,
      portalLink,
    );
    toast({
      title: "Sending...",
      description: `Sending song request email to ${brideEmail}`,
    });
    try {
      await api.sendOvantaEmail(
        brideEmail!,
        subject,
        msg,
        wedding.client_name,
        true,
      );
      sentAny = true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Email failed",
        description: err.message,
      });
    }
  }
  if (settings?.sms_bride_songs_enabled && settings?.sms_bride_songs_template) {
    const smsMsg = fillTemplate(
      settings.sms_bride_songs_template,
      wedding,
      settings,
      portalLink,
    );
    try {
      await api.sendOvantaSms(brideEmail!, smsMsg, wedding.client_name, true);
      sentAny = true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "SMS failed",
        description: err.message,
      });
    }
  }
  if (
    !settings?.email_bride_songs_enabled &&
    !settings?.sms_bride_songs_enabled
  ) {
    const subject = "Pick Your Highlight Video Songs!";
    const msg = `Hi ${wedding.client_name.split(" ")[0]},<br><br>We need your song choices for your wedding highlight video! Please visit your portal to add your songs:<br><br><a href="${portalLink}" style="display:inline-block;padding:12px 28px;background:#0a0a1a;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Choose Your Songs</a><br><br>You can add the song title, artist, and a link (Spotify, YouTube, etc.) so our editors know exactly which version to use.<br><br>Thank you!`;
    toast({
      title: "Sending...",
      description: `Sending song request to ${brideEmail}`,
    });
    try {
      await api.sendOvantaEmail(
        brideEmail!,
        subject,
        msg,
        wedding.client_name,
        true,
      );
      sentAny = true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to send",
        description: err.message,
      });
    }
  }
  if (sentAny) {
    await api.markSongsReminderSent(wedding.id).catch(() => {});
    toast({
      title: "Song Request Sent!",
      description: `Sent to ${brideEmail}`,
    });
  }
}

export function buildPaymentReceipt(wedding: any, settings: any) {
  const companyName = settings?.company_name || "Veydra";
  const receiptHtml = generateHTMLReceipt(
    companyName,
    wedding.client_name,
    wedding.paid_amount || 0,
    wedding.payment_plan || "full",
    wedding.package || "Custom",
    Array.isArray(wedding.addons) ? wedding.addons : [],
    wedding.total_amount || 0,
  );
  return { subject: `Payment Receipt - ${companyName}`, html: receiptHtml };
}

export async function sendDayAfterSms(
  wedding: any,
  brideEmail: string | undefined,
  settings: any,
  portalLink: string,
  toast: Toast,
) {
  if (!settings?.sms_bride_day_after_template) {
    toast({
      variant: "destructive",
      title: "Template Missing",
      description: "Please configure the Day After SMS template in Settings.",
    });
    return;
  }
  const msg = fillTemplate(
    settings.sms_bride_day_after_template,
    wedding,
    settings,
    portalLink,
  );
  toast({
    title: "Sending SMS...",
    description: `Sending Day After SMS to ${brideEmail}`,
  });
  try {
    await api.sendOvantaSms(brideEmail!, msg, wedding.client_name, true);
    toast({
      title: "SMS Sent!",
      description: `Day After SMS successfully sent to ${brideEmail}`,
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "Failed to send",
      description: err.message,
    });
  }
}

export async function sendBartendingUpsellSms(
  wedding: any,
  brideEmail: string | undefined,
  settings: any,
  portalLink: string,
  toast: Toast,
) {
  const brideName = wedding.client_name || "there";
  const msg = fillTemplate(
    settings.upsell_bartending_sms_template ||
      `Hi ${brideName}! Add pro bartending to your wedding — see packages here: ${portalLink}`,
    wedding,
    settings,
    portalLink,
  );
  toast({
    title: "Sending SMS...",
    description: `Sending bartending upsell SMS to ${brideEmail}`,
  });
  try {
    await api.sendOvantaSms(brideEmail!, msg, wedding.client_name, true);
    await api.logAdminActivity(
      "Sent Bartending Upsell SMS",
      `Sent bartending upsell SMS to ${wedding.client_name}`,
    );
    toast({
      title: "SMS Sent!",
      description: `Bartending upsell SMS sent to ${brideEmail}`,
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "SMS Failed",
      description: err.message,
    });
  }
}
