import { Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  salespersonName: string;
  salespersonEmail: string;
  salesPin: string;
  hasPin: boolean;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPin: (v: string) => void;
}

/**
 * The salesperson's own details (name / email / area PIN). Extracted from
 * BuildProposal so the page stays under its edit cap. When a gate modal has
 * already captured these, the fields arrive pre-filled but stay editable.
 */
export function PublicBuilderYourDetailsCard({
  salespersonName,
  salespersonEmail,
  salesPin,
  hasPin,
  onName,
  onEmail,
  onPin,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Your Details
        </CardTitle>
        <CardDescription>
          Required before you can send a proposal to a client. For internal
          tracking only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Your Name *</Label>
            <Input
              value={salespersonName}
              onChange={(e) => onName(e.target.value)}
              placeholder="Jane Sales"
            />
          </div>
          <div className="space-y-2">
            <Label>Your Email *</Label>
            <Input
              type="email"
              value={salespersonEmail}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
        </div>
        {hasPin && (
          <div className="space-y-2 max-w-xs">
            <Label>Area PIN *</Label>
            <Input
              type="password"
              value={salesPin}
              onChange={(e) => onPin(e.target.value)}
              placeholder="Enter the PIN for this area"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
