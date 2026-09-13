import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StripePayoutSetupGuide } from "@/components/StripePayoutSetupGuide";
import { Navigate } from "react-router-dom";

/**
 * Super-admin-only page hosting the Stripe payout account setup guide.
 * Non-super-admins are redirected away.
 */
export default function StripePayoutSetup() {
  const { user } = useAuth();

  if (user?.role !== "super_admin") {
    return <Navigate to="/manager" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Stripe Payout Setup
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Configure the Stripe account used for contractor and editor payouts
          (payroll) in this area. Super Admin only.
        </p>
      </div>
      <StripePayoutSetupGuide />
    </div>
  );
}
