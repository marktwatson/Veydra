export const ownerSetupClosedKey = (territoryId: string) => `veydra_owner_setup_closed:${territoryId}`;
export const ownerPackageKey = (territoryId: string) => `veydra_owner_package:${territoryId}`;

export type SetupSnapshot = {
  companyName: string;
  areaName: string;
  regions: string[];
  timezone: string;
  logoUrl: string;
  hasOvanta: boolean;
  ovantaSignedUp: boolean;
  hasFacebook: boolean;
  facebookReady: boolean;
  hasContractorStripe: boolean;
  hasEditorStripe: boolean;
  stripeReady: boolean;
  packagePrice: string;
};

export function setupChecks(input: SetupSnapshot) {
  const name = input.companyName.trim();
  return [
    { id: "name", label: "Business name", done: name.length > 1 && name !== input.areaName.trim() },
    { id: "cities", label: "Cities", done: input.regions.length > 0 },
    { id: "timezone", label: "Timezone", done: !!input.timezone.trim() },
    { id: "package", label: "Starter prices", done: !!input.packagePrice.trim() },
    { id: "logo", label: "Logo", done: /^https?:\/\//.test(input.logoUrl || "") },
    { id: "ovanta", label: "Ovanta signup", done: input.ovantaSignedUp || input.hasOvanta },
    { id: "stripe", label: "Stripe account", done: input.stripeReady || (input.hasContractorStripe && input.hasEditorStripe) },
    { id: "facebook", label: "Facebook ads", done: input.facebookReady || input.hasFacebook },
  ];
}

export function setupComplete(input: SetupSnapshot) {
  return setupChecks(input).every((item) => item.done);
}

function snapPrice(amount: number) {
  return Math.round(amount / 50) * 50;
}

function costFloor(hours: number) {
  const contractor = hours * 50;
  const edit = hours >= 8 ? 300 : 200;
  return Math.ceil((contractor + edit) / 0.87);
}

export function pricesIn(text: string) {
  return Array.from(text.matchAll(/\$([\d,]+)/g))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((amount) => amount >= 400 && amount <= 20000);
}

export function suggestPricing(published: number[]) {
  const sorted = [...published].sort((a, b) => a - b);
  const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 4000;
  const four = Math.max(costFloor(4), snapPrice(mid * 0.4));
  const eight = Math.max(costFloor(8), snapPrice(four * (1950 / 1600)));
  return { four, eight, deposit: four < 1400 ? 50 : 99, marketMid: mid, samples: sorted.length };
}

export function packageMath(price: number, hours: number) {
  const contractor = hours * 50;
  const edit = hours >= 8 ? 300 : 200;
  const sales = price * 0.05;
  const royalty = price * 0.05;
  const payback = price * 0.03;
  const left = price - contractor - edit - sales - royalty - payback;
  return { contractor, edit, sales, royalty, payback, left };
}
