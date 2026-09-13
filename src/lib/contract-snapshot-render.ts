import { formatDisplayDate } from "./utils";

/**
 * Render a stored custom-contract snapshot template by substituting the
 * {{placeholder}} tokens with values from the proposal record.
 *
 * Extracted from ProposalReview so the page stays focused; the same
 * substitution order is preserved.
 */
export function renderContractSnapshot(
  snapshot: string,
  ctx: {
    companyName?: string;
    companyState?: string;
    client_name?: string;
    partner_name?: string;
    wedding_date?: string;
    venue?: string;
    venue_address?: string;
    city?: string;
    state?: string;
    packageString?: string;
    total_amount?: number;
    contract_signed_at?: string;
    addons?: string[];
    second_shooter_hours?: number;
    second_shooter_type?: string;
    custom_prices?: { items?: { name: string }[] };
    addonsLookup: { id: string; name: string }[];
  },
): string {
  const addonNames: string[] = [];
  if (ctx.addons?.length) {
    ctx.addons.forEach((a) => {
      const name = ctx.addonsLookup.find((ad) => ad.id === a)?.name || a;
      addonNames.push(
        a === "second_shooter"
          ? `${name} (${ctx.second_shooter_hours} hrs - ${ctx.second_shooter_type === "video" ? "Videographer" : "Photographer"})`
          : name,
      );
    });
  }
  if (ctx.custom_prices?.items?.length) {
    ctx.custom_prices.items.forEach((item) => addonNames.push(item.name));
  }

  return snapshot
    .replace(/{{company_name}}/g, ctx.companyName || "")
    .replace(/{{company_state}}/g, ctx.companyState || "")
    .replace(/{{bride_name}}/g, ctx.client_name || "")
    .replace(/{{client_name}}/g, ctx.client_name || "")
    .replace(
      /{{partner_name}}/g,
      ctx.partner_name ? `& ${ctx.partner_name}` : "",
    )
    .replace(/{{wedding_date}}/g, formatDisplayDate(ctx.wedding_date) || "")
    .replace(/{{venue}}/g, ctx.venue || "")
    .replace(/{{venue_address}}/g, ctx.venue_address || "")
    .replace(/{{city}}/g, ctx.city || "")
    .replace(/{{state}}/g, ctx.state || "")
    .replace(/{{package_name}}/g, ctx.packageString || "")
    .replace(
      /{{total_amount}}/g,
      ctx.total_amount ? `$${ctx.total_amount.toLocaleString()}` : "$0",
    )
    .replace(
      /{{retainer_amount}}/g,
      ctx.total_amount ? `$${(ctx.total_amount / 2).toLocaleString()}` : "$0",
    )
    .replace(
      /{{add_ons}}/g,
      addonNames.length > 0 ? addonNames.join(", ") : "None",
    )
    .replace(
      /{{date}}/g,
      ctx.contract_signed_at
        ? formatDisplayDate(ctx.contract_signed_at)
        : formatDisplayDate(new Date().toISOString()),
    );
}
