import { useParams, Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  FileText,
  Loader2,
  Navigation,
  CheckCircle2,
  UploadCloud,
  DollarSign,
  Folder,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { geocodeAddress, calculateDistanceMiles } from "@/lib/geocoding";
import {
  generateGoogleCalendarUrl,
  formatDisplayDate,
  formatPhoneNumber,
} from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["assignments"],
    queryFn: api.getAssignments,
  });

  const { data: contractors = [], isLoading: isLoadingContractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const { data: portalSettings } = useQuery({
    queryKey: ["portalSettings"],
    queryFn: () => api.getPortalSettings(),
  });

  const assignment = assignments.find((a: any) => a.id === id);
  const job = assignment?.jobs;
  const wedding = job?.weddings;
  const currentUser = contractors.find(
    (c) => c.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
  );

  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser?.address || !wedding?.location) return;

    let isMounted = true;
    const calculateDistance = async () => {
      const homeCoords = await geocodeAddress(currentUser.address!);
      if (!homeCoords) return;

      const jobCoords = await geocodeAddress(wedding.location);
      if (jobCoords && isMounted) {
        setDistance(calculateDistanceMiles(homeCoords, jobCoords));
      }
    };
    calculateDistance();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.address, wedding?.location]);

  const [fileCount, setFileCount] = useState("");
  const [allFilesUploaded, setAllFilesUploaded] = useState(false);

  const submitInvoiceMutation = useMutation({
    mutationFn: async () => {
      let systemRating = 5;
      if (wedding?.date) {
        const datePart = wedding.date.split("T")[0];
        const [year, month, day] = datePart.split("-").map(Number);
        const weddingDate = new Date(year, month - 1, day);
        const now = new Date();
        const diffDays =
          (now.getTime() - weddingDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
          systemRating = 1; // Penalty for late upload
        }
      }

      await api.updateAssignment(assignment.id, {
        media_link: wedding?.drive_link || "",
        file_count: parseInt(fileCount, 10),
        invoice_notes: `File Count: ${fileCount}`,
        system_rating: systemRating,
        status: "Pending Payout",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Invoice Submitted",
        description: "Your media and invoice have been submitted for review.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message,
      });
    },
  });

  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wedding?.drive_link) {
      toast({
        variant: "destructive",
        title: "Missing Folder Link",
        description:
          "No Google Drive folder link is available for this wedding.",
      });
      return;
    }
    if (!allFilesUploaded) {
      toast({
        variant: "destructive",
        title: "Confirmation Required",
        description: "Please confirm that all files have been uploaded.",
      });
      return;
    }
    if (!fileCount.trim()) {
      toast({
        variant: "destructive",
        title: "Missing File Count",
        description: "Please provide the number of files uploaded.",
      });
      return;
    }
    submitInvoiceMutation.mutate();
  };

  if (isLoadingAssignments || isLoadingContractors) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assignment || !wedding || assignment.contractor_id !== currentUser?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold mb-2">Assignment Not Found</h2>
        <p className="text-muted-foreground mb-6">
          This assignment does not exist or you do not have permission to view
          it.
        </p>
        <Button asChild variant="outline">
          <Link to="/assignments">Return to Assignments</Link>
        </Button>
      </div>
    );
  }

  const statusStr = String(assignment.status || "")
    .trim()
    .toLowerCase();
  const isActive = [
    "upcoming",
    "accepted",
    "confirmed",
    "completed",
    "payment received",
    "pending payout",
    "paid",
    "assigned",
  ].includes(statusStr);

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Assignment Cancelled</h2>
        <p className="text-muted-foreground mb-6">
          You are no longer assigned to this job, or it has been cancelled.
        </p>
        <Button asChild variant="outline">
          <Link to="/assignments">Return to Assignments</Link>
        </Button>
      </div>
    );
  }

  // Display real data from the wedding record
  const {
    timeline,
    vip_names,
    vendors,
    special_requests,
    questionnaire_completed,
  } = wedding;

  const showUploadInstructions =
    wedding.date &&
    (() => {
      const datePart = wedding.date.split("T")[0];
      const [year, month, day] = datePart.split("-").map(Number);
      const weddingDate = new Date(year, month - 1, day);
      return new Date().getTime() >= weddingDate.getTime();
    })();
  const isPendingPayout = assignment.status === "Pending Payout";
  const isPaid =
    assignment.status === "Completed" ||
    assignment.status === "Paid" ||
    assignment.status === "Payment Received";

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full overflow-hidden sm:overflow-visible">
      {wedding.date &&
        assignment.status !== "Cancelled" &&
        !assignment.attendance_confirmed &&
        (() => {
          const datePart = wedding.date.split("T")[0];
          const [year, month, day] = datePart.split("-").map(Number);
          const weddingDate = new Date(year, month - 1, day);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil(
            (weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (diffDays >= 0 && diffDays <= 14) {
            return (
              <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-md mb-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-destructive font-bold text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" /> Action Required: Confirm
                    Attendance
                  </h3>
                  <p className="text-destructive/90 text-sm mt-1">
                    This wedding is{" "}
                    {diffDays === 0
                      ? "today"
                      : diffDays === 1
                        ? "tomorrow"
                        : `in ${diffDays} days`}
                    . Please confirm you are still attending. Failure to confirm
                    by the 7-day mark will result in automatic removal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="destructive"
                    className="whitespace-nowrap"
                    onClick={() => {
                      api
                        .confirmAssignmentAttendance(assignment.id)
                        .then(() => {
                          queryClient.invalidateQueries({
                            queryKey: ["assignments"],
                          });
                          toast({
                            title: "Attendance Confirmed",
                            description:
                              "Thank you for confirming your attendance!",
                          });
                        });
                    }}
                  >
                    Confirm
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        Cannot Attend
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Warning: If you confirm you cannot attend, you will be
                          removed from this position and the job will be
                          immediately reposted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => {
                            api
                              .cancelAssignmentByJobAndContractor(
                                assignment.job_id,
                                assignment.contractor_id,
                              )
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["assignments"],
                                });
                                toast({
                                  title: "Assignment Cancelled",
                                  description:
                                    "You have been removed from this job.",
                                });
                                navigate("/assignments");
                              });
                          }}
                        >
                          I Cannot Attend
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          }
          return null;
        })()}

      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-3 mb-2 text-muted-foreground"
      >
        <Link to="/assignments">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assignments
        </Link>
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 break-words">
            {wedding.client_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatDisplayDate(wedding.date)}
            </span>
            <span>•</span>
            {wedding.is_lgbtq && (
              <>
                <Badge
                  variant="outline"
                  className="text-sm bg-rose-50/50 text-rose-600 border-rose-200"
                  title="LGBTQ+ Wedding"
                >
                  🌈 LGBTQ+
                </Badge>
                <span>•</span>
              </>
            )}
            <StatusBadge
              status={(() => {
                const status = assignment.status || "Upcoming";
                if (status.toLowerCase() === "upcoming" && wedding.date) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const datePart = wedding.date.split("T")[0];
                  const [year, month, day] = datePart.split("-").map(Number);
                  const wDate = new Date(year, month - 1, day);
                  if (wDate.getTime() === today.getTime()) return "Today";
                  if (wDate.getTime() < today.getTime()) return "Past";
                }
                return status;
              })()}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a
              href={generateGoogleCalendarUrl(assignment)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Clock className="mr-2 h-4 w-4" />
              Add to Google Calendar
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 min-w-0">
        <div className="md:col-span-2 space-y-6 min-w-0">
          {showUploadInstructions && (
            <Card className="border-primary/50 shadow-sm bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UploadCloud className="h-5 w-5 text-primary" />
                  Post-Wedding Next Steps
                </CardTitle>
                <CardDescription>
                  Follow these instructions to upload your files and get paid.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    1. Upload Instructions
                  </h3>
                  <div className="bg-background p-4 rounded-md border space-y-4 text-sm text-muted-foreground break-words">
                    {portalSettings?.upload_instructions ? (
                      <div
                        className="prose prose-sm max-w-none text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: portalSettings.upload_instructions,
                        }}
                      />
                    ) : (
                      <>
                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-md text-foreground">
                          <p className="font-semibold mb-1 text-destructive">
                            REQUIRED: Shared Upload Account
                          </p>
                          <p className="text-sm mb-2">
                            You <strong>MUST</strong> sign in with our shared
                            upload account below to upload the files. Do not use
                            your personal Google account, as it will cause
                            storage quota errors:
                          </p>
                          <div className="bg-background p-2 rounded border font-mono text-sm select-all mb-3">
                            <p>
                              <strong>Email:</strong>{" "}
                              {portalSettings?.upload_account_email ||
                                "uploads@capturedmemoriesco.com"}
                            </p>
                            <p>
                              <strong>Password:</strong>{" "}
                              {portalSettings?.upload_account_password ||
                                "Video3456@"}
                            </p>
                          </div>
                          <p className="text-sm">
                            <strong>Pro Tip:</strong> We highly recommend using{" "}
                            <a
                              href="https://www.airexplorer.net/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-semibold"
                            >
                              AirExplorer
                            </a>{" "}
                            to manage your uploads. It allows you to connect
                            this Google Drive account directly without having to
                            log in via your browser, and it prevents large
                            uploads from timing out!
                          </p>
                        </div>
                        <p>
                          Please follow these instructions to upload your files:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>
                            Click the Google Drive link below to access the
                            wedding folder.
                          </li>
                          <li>
                            Upload your files directly into either the{" "}
                            <strong>Photo</strong> or <strong>Video</strong>{" "}
                            folder that we have already created for you inside.
                          </li>
                          <li>
                            Ensure all files are named sequentially and
                            time-synced if possible.
                          </li>
                          <li>
                            <strong>For Photos:</strong> Please cull your files
                            down to around 100-120 final images per hour of
                            coverage.
                          </li>
                          <li>
                            <strong>For Video:</strong> Please do not cull—we
                            need all raw, uncompressed files.
                          </li>
                          <li className="text-destructive font-medium mt-2">
                            Note: Late uploads (after 7 days) will result in a
                            lower rating, which may impact your ability to get
                            future jobs.
                          </li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    2. Upload Destination
                  </h3>
                  {wedding.drive_link ? (
                    <div className="bg-background p-4 rounded-md border flex items-start gap-3">
                      <Folder className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground mb-1">
                          Upload your folder here:
                        </p>
                        <a
                          href={wedding.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all font-medium block"
                        >
                          {wedding.drive_link}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-background p-4 rounded-md border border-dashed text-center text-muted-foreground">
                      No upload folder link provided yet. Please contact the
                      manager.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    3. Submit Media & Request Payout
                  </h3>
                  {isPaid ? (
                    <div className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 p-6 rounded-md flex flex-col items-center justify-center text-center border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-10 w-10 mb-3" />
                      <p className="font-semibold text-lg">Invoice Paid</p>
                      <p className="mt-1">
                        Thank you for your hard work on this wedding!
                      </p>
                    </div>
                  ) : isPendingPayout ? (
                    <div className="bg-background p-6 rounded-md border space-y-4">
                      <div className="flex items-center gap-2 text-primary font-medium text-lg border-b pb-4">
                        <Clock className="h-5 w-5" />
                        Awaiting Manager Approval
                      </div>
                      <div className="space-y-3 text-sm">
                        <p className="min-w-0">
                          <span className="text-muted-foreground">
                            Media Link:
                          </span>{" "}
                          <br />
                          <a
                            href={assignment.media_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block font-medium mt-1"
                          >
                            {assignment.media_link}
                          </a>
                        </p>
                        {assignment.invoice_notes && (
                          <p>
                            <span className="text-muted-foreground">
                              Notes:
                            </span>{" "}
                            <br />
                            <span className="font-medium mt-1 block">
                              {assignment.invoice_notes}
                            </span>
                          </p>
                        )}
                        <div className="bg-muted/50 p-3 rounded-md mt-4">
                          <p className="font-semibold flex justify-between items-center">
                            <span className="text-muted-foreground font-normal">
                              Total Payout:
                            </span>
                            <span className="text-green-600 dark:text-green-500">
                              ${job?.pay_rate || 0}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSubmitInvoice}
                      className="bg-background p-5 rounded-md border space-y-6"
                    >
                      <div className="space-y-3">
                        <Label className="text-base">Upload Folder Link</Label>
                        {wedding.drive_link ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start h-auto p-4 text-left font-normal max-w-full overflow-hidden"
                            asChild
                          >
                            <a
                              href={wedding.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0"
                            >
                              <Folder className="h-5 w-5 mr-3 text-primary shrink-0" />
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="font-medium text-foreground mb-1 truncate">
                                  Open Google Drive Folder
                                </div>
                                <div className="text-muted-foreground text-xs truncate">
                                  {wedding.drive_link}
                                </div>
                              </div>
                              <ExternalLink className="h-4 w-4 ml-3 text-muted-foreground shrink-0" />
                            </a>
                          </Button>
                        ) : (
                          <div className="bg-muted/50 p-4 rounded-md border border-dashed text-center text-muted-foreground text-sm">
                            No upload folder link provided yet.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="fileCount" className="text-base">
                          Total Number of Files Uploaded{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="fileCount"
                          type="number"
                          placeholder="e.g. 1500"
                          value={fileCount}
                          onChange={(e) => setFileCount(e.target.value)}
                          required
                          className="bg-muted/50 max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          This helps us verify that all files synced completely.
                        </p>
                      </div>

                      <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-md border">
                        <Checkbox
                          id="allFiles"
                          checked={allFilesUploaded}
                          onCheckedChange={(c) =>
                            setAllFilesUploaded(c as boolean)
                          }
                          className="mt-1 shrink-0"
                        />
                        <div className="grid gap-1.5 leading-none flex-1">
                          <label
                            htmlFor="allFiles"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            I confirm that all files have finished uploading
                          </label>
                          <p className="text-sm text-muted-foreground mt-1.5">
                            Please ensure the upload is 100% complete before
                            submitting this form.
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-muted-foreground font-medium">
                            Expected Payout
                          </span>
                          <span className="text-xl font-bold text-green-600 dark:text-green-500">
                            ${job?.pay_rate}
                          </span>
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-auto py-3 whitespace-normal sm:whitespace-nowrap"
                          size="lg"
                          disabled={submitInvoiceMutation.isPending}
                        >
                          {submitInvoiceMutation.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin mr-2 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 mr-2 shrink-0" />
                          )}
                          Submit Media & Request Payout
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isPaid && !isPendingPayout && (
            <Card
              className={
                showUploadInstructions
                  ? "border-border shadow-sm bg-background"
                  : "border-primary/50 shadow-sm bg-primary/5"
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2
                    className={
                      showUploadInstructions
                        ? "h-5 w-5 text-muted-foreground"
                        : "h-5 w-5 text-primary"
                    }
                  />
                  Preparation Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const defaultTodos = [
                    {
                      id: "1",
                      task: "Contact the couple to introduce yourself",
                      completed: false,
                    },
                    {
                      id: "2",
                      task: "Review timeline and questionnaire",
                      completed: false,
                    },
                    {
                      id: "3",
                      task: "Prep gear and charge all batteries",
                      completed: false,
                    },
                  ];

                  const currentTodos =
                    job?.contractor_todos &&
                    Array.isArray(job.contractor_todos) &&
                    job.contractor_todos.length > 0
                      ? job.contractor_todos
                      : defaultTodos;

                  const handleToggle = (todoId: string, checked: boolean) => {
                    const newTodos = currentTodos.map((t: any) =>
                      t.id === todoId ? { ...t, completed: checked } : t,
                    );
                    api.updateJobTodos(job.id, newTodos).then(() => {
                      queryClient.invalidateQueries({
                        queryKey: ["assignments"],
                      });
                    });
                  };

                  return (
                    <div className="space-y-3">
                      {currentTodos.map((todo: any) => (
                        <div
                          key={todo.id}
                          className="flex items-start space-x-3 bg-background p-3 rounded-md border"
                        >
                          <Checkbox
                            id={`todo-${todo.id}`}
                            checked={todo.completed}
                            onCheckedChange={(checked) =>
                              handleToggle(todo.id, checked as boolean)
                            }
                            className="mt-0.5"
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`todo-${todo.id}`}
                              className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${todo.completed ? "text-muted-foreground line-through" : ""}`}
                            >
                              {todo.task}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Day-of Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline ? (
                (() => {
                  try {
                    const parsed =
                      typeof timeline === "string"
                        ? JSON.parse(timeline)
                        : timeline;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      return (
                        <div className="relative border-l-2 border-primary/20 ml-3 space-y-6 pb-2">
                          {parsed.map((item: any, i: number) => (
                            <div key={i} className="relative pl-6">
                              <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full bg-primary border-4 border-card" />
                              <div className="font-semibold text-sm">
                                {item.time}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {item.event}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {
                    // Fallback to text if it's old data
                  }
                  return (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {timeline}
                    </div>
                  );
                })()
              ) : (
                <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 rounded-md border border-dashed">
                  The bride has not submitted their timeline yet.
                </div>
              )}
            </CardContent>
          </Card>

          {(vip_names || vendors || special_requests) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Wedding Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {vip_names && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      VIPs & Family Members
                    </h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
                      {vip_names}
                    </p>
                  </div>
                )}
                {vendors && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Vendor List</h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
                      {vendors}
                    </p>
                  </div>
                )}
                {special_requests && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">
                      Special Requests
                    </h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
                      {special_requests}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {wedding.questionnaire_data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Questionnaire Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  let qData = wedding.questionnaire_data;
                  if (typeof qData === "string") {
                    try {
                      qData = JSON.parse(qData);
                    } catch (e) {
                      return null;
                    }
                  }
                  if (!qData) return null;

                  return (
                    <div className="space-y-6">
                      {qData.contact_info && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-1">
                            Contact Info
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Bride:
                              </span>{" "}
                              {qData.contact_info.bride_full_name}{" "}
                              <span className="text-muted-foreground">
                                (
                                {formatPhoneNumber(
                                  qData.contact_info.phone_bride,
                                )}
                                )
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Groom:
                              </span>{" "}
                              {qData.contact_info.groom_full_name}{" "}
                              <span className="text-muted-foreground">
                                (
                                {formatPhoneNumber(
                                  qData.contact_info.phone_groom,
                                )}
                                )
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Prefers:
                              </span>{" "}
                              {qData.contact_info.preferred_contact_method}{" "}
                              <span className="text-muted-foreground">
                                ({qData.contact_info.best_contact_time})
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {qData.style_vibe && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-1">
                            Style & Vibe
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {qData.style_vibe.wedding_theme && (
                              <div>
                                <span className="text-muted-foreground">
                                  Theme:
                                </span>{" "}
                                {qData.style_vibe.wedding_theme}
                              </div>
                            )}
                            {qData.style_vibe.dress_code && (
                              <div>
                                <span className="text-muted-foreground">
                                  Dress Code:
                                </span>{" "}
                                {qData.style_vibe.dress_code}
                              </div>
                            )}
                            {qData.style_vibe.decor_style && (
                              <div>
                                <span className="text-muted-foreground">
                                  Decor:
                                </span>{" "}
                                {qData.style_vibe.decor_style}
                              </div>
                            )}
                            {qData.style_vibe.florist_name && (
                              <div>
                                <span className="text-muted-foreground">
                                  Florist:
                                </span>{" "}
                                {qData.style_vibe.florist_name}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {qData.photo_video && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-1">
                            Photo & Video
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                              <span>
                                <span className="text-muted-foreground">
                                  First Look:
                                </span>{" "}
                                {qData.photo_video.first_look}
                              </span>
                              <span>
                                <span className="text-muted-foreground">
                                  Audio of Vows:
                                </span>{" "}
                                {qData.photo_video.audio_vows_toasts}
                              </span>
                            </div>
                            {qData.photo_video.must_have_photos && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Must-Have Photos:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md">
                                  {qData.photo_video.must_have_photos}
                                </p>
                              </div>
                            )}
                            {qData.photo_video.must_have_video_moments && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Must-Have Video:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md">
                                  {qData.photo_video.must_have_video_moments}
                                </p>
                              </div>
                            )}
                            {qData.photo_video.photography_restrictions && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Restrictions:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md">
                                  {qData.photo_video.photography_restrictions}
                                </p>
                              </div>
                            )}
                            {qData.photo_video.dont_want_captured && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Do Not Capture:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md">
                                  {qData.photo_video.dont_want_captured}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {qData.family_details && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-1">
                            Family Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {qData.family_details.bride_parents_names && (
                                <div>
                                  <span className="text-muted-foreground">
                                    Bride's Parents:
                                  </span>{" "}
                                  {qData.family_details.bride_parents_names}
                                </div>
                              )}
                              {qData.family_details.groom_parents_names && (
                                <div>
                                  <span className="text-muted-foreground">
                                    Groom's Parents:
                                  </span>{" "}
                                  {qData.family_details.groom_parents_names}
                                </div>
                              )}
                            </div>
                            {qData.family_details
                              .sensitive_family_situations && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Sensitive Situations:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md text-destructive/80">
                                  {
                                    qData.family_details
                                      .sensitive_family_situations
                                  }
                                </p>
                              </div>
                            )}
                            {qData.family_details.emergency_contact && (
                              <div>
                                <span className="text-muted-foreground font-medium text-destructive">
                                  Emergency Contact:
                                </span>{" "}
                                {qData.family_details.emergency_contact}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {qData.wedding_party && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-1">
                            Wedding Party
                          </h4>
                          <div className="space-y-2 text-sm">
                            {qData.wedding_party.wedding_party_size && (
                              <div>
                                <span className="text-muted-foreground">
                                  Party Size:
                                </span>{" "}
                                {qData.wedding_party.wedding_party_size}
                              </div>
                            )}
                            {qData.wedding_party.special_traditions_events && (
                              <div>
                                <span className="text-muted-foreground block mb-1">
                                  Special Traditions:
                                </span>{" "}
                                <p className="bg-muted/20 p-2 rounded-md">
                                  {
                                    qData.wedding_party
                                      .special_traditions_events
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Client
                  </p>
                  <p className="font-medium break-words">
                    {wedding.client_name}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Location
                  </p>
                  <p className="font-medium break-words">
                    {wedding.location || "TBD"}
                  </p>
                </div>
              </div>
              {distance !== null && (
                <div className="flex items-start gap-3">
                  <Navigation className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                      Distance
                    </p>
                    <p className="font-medium">
                      {distance.toFixed(1)} miles away
                    </p>
                  </div>
                </div>
              )}
              {job?.hours && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                      Hours
                    </p>
                    <p className="font-medium">{job.hours} hrs</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Role
                  </p>
                  <p className="font-medium">{job?.role || "Role"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Payout
                  </p>
                  <p className="font-medium">${job?.pay_rate || 0}</p>
                </div>
              </div>
              {job?.addons && job.addons.length > 0 && (
                <div className="pt-4 border-t mt-4">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-3">
                    Addons Included
                  </p>
                  <ul className="grid gap-3">
                    {job.addons.map((addon: string, i: number) => (
                      <li key={i} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4 text-purple-500" />
                          <span>{addon}</span>
                        </div>
                        {addon === "Audio & Vows" && (
                          <p className="text-xs text-muted-foreground ml-6">
                            Requires you to bring lapels and other recording
                            equipment for this job.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* The Invoice & Media Upload Section has been moved to the main column for past weddings */}
        </div>
      </div>
    </div>
  );
}
