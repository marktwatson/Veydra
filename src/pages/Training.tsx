import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  PlayCircle,
  BookOpen,
  Award,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const renderContent = (content: string) => {
  return content.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={i} className="mb-4 last:mb-0">
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="text-foreground font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </p>
    );
  });
};

export default function Training() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["portal-settings"],
    queryFn: () => api.getPortalSettings(),
  });

  const companyName = settings?.company_name || "Veydra";

  const MODULES = [
    {
      id: "brand-standards",
      title: "Our Brand Standards",
      description: "Professionalism, care and creativity.",
      content: `${companyName} is built on professionalism, care and creativity. To maintain our competitive edge, every contractor is expected to follow these standards:
      
- **Competitively Awesome Content:** Deliver timeless yet creative work that balances a trendy style with our classic aesthetic.
- **Customer Oriented:** Prioritise the client’s vision and experience above personal preference.
- **Professionalism & Punctuality:** Arrive early, dress appropriately and respond to all communication within 24 hours.
- **Hyper-Communication:** Be proactive and maintain consistent contact with clients and your Area Manager.
- **Team Spirit:** Help fellow team members, show kindness, and make the client’s experience exceptional.
- **Continuous Improvement:** Engage with our training materials (posing guides, editor tips, onboarding videos) to refine your craft.

We’re a team of wedding storytellers passionate about capturing the moments that matter most. Every couple deserves care, creativity, and excellence.`,
    },
    {
      id: "posing-couples",
      title: "Posing Couples",
      description: "Techniques for natural and beautiful couple portraits.",
      videoUrl: "https://www.youtube.com/embed/CsOliZHuAcw",
      content: `Posing couples can be challenging, but it's essential for getting those perfect shots.
      
- **Make them comfortable:** Start with simple, natural interactions before moving to more complex poses.
- **Give clear directions:** Don't just tell them to 'look natural'. Give them specific actions, like 'whisper a funny secret in her ear'.
- **Focus on connection:** The best poses highlight the emotional connection between the couple.
- **Keep them moving:** Static poses can look stiff. Encourage gentle movement, walking, or swaying to create dynamic images.
- **Pay attention to details:** Watch out for awkward hand placements, double chins, and stray hairs.`,
    },
    {
      id: "reception-lighting",
      title: "Reception & Bad Lighting",
      description: "How to handle challenging lighting situations.",
      videoUrl: "https://www.youtube.com/embed/WPScbsv12n0",
      content: `Receptions often have challenging lighting conditions. Here is how to handle them:
      
- **Off-camera flash:** This is crucial for receptions. Set up flashes in the corners of the room to bounce light or create dynamic rim lighting.
- **Drag the shutter:** For dancing shots, use a slower shutter speed (e.g., 1/15th to 1/30th) while using flash to freeze the subject and capture the ambient light trails.
- **Embrace the ambiance:** Don't try to overpower the DJ's lights completely. Use them to your advantage to capture the mood of the party.
- **Focus assist:** In very dark environments, use your camera's AF assist beam or a small continuous light to help your camera lock focus.`,
    },
    {
      id: "file-management",
      title: "File Management & Uploads",
      description: "Guidelines for culling, organizing, and uploading media.",
      videoUrl: "https://www.youtube.com/embed/dyROBCmub3o",
      content: `Proper file management is critical to ensure no memories are lost and our editors can work efficiently.
      
- **Backup immediately:** The moment you get home, back up your cards to at least two separate physical drives.
- **Culling:** Be ruthless. We only want the best shots. Remove blinks, out-of-focus images, and duplicates. Aim for 75-100 photos per booked hour.
- **Folder structure:** Organize your files logically before uploading. Separate photos, videos, and audio into clearly labeled folders.
- **Uploading:** Use the provided Wedding Hub link to upload your culled files within 5 days of the wedding. We recommend using AirExplorer for large transfers.
- **Confirmation:** Do not format your original memory cards until your Area Manager has confirmed receipt of the files and they are safely stored on our servers.`,
    },
    {
      id: "communication",
      title: "Communication Standards",
      description: "How to communicate with clients and the team.",
      content: `Clear, timely and professional communication is essential. You are expected to:
- Respond to all client and manager messages within 24 hours.
- Reach out to the client within 24 hours of assignment to confirm details.
- Keep your Area Manager informed about your availability or any issues.
- Practise “hyper communication” with updates and proactive check-ins.

**First Contact (within 24 hours of assignment)**
Introduce yourself by phone, text, or email. Mention the wedding guide, confirm details, and follow up in writing.

**Second Contact (2–3 weeks out)**
Confirm the final timeline and locations, remind the couple to complete their shot list in the Wedding Hub, and follow up in writing.

**Travel & Extra Hours**
Do not agree to extra hours or travel without prior written approval. Always direct clients to your Area Manager for additions.

**Professionalism**
Be friendly, clear and polished. Confirm details in writing. You represent our brand at every touchpoint.`,
    },
    {
      id: "payment",
      title: "Contractor Payment Process",
      description: "How and when you get paid.",
      content: `- **Invoicing:** Submit invoices through the Wedding Hub only after uploads are confirmed.
- **Confirmation:** You’ll receive an email once your invoice is in process.
- **Timeline:** Payments issued within 7 days. Late or incomplete uploads delay payment.
- **Rights & Usage:** You retain copyright, but may not post media until the final gallery is delivered. Always direct clients to the official gallery.
- **Questions:** Contact your Area Manager or the support email in your pre-wedding packet.`,
    },
    {
      id: "raw-policy",
      title: "Raw Photos & Video Policy",
      description: "Our strict policy on raw files and backups.",
      content: `- **Raw video:** Only included via Customer Service. Never send directly or post publicly.
- **Raw photos:** Not included in packages. If requested, must be approved by your Manager and delivered via the Wedding Hub.
- **Retention:** Back up and retain raw files for at least 30 days on two drives. Failure may result in non-payment.

**Note:** Delivering raw files outside policy or failing to retain backups is a breach of agreement and may result in termination.`,
    },
    {
      id: "attendance-confirmation",
      title: "Attendance & Job Confirmation",
      description: "Mandatory rules for confirming your assignments.",
      content: `Confirming your attendance for assigned jobs is mandatory. Please review the following rules carefully:
      
- **The 7-Day Rule:** You must confirm your attendance for an assigned job at least 7 days prior to the event date.
- **14-Day Warning:** A red warning banner will appear on your dashboard when a job is 14 days away to remind you to confirm.
- **Failure to Confirm:** If you fail to confirm by the 7-day mark, you will be automatically removed from the job and it will be immediately reposted.
- **Emergencies:** If you have an emergency and cannot attend, you must click the 'Cannot Attend' button as soon as possible so the job can be reassigned.`,
    },
  ];

  const QUIZ_QUESTIONS = [
    {
      id: 1,
      question:
        "What is the expected response time for all client and manager communication?",
      options: [
        "Within 48 hours",
        "Within 24 hours",
        "Within 1 week",
        "Whenever you have free time",
      ],
      correct: 1,
    },
    {
      id: 2,
      question: "When should you make 'First Contact' with the client?",
      options: [
        "Within 24 hours of assignment",
        "1 week before the wedding",
        "2-3 weeks out",
        "The morning of the wedding",
      ],
      correct: 0,
    },
    {
      id: 3,
      question: "How many photos should be delivered per booked hour?",
      options: [
        "25-50 photos",
        "75-100 photos",
        "150-200 photos",
        "As many as possible, without culling",
      ],
      correct: 1,
    },
    {
      id: 4,
      question: "What is the deadline for uploading media via the Wedding Hub?",
      options: [
        "Within 24 hours",
        "Within 5 days of the wedding",
        "Within 2 weeks",
        "Within 30 days",
      ],
      correct: 1,
    },
    {
      id: 5,
      question: "How long must you retain and back up raw files?",
      options: [
        "Until the invoice is paid",
        "For 1 year",
        "At least 30 days on two drives",
        "You can delete them after uploading",
      ],
      correct: 2,
    },
    {
      id: 6,
      question: "What is the minimum camera requirement for video?",
      options: [
        "720p at 30fps",
        "1080p at 60fps (4K preferred)",
        "4K at 120fps only",
        "Any smartphone camera",
      ],
      correct: 1,
    },
    {
      id: 7,
      question: "Are raw photos included in packages by default?",
      options: [
        "Yes, always",
        "No, they are not included unless approved by the Manager",
        "Yes, but only if the client asks",
        "No, we never give raw photos",
      ],
      correct: 1,
    },
    {
      id: 8,
      question:
        "Can you post media (like sneak peeks) on your own social media before the final gallery is delivered?",
      options: [
        "Yes, immediately after the wedding",
        "Yes, if the client says it's okay",
        "No, you may not post media until the final gallery is delivered",
        "Only on Instagram stories",
      ],
      correct: 2,
    },
    {
      id: 9,
      question:
        "Should you agree to extra hours or travel with the client on-site?",
      options: [
        "Yes, and bill them directly via Venmo",
        "Yes, but tell the Area Manager later",
        "No, do not agree without prior written approval. Direct them to the Area Manager.",
        "Only if they pay cash",
      ],
      correct: 2,
    },
    {
      id: 10,
      question: "For photography composition, what rule should you use?",
      options: [
        "Rule of thirds",
        "Golden ratio only",
        "Always center the subject perfectly",
        "Dutch angles for every shot",
      ],
      correct: 0,
    },
    {
      id: 11,
      question:
        "When must you confirm your attendance for an assigned job to avoid being automatically removed?",
      options: [
        "At least 14 days prior to the event",
        "At least 7 days prior to the event",
        "The morning of the event",
        "Within 24 hours of assignment",
      ],
      correct: 1,
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const isQuiz = currentStep === MODULES.length;
  const isComplete = currentStep > MODULES.length;

  const completeTrainingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user ID");
      return await api.completeTraining(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["contractor-avatar", user?.email],
      });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#4f46e5", "#10b981", "#f59e0b"],
      });
      toast.success("Training Completed! Your dashboard is now unlocked.");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 3000);
    },
    onError: (error: any) => {
      toast.error("Failed to unlock dashboard: " + error.message);
    },
  });

  const handleNext = () => {
    if (currentStep < MODULES.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setShowResults(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleQuizSubmit = () => {
    if (Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    let correctCount = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (quizAnswers[q.id] === q.correct) correctCount++;
    });

    setQuizScore(correctCount);
    setShowResults(true);

    if (correctCount === QUIZ_QUESTIONS.length) {
      setCurrentStep(MODULES.length + 1);
      completeTrainingMutation.mutate();
    } else {
      toast.error("You didn't pass. Please review the material and try again!");
    }
  };

  const progress = (currentStep / (MODULES.length + 1)) * 100;

  if (isComplete) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <Award className="h-20 w-20 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight">
          Congratulations!
        </h1>
        <p className="text-xl text-muted-foreground max-w-lg mb-8">
          You've successfully completed the {companyName} Training Academy. You
          are now officially certified and your full dashboard is unlocked.
        </p>
        <Button
          size="lg"
          className="rounded-full shadow-lg text-lg px-8 h-14"
          onClick={() => navigate("/", { replace: true })}
          disabled={completeTrainingMutation.isPending}
        >
          {completeTrainingMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : null}
          Enter Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 py-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {companyName} Training Academy
        </h1>
        <p className="text-muted-foreground">
          Complete these training modules and pass the final quiz to unlock your
          contractor dashboard.
        </p>
      </div>

      <div className="flex items-center gap-4 bg-card border rounded-full px-4 py-3 shadow-sm">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
          Step {currentStep + 1} of {MODULES.length + 1}
        </span>
      </div>

      <div className="grid md:grid-cols-4 gap-6 items-start">
        {/* Sidebar Navigation */}
        <Card className="md:col-span-1 hidden md:block bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 space-y-2">
            {MODULES.map((mod, idx) => (
              <div
                key={mod.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${currentStep === idx ? "bg-primary/10 text-primary font-medium" : currentStep > idx ? "text-muted-foreground" : "text-muted-foreground opacity-50"}`}
              >
                {currentStep > idx ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                <span className="text-sm">{mod.title}</span>
              </div>
            ))}
            <div
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isQuiz ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground opacity-50"}`}
            >
              <BookOpen className="h-4 w-4" />
              <span className="text-sm">Final Quiz</span>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <Card className="md:col-span-3 shadow-md border-border/50 overflow-hidden">
          {!isQuiz ? (
            <>
              {MODULES[currentStep].videoUrl && (
                <div className="aspect-video w-full bg-black relative">
                  <iframe
                    width="100%"
                    height="100%"
                    src={MODULES[currentStep].videoUrl}
                    title={MODULES[currentStep].title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0"
                  ></iframe>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">
                  {MODULES[currentStep].title}
                </CardTitle>
                <CardDescription className="text-base">
                  {MODULES[currentStep].description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground leading-relaxed">
                  {renderContent(MODULES[currentStep].content)}
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Award className="h-6 w-6 text-primary" /> Final Certification
                  Quiz
                </CardTitle>
                <CardDescription className="text-base">
                  You must score 100% to pass and unlock your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {showResults && quizScore < QUIZ_QUESTIONS.length && (
                  <Alert
                    variant="destructive"
                    className="animate-in fade-in slide-in-from-top-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not quite there!</AlertTitle>
                    <AlertDescription>
                      You scored {quizScore} out of {QUIZ_QUESTIONS.length}.
                      Please review the incorrect answers highlighted below and
                      try again.
                    </AlertDescription>
                  </Alert>
                )}

                {QUIZ_QUESTIONS.map((q, i) => {
                  const isWrong =
                    showResults && quizAnswers[q.id] !== q.correct;
                  const isRight =
                    showResults && quizAnswers[q.id] === q.correct;

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-xl border ${isWrong ? "bg-destructive/5 border-destructive/30" : isRight ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card"}`}
                    >
                      <h3 className="font-semibold mb-4 text-lg">
                        {i + 1}. {q.question}
                      </h3>
                      <RadioGroup
                        value={quizAnswers[q.id]?.toString()}
                        onValueChange={(val) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [q.id]: parseInt(val),
                          }))
                        }
                        className="space-y-3"
                        disabled={
                          showResults && quizScore === QUIZ_QUESTIONS.length
                        }
                      >
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className="flex items-center space-x-3"
                          >
                            <RadioGroupItem
                              value={optIdx.toString()}
                              id={`q${q.id}-opt${optIdx}`}
                            />
                            <Label
                              htmlFor={`q${q.id}-opt${optIdx}`}
                              className={`text-base font-normal leading-snug cursor-pointer ${showResults && optIdx === q.correct ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}
                            >
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  );
                })}
              </CardContent>
            </>
          )}

          <CardFooter className="bg-muted/30 border-t p-4 flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>

            {!isQuiz ? (
              <Button onClick={handleNext} className="rounded-full px-6">
                Next Module <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleQuizSubmit}
                className="rounded-full px-8"
                size="lg"
              >
                Submit Answers
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
