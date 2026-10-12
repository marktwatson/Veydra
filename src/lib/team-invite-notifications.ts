import { api, callOvantaSend } from "./api";
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

type Settings = any;

/**
 * Invite / resend / reset notification bodies for the Team page.
 *
 * Extracted from src/pages/manager/Team.tsx so that file stays under the
 * edit cap. Pure logic — no React, no hooks. Returns booleans for whether
 * the SMS / email actually sent so callers can behave as before.
 */

export async function sendSystemTeamInvite(opts: {
  role: string;
  name: string;
  email: string;
  token: string;
  territoryId: string;
}): Promise<{ setupUrl: string; areaName: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnonKey;
  const res = await fetch(`${supabaseUrl}/functions/v1/team-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.setupUrl) {
    throw new Error(data.error || "Invite email was not sent.");
  }
  return { setupUrl: data.setupUrl, areaName: data.areaName || "" };
}

export async function sendInviteNotifications(opts: {
  role: string;
  name: string;
  email: string;
  settings: Settings;
  token: string;
  territoryId: string;
}): Promise<{ smsSent: boolean; emailSent: boolean; setupUrl: string }> {
  const { role, name, email, settings, token, territoryId } = opts;
  const sent = await sendSystemTeamInvite({
    role,
    name,
    email,
    token,
    territoryId,
  });
  const setupUrl = sent.setupUrl;
  const company = sent.areaName || "Veydra";
  let smsSent = false;

  if (settings?.hl_api_key && settings?.hl_location_id) {
    const template =
      role === "editor"
        ? settings.sms_editor_invite_template
        : settings.sms_manager_invite_template;
    const enabled =
      role === "editor"
        ? settings.sms_editor_invite_enabled
        : settings.sms_manager_invite_enabled;
    const msg =
      enabled && template
        ? String(template)
            .replace(/{{company_name}}/g, company)
            .replace(/{{editor_name}}/g, name)
            .replace(/{{manager_name}}/g, name)
            .replace(/{{setup_link}}/g, setupUrl)
        : `Hi ${name}, you've been invited to Veydra for ${company}. Set up your account: ${setupUrl}`;
    await callOvantaSend({
      action: "sms",
      email,
      message: msg,
      name,
      territoryId: settings.territory_id || territoryId,
    })
      .then(() => (smsSent = true))
      .catch((e) => console.error("SMS failed:", e));
  }

  return { smsSent, emailSent: true, setupUrl };
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
