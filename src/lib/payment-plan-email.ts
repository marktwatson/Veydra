import { formatDisplayDate } from "@/lib/utils";

function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface Inst {
  date: string;
  amount: number;
  label?: string;
}

export function buildPlanChangeEmail(
  installments: Inst[],
  staffNote: string,
  settings: any,
  wedding: any,
  link: string,
): { subject: string; html: string } {
  const companyName = settings?.company_name || "us";
  const bride = wedding?.client_name || "there";
  const logoUrl = settings?.logo_url || "";
  const rowsHtml = installments
    .map(
      (i, idx) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.label || `Installment #${idx + 1}`}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDisplayDate(i.date)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(i.amount)}</td></tr>`,
    )
    .join("");
  const total = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return {
    subject: `Proposed Payment Plan Update — ${companyName}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f7f7;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="padding:24px;text-align:center;border-bottom:1px solid #eee;">
    <img src="${logoUrl}" alt="${companyName}" style="max-height:48px;" />
  </div>
  <div style="padding:24px;">
    <h2 style="margin-top:0;">Hi ${bride.split(" ")[0]},</h2>
    <p>We'd like to propose an updated payment schedule for your wedding. Please review the details below and approve or decline at your convenience.</p>
    ${staffNote ? `<div style="background:#f0f7ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:4px;"><strong>Note from ${companyName}:</strong><br/>${staffNote}</div>` : ""}
    <h3 style="margin-bottom:8px;">Proposed Schedule</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px;">
      <thead><tr style="text-align:left;color:#666;border-bottom:2px solid #eee;"><th style="padding:8px 12px;">Payment</th><th style="padding:8px 12px;">Date</th><th style="padding:8px 12px;text-align:right;">Amount</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="2" style="padding:10px 12px;font-weight:bold;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:bold;">${fmtMoney(total)}</td></tr></tfoot>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:#0a0a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Review &amp; Approve Schedule</a>
    </div>
    <p style="font-size:12px;color:#888;text-align:center;">This link is single-use and expires in 7 days.</p>
  </div>
</div>
</body></html>`,
  };
}
