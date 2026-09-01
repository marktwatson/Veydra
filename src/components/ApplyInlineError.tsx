import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Inline, friendlier error shown on the Apply form when the email is
 * already tied to an account but the password doesn't match (the classic
 * "orphaned auth account from a prior failed application" case). Offers
 * direct links to log in or reset the password instead of a bare toast.
 */
export function ApplyInlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 p-4"
    >
      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          We found an existing account with this email
        </p>
        <p className="text-sm text-amber-800/90 dark:text-amber-300/90">
          {message}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            Log in instead
          </Link>
          <Link
            to="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Reset your password
          </Link>
        </div>
      </div>
    </div>
  );
}
