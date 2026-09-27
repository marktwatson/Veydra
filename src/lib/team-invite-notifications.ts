import { api } from "./api";
import { DEFAULT_LOGO_URL } from "./utils";

type Settings = any;

/**
 * Invite / resend / reset notification bodies for the Team page.
 *
 * Extracted from src/pages/manager/Team.tsx so that file stays under the
 * edit cap. Pure logic — no React, no hooks. Returns booleans for whether
 * the SMS / email actually sent so callers can behave as before.
 */

export async function sendInviteNotifications(opts: {
  role: string;
  name: string;
  email: string;
  settings: Settings;
  baseUrl: string;
  setupUrl: string;
}): Promise<{ smsSent: boolean; emailSent: boolean }> {
  const { role, name, email, settings, setupUrl } = opts;
  let smsSent = false;
  let emailSent = false;

  if (role === "editor") {
    if (
      settings?.sms_editor_invite_enabled &&
      settings?.sms_editor_invite_template
    ) {
      const msg = settings.sms_editor_invite_template
        .replace(/{{company_name}}/g, settings.company_name || "Veydra")
        .replace(/{{editor_name}}/g, name)
        .replace(/{{setup_link}}/g, setupUrl);
      await api
        .sendOvantaSms(email, msg, name)
        .then(() => (smsSent = true))
        .catch((e) => console.error("SMS failed:", e));
    } else if (!settings?.sms_editor_invite_enabled) {
      const msg = `Hi ${name}, you've been invited as an Editor to the ${settings?.company_name || "Portal"}! Click here to set up your account: ${setupUrl}`;
      await api
        .sendOvantaSms(email, msg, name)
        .then(() => (smsSent = true))
        .catch((e) => console.error("SMS failed:", e));
    }
    if (
      settings?.email_editor_invite_enabled &&
      settings?.email_editor_invite_template
    ) {
      const subject = (
        settings.email_editor_invite_subject ||
        `You've been invited as an Editor to ${settings.company_name || "our Portal"}!`
      )
        .replace(/{{company_name}}/g, settings.company_name || "the Portal")
        .replace(/{{editor_name}}/g, name);
      const msg = settings.email_editor_invite_template
        .replace(/{{company_name}}/g, settings.company_name || "the Portal")
        .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
        .replace(/{{editor_name}}/g, name)
        .replace(/{{setup_link}}/g, setupUrl);
      await api
        .sendOvantaEmail(email, subject, msg, name)
        .then(() => (emailSent = true))
        .catch((e) => console.error("Email failed:", e));
    }
  } else {
    if (
      settings?.sms_manager_invite_enabled &&
      settings?.sms_manager_invite_template
    ) {
      const msg = settings.sms_manager_invite_template
        .replace(/{{company_name}}/g, settings.company_name || "Veydra")
        .replace(/{{manager_name}}/g, name)
        .replace(/{{setup_link}}/g, setupUrl);
      await api
        .sendOvantaSms(email, msg, name)
        .then(() => (smsSent = true))
        .catch((e) => console.error("SMS failed:", e));
    } else if (!settings?.sms_manager_invite_enabled) {
      const msg = `Hi ${name}, you've been invited as an Admin to the ${settings?.company_name || "Portal"}! Click here to set up your account: ${setupUrl}`;
      await api
        .sendOvantaSms(email, msg, name)
        .then(() => (smsSent = true))
        .catch((e) => console.error("SMS failed:", e));
    }
    if (
      settings?.email_manager_invite_enabled &&
      settings?.email_manager_invite_template
    ) {
      const subject = (
        settings.email_manager_invite_subject ||
        `You've been invited as an Admin to ${settings.company_name || "our Portal"}!`
      )
        .replace(/{{company_name}}/g, settings.company_name || "the Portal")
        .replace(/{{manager_name}}/g, name);
      const msg = settings.email_manager_invite_template
        .replace(/{{company_name}}/g, settings.company_name || "Veydra")
        .replace(/{{logo_url}}/g, settings.logo_url || DEFAULT_LOGO_URL)
        .replace(/{{manager_name}}/g, name)
        .replace(/{{setup_link}}/g, setupUrl);
      await api
        .sendOvantaEmail(email, subject, msg, name)
        .then(() => (emailSent = true))
        .catch((e) => console.error("Email failed:", e));
    }
  }

  return { smsSent, emailSent };
}

export async function sendResetNotifications(opts: {
  role: string;
  name: string;
  email: string;
  settings: Settings;
  baseUrl: string;
}): Promise<void> {
  const { role, name, email, settings, baseUrl } = opts;

  if (role === "editor") {
    if (
      settings?.sms_editor_reset_enabled &&
      settings?.sms_editor_reset_template
    ) {
      const msg = settings.sms_editor_reset_template
        .replace(/{{editor_name}}/g, name)
        .replace(/{{setup_link}}/g, `${baseUrl}/forgot-password`);
      await api
        .sendOvantaSms(email, msg, name)
        .catch((e) => console.error("SMS failed:", e));
    } else if (!settings?.sms_editor_reset_enabled) {
      await api
        .sendOvantaSms(
          email,
          `Hi there! A password reset link for your Editor account has been sent to your email (${email}). Please check your inbox!`,
          name,
        )
        .catch((e) => console.error("SMS failed:", e));
    }
    if (
      settings?.email_editor_reset_enabled &&
      settings?.email_editor_reset_template
    ) {
      const subject =
        settings.email_editor_reset_subject || "Editor Password Reset Request";
      const msg = settings.email_editor_reset_template
        .replace(/{{editor_name}}/g, name)
        .replace(/{{setup_link}}/g, `${baseUrl}/forgot-password`);
      await api
        .sendOvantaEmail(email, subject, msg, name)
        .catch((e) => console.error("Email failed:", e));
    }
  } else {
    if (
      settings?.sms_manager_reset_enabled &&
      settings?.sms_manager_reset_template
    ) {
      const msg = settings.sms_manager_reset_template
        .replace(/{{manager_name}}/g, name)
        .replace(/{{setup_link}}/g, `${baseUrl}/forgot-password`);
      await api
        .sendOvantaSms(email, msg, name)
        .catch((e) => console.error("SMS failed:", e));
    } else if (!settings?.sms_manager_reset_enabled) {
      await api
        .sendOvantaSms(
          email,
          `Hi there! A password reset link for your Admin account has been sent to your email (${email}). Please check your inbox!`,
          name,
        )
        .catch((e) => console.error("SMS failed:", e));
    }
    if (
      settings?.email_manager_reset_enabled &&
      settings?.email_manager_reset_template
    ) {
      const subject =
        settings.email_manager_reset_subject || "Admin Password Reset Request";
      const msg = settings.email_manager_reset_template
        .replace(/{{manager_name}}/g, name)
        .replace(/{{setup_link}}/g, `${baseUrl}/forgot-password`);
      await api
        .sendOvantaEmail(email, subject, msg, name)
        .catch((e) => console.error("Email failed:", e));
    }
  }
}
