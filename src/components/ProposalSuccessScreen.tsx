import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The "Welcome to the Family!" success screen shown after a bride signs &
 * pays. Extracted from ProposalReview to keep that page focused.
 */
export function ProposalSuccessScreen({ clientName }: { clientName: string }) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 py-12 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

      <Card className="max-w-lg w-full text-center p-10 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl shadow-2xl border-stone-200/50 dark:border-stone-800/50 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-green-200/50 dark:border-green-800/50">
          <CheckCircle2
            className="w-12 h-12 text-green-600 dark:text-green-500"
            strokeWidth={1.5}
          />
        </div>
        <h2 className="text-4xl font-serif text-stone-900 dark:text-stone-50 mb-4">
          Welcome to the Family!
        </h2>
        <div className="h-px w-16 bg-primary/20 mx-auto mb-6" />
        <p className="text-stone-500 dark:text-stone-400 mb-8 leading-relaxed text-lg font-light">
          Thank you,{" "}
          <span className="font-medium text-stone-900 dark:text-stone-100">
            {clientName}
          </span>
          ! Your booking is officially confirmed. We will be emailing and
          calling you shortly. If you prefer text, you can reply back to us
          saying that.
        </p>
        <Button
          onClick={() => window.close()}
          className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:-translate-y-0.5"
        >
          Close Window
        </Button>
      </Card>
    </div>
  );
}
