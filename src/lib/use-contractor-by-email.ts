import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getContractorByEmail,
  type ContractorWithEmail,
} from "./contractor-by-email";

/**
 * Loads the logged-in contractor by auth email (case-insensitive), with NO
 * territory filter. Used on the contractor-facing Opportunities / Opportunity
 * Detail pages so a contractor's own profile is found regardless of which
 * area the manager switcher is on. The manager contractor list stays
 * area-scoped; only the contractor's own lookup changes.
 */
export function useContractorByEmail() {
  const { user } = useAuth();
  return useQuery<ContractorWithEmail | null>({
    queryKey: ["contractor-by-email", user?.email],
    queryFn: () => getContractorByEmail(user?.email || ""),
    enabled: !!user?.email,
  });
}
