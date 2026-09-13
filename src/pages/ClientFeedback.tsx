import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FeedbackState {
  rating: number;
  hoveredRating: number;
  feedback: string;
}

export default function ClientFeedback() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackState>>({});
  const [submitted, setSubmitted] = useState(false);

  const {
    data: assignments,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["wedding-feedback-assignments", id],
    queryFn: () => api.getWeddingAssignmentsForFeedback(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (assignments) {
      const initialFeedbacks: Record<string, FeedbackState> = {};
      assignments.forEach((a) => {
        if (!a.client_rating && a.contractors) {
          initialFeedbacks[a.id] = {
            rating: 0,
            hoveredRating: 0,
            feedback: "",
          };
        }
      });
      setFeedbacks((prev) => ({ ...initialFeedbacks, ...prev }));
    }
  }, [assignments]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!assignments) throw new Error("No assignments found");

      const payload = Object.entries(feedbacks)
        .filter(([_, f]) => f.rating > 0)
        .map(([assignmentId, f]) => {
          const assignment = assignments.find((a) => a.id === assignmentId);
          return {
            assignmentId,
            rating: f.rating,
            feedback: f.feedback,
            contractorId: assignment?.contractors?.id || "",
          };
        });

      if (payload.length === 0)
        throw new Error("Please rate at least one contractor");

      await api.submitBulkClientFeedback(payload);
      return payload;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback!",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Could not submit feedback.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !assignments || assignments.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Not Found</CardTitle>
            <CardDescription>
              We couldn't find any contractors for this wedding.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const validAssignments = assignments.filter((a) => a.contractors);
  const unratedAssignments = validAssignments.filter((a) => !a.client_rating);
  const wedding = validAssignments[0]?.jobs?.weddings;

  if (submitted || unratedAssignments.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Thank You!</CardTitle>
            <CardDescription>
              Your feedback has been received. We will be emailing and calling
              you shortly. If you prefer text, you can reply back to us saying
              that.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleRatingChange = (assignmentId: string, rating: number) => {
    setFeedbacks((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], rating },
    }));
  };

  const handleHoverChange = (assignmentId: string, hoveredRating: number) => {
    setFeedbacks((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], hoveredRating },
    }));
  };

  const handleFeedbackChange = (assignmentId: string, feedback: string) => {
    setFeedbacks((prev) => ({
      ...prev,
      [assignmentId]: { ...prev[assignmentId], feedback },
    }));
  };

  const isSubmitDisabled =
    Object.values(feedbacks).every((f) => f.rating === 0) ||
    submitMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 bg-muted/30">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Rate Your Experience
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            How did our team do at{" "}
            {wedding?.client_name
              ? `${wedding.client_name}'s wedding`
              : "your wedding"}
            {wedding?.date ? ` on ${formatDisplayDate(wedding.date)}` : ""}?
            Your feedback helps us continue to provide excellent service.
          </p>
        </div>

        <div className="space-y-6">
          {unratedAssignments.map((assignment) => {
            const contractor = assignment.contractors;
            const role = assignment.jobs?.role;
            const state = feedbacks[assignment.id] || {
              rating: 0,
              hoveredRating: 0,
              feedback: "",
            };

            return (
              <Card key={assignment.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border">
                      <AvatarImage src={contractor?.avatar_url || ""} />
                      <AvatarFallback>
                        <User className="h-6 w-6 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {contractor?.first_name} {contractor?.last_name}
                      </CardTitle>
                      <CardDescription className="text-sm font-medium text-primary">
                        {role}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex flex-col gap-2">
                    <Label className="text-base font-semibold">Rating</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="p-1 focus:outline-none focus:ring-2 focus:ring-ring rounded-full transition-colors"
                          onMouseEnter={() =>
                            handleHoverChange(assignment.id, star)
                          }
                          onMouseLeave={() =>
                            handleHoverChange(assignment.id, 0)
                          }
                          onClick={() =>
                            handleRatingChange(assignment.id, star)
                          }
                        >
                          <Star
                            className={`h-8 w-8 ${
                              star <= (state.hoveredRating || state.rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30"
                            } transition-all`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor={`feedback-${assignment.id}`}
                      className="font-semibold"
                    >
                      Additional Feedback (Optional)
                    </Label>
                    <Textarea
                      id={`feedback-${assignment.id}`}
                      placeholder={`Tell us what you loved about ${contractor?.first_name}'s work or what could be improved...`}
                      value={state.feedback}
                      onChange={(e) =>
                        handleFeedbackChange(assignment.id, e.target.value)
                      }
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-4 z-10 pt-4">
          <Card className="shadow-lg border-primary/20">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                You can rate one or all contractors. Ratings are saved together.
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto min-w-[200px]"
                onClick={() => submitMutation.mutate()}
                disabled={isSubmitDisabled}
              >
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit All Feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
