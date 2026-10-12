export const ownerSetupClosedKey = (territoryId: string) => `veydra_owner_setup_closed:${territoryId}`;
export const ownerPackageKey = (territoryId: string) => `veydra_owner_package:${territoryId}`;

export type SetupSnapshot = {
  companyName: string;
  areaName: string;
  regions: string[];
  timezone: string;
  logoUrl: string;
  hasOvanta: boolean;
  hasFacebook: boolean;
  hasContractorStripe: boolean;
  hasEditorStripe: boolean;
  packagePrice: string;
};

export function setupChecks(input: SetupSnapshot) {
  const name = input.companyName.trim();
  return [
    { id: "name", label: "Business name", done: name.length > 1 && name !== input.areaName.trim() },
    { id: "cities", label: "Cities", done: input.regions.length > 0 },
    { id: "timezone", label: "Timezone", done: !!input.timezone.trim() },
    { id: "package", label: "First package", done: !!input.packagePrice.trim() },
    { id: "logo", label: "Logo", done: /^https?:\/\//.test(input.logoUrl || "") },
    { id: "ovanta", label: "Ovanta", done: input.hasOvanta },
    { id: "stripe", label: "Stripe payouts", done: input.hasContractorStripe && input.hasEditorStripe },
    { id: "facebook", label: "Facebook ads", done: input.hasFacebook },
  ];
}

export function setupComplete(input: SetupSnapshot) {
  return setupChecks(input).every((item) => item.done);
}
