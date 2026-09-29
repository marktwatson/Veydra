import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  packages: any[];
  addons: any[];
  coverageType: string;
  packageId: string;
  selectedAddons: string[];
  secondShooterHours: number;
  secondShooterType: string;
  onCoverageType: (v: string) => void;
  onPackageId: (v: string) => void;
  onToggleAddon: (id: string) => void;
  onSecondShooterHours: (v: number) => void;
  onSecondShooterType: (v: string) => void;
}

export function PackageSelectionCard({
  packages,
  addons,
  coverageType,
  packageId,
  selectedAddons,
  secondShooterHours,
  secondShooterType,
  onCoverageType,
  onPackageId,
  onToggleAddon,
  onSecondShooterHours,
  onSecondShooterType,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Package Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Coverage Type *</Label>
          <Select value={coverageType} onValueChange={onCoverageType}>
            <SelectTrigger>
              <SelectValue placeholder="Select coverage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Photo & Video</SelectItem>
              <SelectItem value="photo">Photo Only</SelectItem>
              <SelectItem value="video">Video Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Package (Optional if adding custom items)</Label>
          <Select
            value={packageId || "none"}
            onValueChange={(v) => onPackageId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Base Package</SelectItem>
              {packages.map((pkg) => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.desc}) - $
                  {coverageType === "both" ? pkg.priceBoth : pkg.priceSingle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base">Add-ons</Label>
          <div className="grid gap-3">
            {addons.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-colors"
              >
                <Checkbox
                  id={`pub-addon-${addon.id}`}
                  checked={selectedAddons.includes(addon.id)}
                  onCheckedChange={() => onToggleAddon(addon.id)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`pub-addon-${addon.id}`}
                    className="font-medium cursor-pointer"
                  >
                    {addon.name}{" "}
                    {addon.isHourly && (
                      <span className="text-muted-foreground font-normal text-xs ml-1">
                        (${addon.price}/hr, {addon.minHours}-hr min)
                      </span>
                    )}
                  </Label>
                </div>
                <div className="text-sm text-muted-foreground">
                  +$
                  {addon.isHourly
                    ? addon.price * secondShooterHours
                    : addon.price}
                </div>
              </div>
            ))}
          </div>

          {(selectedAddons.includes("second_shooter") ||
            selectedAddons.includes("second_shooter_new")) && (
            <div className="p-4 bg-muted/30 rounded-lg space-y-4 mt-2">
              {selectedAddons.includes("second_shooter") && (
                <div className="flex items-center justify-between">
                  <Label>Second Shooter Hours</Label>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        onSecondShooterHours(
                          Math.max(3, secondShooterHours - 1),
                        )
                      }
                    >
                      -
                    </Button>
                    <span className="w-4 text-center font-medium">
                      {secondShooterHours}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        onSecondShooterHours(secondShooterHours + 1)
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Second Shooter Role</Label>
                <Select
                  value={secondShooterType}
                  onValueChange={onSecondShooterType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photographer</SelectItem>
                    <SelectItem value="video">Videographer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
