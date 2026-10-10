import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useProposalsData } from "@/lib/use-proposals-data";
import { ProposalSalesRepsTab } from "@/components/ProposalSalesRepsTab";

/**
 * Dedicated Sales Reps page — close ratios and pipeline for proposals built
 * by hired salespeople via the public builder link. Reached from the
 * Proposals section header ("Sales Reps" button). Uses the same territory-
 * scoped proposals loader as the main Proposals list, so the area switcher
 * / manager territory applies here too.
 */
export default function SalesRepsPage() {
  const { proposals, loading, refresh } = useProposalsData();
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif text-foreground md:text-3xl">Sales Reps</h1>
          <p className="text-muted-foreground mt-1">
            Ranked by proposals sent. Close ratios and pipeline for proposals
            built by your salespeople.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/manager/proposals")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Proposals
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 text-muted-foreground">
          Loading proposals...
        </div>
      ) : (
        <ProposalSalesRepsTab proposals={proposals} onRefresh={refresh} />
      )}
    </div>
  );
}
