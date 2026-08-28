import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { Camera, User } from "lucide-react";

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "contractor";
  const [step, setStep] = useState(role === "editor" ? 3 : 1);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stripeCountry, setStripeCountry] = useState("US");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");
  const email = searchParams.get("email") || "";
  const name = searchParams.get("name") || "";
  const firstNameParam = searchParams.get("first_name") || "";
  const lastNameParam = searchParams.get("last_name") || "";
  const phoneParam = searchParams.get("phone") || "";
  const specialtyParam = searchParams.get("specialty") || "";
  const regionParam = searchParams.get("region");
  let parsedRegion: string[] = [];
  try {
    if (regionParam) parsedRegion = JSON.parse(regionParam);
  } catch (e) {}

  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: firstNameParam,
    lastName: lastNameParam,
    phone: phoneParam,
    address: "",
    portfolioUrl: "",
    venmoHandle: "",
    bio: "",
  });

  useEffect(() => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Invalid link",
        description: "No secure token provided in the setup link.",
      });
      navigate("/login");
    }
  }, [token, navigate, toast]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (!email) {
        throw new Error("Email is missing from the setup link.");
      }

      const cleanEmail = email.trim().toLowerCase();

      let userId;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          // User might have already signed up in auth.users during a previous test
          // Let's sign them in to get their ID to complete the profile creation
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });

          if (signInError) {
            throw new Error(
              "This email is already registered. If you already set a password before, use the correct one, or invite a new email address.",
            );
          }
          userId = signInData.user?.id;
        } else if (
          error.message.toLowerCase().includes("security purposes") ||
          error.message.toLowerCase().includes("rate limit")
        ) {
          throw new Error(
            `Supabase Security: ${error.message} (This happens when testing multiple times in a row. Please wait a minute before trying again!)`,
          );
        } else {
          throw error;
        }
      } else {
        userId = data.user?.id;

        // If session is null, Supabase might be faking the signup due to email enumeration protection
        // (meaning the user already exists). Let's verify if they can actually log in.
        if (!data.session) {
          const { data: signInData, error: checkError } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
          if (checkError) {
            throw new Error(
              "This email is already registered in the system. Even if you deleted their profile, their core authentication account still exists. To test the onboarding flow, please invite a completely new email address (like yourname+test1@gmail.com), or enter their EXISTING password here.",
            );
          }
          userId = signInData.user?.id; // Use the REAL ID from the successful login
        }
      }

      if (userId) {
        if (
          [
            "manager",
            "super_admin",
            "owner",
            "owner_readonly",
            "read_only",
          ].includes(role)
        ) {
          const { data: existingMgr } = await supabase
            .from("managers")
            .select("role")
            .ilike("email", cleanEmail)
            .maybeSingle();
          const finalRole = existingMgr?.role || role;

          const { error: insertError } = await supabase
            .from("managers")
            .upsert({
              id: userId,
              email: cleanEmail,
              name: name || cleanEmail.split("@")[0],
              role: finalRole,
              status: "active",
            });

          if (insertError) {
            console.error("Error inserting manager:", insertError);
            throw new Error(
              `DB Error (${insertError.code || "unknown"}): ${insertError.message}`,
            );
          }
        } else if (role === "editor") {
          const { error: insertError } = await supabase.from("editors").upsert({
            id: userId,
            email: cleanEmail,
            name: name || cleanEmail.split("@")[0],
            status: "active",
          });

          if (insertError) {
            console.error("Error inserting editor:", insertError);
            throw new Error(
              `DB Error (${insertError.code || "unknown"}): ${insertError.message}`,
            );
          }

          // Delete the pending invite from editors table if it has a different ID
          await supabase
            .from("editors")
            .delete()
            .eq("email", cleanEmail)
            .eq("status", "invited")
            .neq("id", userId);

          // Clean up any old ghost records from the managers table that were created by previous workarounds
          await supabase.from("managers").delete().eq("email", cleanEmail);
        } else {
          // Look for an existing contractor record by email
          const { data: existingContractor } = await supabase
            .from("contractors")
            .select("*")
            .ilike("email", cleanEmail)
            .limit(1)
            .maybeSingle();

          if (existingContractor) {
            const { error: updateError } = await supabase
              .from("contractors")
              .update({
                first_name:
                  formData.firstName ||
                  existingContractor.first_name ||
                  firstNameParam ||
                  cleanEmail.split("@")[0],
                last_name:
                  formData.lastName ||
                  existingContractor.last_name ||
                  lastNameParam ||
                  "",
                phone:
                  formData.phone ||
                  existingContractor.phone ||
                  phoneParam ||
                  null,
                address: formData.address || existingContractor.address || null,
                portfolio_url:
                  formData.portfolioUrl ||
                  existingContractor.portfolio_url ||
                  null,
                venmo_handle:
                  formData.venmoHandle ||
                  existingContractor.venmo_handle ||
                  null,
                bio: formData.bio || existingContractor.bio || null,
                specialty:
                  specialtyParam || existingContractor.specialty || null,
                region:
                  parsedRegion.length > 0
                    ? parsedRegion
                    : existingContractor.region || [],
                status: "active",
              })
              .eq("id", existingContractor.id);

            if (updateError) {
              console.error("Error updating contractor:", updateError);
              throw new Error(
                `DB Error (${updateError.code || "unknown"}): ${updateError.message}`,
              );
            }

            // Use the existing ID for the avatar upload
            userId = existingContractor.id;

            // Delete any duplicate rows that might have been created by previous bugs
            await supabase
              .from("contractors")
              .delete()
              .ilike("email", cleanEmail)
              .neq("id", existingContractor.id);
          } else {
            const { error: insertError } = await supabase
              .from("contractors")
              .insert({
                id: userId,
                email: cleanEmail,
                first_name:
                  formData.firstName ||
                  firstNameParam ||
                  cleanEmail.split("@")[0],
                last_name: formData.lastName || lastNameParam || "",
                phone: formData.phone || phoneParam || null,
                address: formData.address || null,
                portfolio_url: formData.portfolioUrl || null,
                venmo_handle: formData.venmoHandle || null,
                bio: formData.bio || null,
                specialty: specialtyParam || null,
                region: parsedRegion.length > 0 ? parsedRegion : [],
                tags: ["invited-contractor"],
                status: "active",
              });

            if (insertError) {
              console.error("Error inserting contractor:", insertError);
              throw new Error(
                `DB Error (${insertError.code || "unknown"}): ${insertError.message}`,
              );
            }
          }
        }
      }

      // Auto login to save them a step and verify the account is active
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        if (
          loginError.message.toLowerCase().includes("credentials") ||
          loginError.message.toLowerCase().includes("invalid")
        ) {
          throw new Error(
            "This email is already registered. Please go to the Login page and use your existing password, or click 'Forgot Password' to reset it.",
          );
        }
        throw loginError;
      }

      if (headshotFile && userId && role === "contractor") {
        try {
          const fileExt = headshotFile.name.split(".").pop();
          const safeEmail = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
          const fileName = `${safeEmail}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, headshotFile, { upsert: true });

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("avatars").getPublicUrl(fileName);
            await supabase
              .from("contractors")
              .update({ avatar_url: publicUrl })
              .eq("id", userId);
          }
        } catch (e) {
          console.error("Failed to upload headshot during onboarding", e);
        }
      }

      // Set the role in local storage so AuthContext knows what to load
      localStorage.setItem(
        "veydra_role",
        role === "editor"
          ? "editor"
          : ["manager", "super_admin"].includes(role)
            ? "manager"
            : "contractor",
      );

      setCreatedUserId(userId);

      // If contractor or editor, show Stripe connect step
      if (role === "contractor" || role === "editor") {
        setStep(4);
      } else {
        // Force a full page reload to the correct dashboard.
        if (["manager", "super_admin"].includes(role)) {
          window.location.href = "/manager";
        } else {
          window.location.href = "/";
        }
      }
    } catch (error: any) {
      setSetupError(
        error.message || "An error occurred while setting your password.",
      );
      toast({
        variant: "destructive",
        title: "Setup failed",
        description:
          error.message || "An error occurred while setting your password.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          {(role === "contractor" || role === "editor") && (
            <div className="flex justify-center mb-4 space-x-2">
              {role === "contractor"
                ? [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-2 w-12 rounded-full transition-colors ${step >= i ? "bg-primary" : "bg-muted"}`}
                    />
                  ))
                : [3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-2 w-12 rounded-full transition-colors ${step >= i ? "bg-primary" : "bg-muted"}`}
                    />
                  ))}
            </div>
          )}
          <CardTitle className="text-2xl font-bold">
            {role === "manager" || role === "super_admin"
              ? "Set Your Password"
              : step === 1
                ? "Welcome to the Portal"
                : step === 2
                  ? "Professional Details"
                  : step === 3
                    ? "Secure Your Account"
                    : "Connect Stripe for Payouts"}
          </CardTitle>
          <CardDescription>
            {role === "manager" || role === "super_admin" ? (
              <>
                {email ? `Welcome, ${email}.` : "Welcome."} Please set your
                password to continue.
              </>
            ) : step === 1 ? (
              "Let's start with your basic contact information."
            ) : step === 2 ? (
              "Tell us a bit about your work and how you get paid."
            ) : step === 3 ? (
              "Choose a secure password to access your dashboard."
            ) : (
              "Connect your bank account to receive automated direct deposits for completed assignments."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setupError && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
              <p className="font-semibold mb-2">Account Already Exists</p>
              <p>{setupError}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => navigate("/login")}
              >
                Go to Login
              </Button>
            </div>
          )}
          {step < 4 ? (
            <form
              onSubmit={
                role === "contractor" && step < 3
                  ? (e) => {
                      e.preventDefault();
                      setStep(step + 1);
                    }
                  : handleSetup
              }
            >
              <div className="space-y-4">
                {role === "contractor" && step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St, City, ST 12345"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        required
                      />
                    </div>
                  </>
                )}

                {role === "contractor" && step === 2 && (
                  <>
                    <div className="flex flex-col items-center justify-center space-y-4 mb-4">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-full bg-muted overflow-hidden border-4 border-background flex items-center justify-center">
                          {headshotPreview ? (
                            <img
                              src={headshotPreview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        <input
                          type="file"
                          id="headshot"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setHeadshotFile(file);
                              setHeadshotPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-sm"
                          onClick={() =>
                            document.getElementById("headshot")?.click()
                          }
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      <Label className="text-sm font-medium">
                        Upload Headshot
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Short Bio</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us a little about yourself and your experience..."
                        value={formData.bio}
                        onChange={(e) =>
                          setFormData({ ...formData, bio: e.target.value })
                        }
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: Your headshot, bio, and first name will be
                        displayed to brides in their portal so they can get to
                        know their team. Confidential details like your address
                        are kept private.
                      </p>
                    </div>

                    <div className="mt-6 mb-4 p-4 rounded-xl border bg-muted/20 border-primary/10">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                        Bride Portal Preview
                      </Label>
                      <div className="flex items-start gap-4 p-4 border rounded-xl bg-card shadow-sm">
                        <div className="h-16 w-16 rounded-full bg-muted overflow-hidden border-2 border-primary/10 shrink-0">
                          {headshotPreview ? (
                            <img
                              src={headshotPreview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-primary/5 text-primary text-xl font-bold">
                              {(
                                formData.firstName?.[0] ||
                                formData.lastName?.[0] ||
                                "Y"
                              ).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-lg text-foreground truncate">
                            {formData.firstName || "Your Name"}{" "}
                            {formData.lastName?.charAt(0)}
                            {formData.lastName ? "." : ""}
                          </p>
                          <p className="text-xs text-primary font-medium mb-2 capitalize">
                            {specialtyParam || "Team Member"}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {formData.bio ||
                              "Your short bio will appear here to help the couple get to know you before their big day!"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="portfolioUrl">
                        Portfolio URL{" "}
                        <span className="text-muted-foreground font-normal">
                          (Optional)
                        </span>
                      </Label>
                      <Input
                        id="portfolioUrl"
                        type="url"
                        placeholder="https://..."
                        value={formData.portfolioUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            portfolioUrl: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="venmoHandle">
                        Venmo Handle{" "}
                        <span className="text-muted-foreground font-normal">
                          (Optional)
                        </span>
                      </Label>
                      <Input
                        id="venmoHandle"
                        placeholder="@username"
                        value={formData.venmoHandle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            venmoHandle: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        You can also connect Stripe for direct deposits in the
                        next steps.
                      </p>
                    </div>
                  </>
                )}

                {(role === "contractor" || role === "editor"
                  ? step === 3
                  : true) && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="password">New Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  {role === "contractor" && step > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(step - 1)}
                    >
                      Back
                    </Button>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading
                      ? "Saving..."
                      : role === "contractor" && step < 3
                        ? "Continue"
                        : "Complete Setup"}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <p className="text-muted-foreground">
                Your account is set up! To receive automated direct deposits for
                your completed assignments, you can connect your bank account
                via Stripe now.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={stripeCountry}
                    onValueChange={setStripeCountry}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="PH">Philippines</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        const token = session?.access_token;

                        const res = await fetch(
                          `${supabaseUrl}/functions/v1/stripe-onboard`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                              apikey: supabaseAnonKey,
                            },
                            body: JSON.stringify({
                              contractor_id:
                                role === "contractor"
                                  ? createdUserId
                                  : undefined,
                              user_id:
                                role === "editor" ? createdUserId : undefined,
                              user_type: role,
                              email: email,
                              country: stripeCountry,
                              return_url:
                                role === "editor"
                                  ? `${window.location.origin}/editor?stripe=success`
                                  : `${window.location.origin}/?stripe=success`,
                              refresh_url:
                                role === "editor"
                                  ? `${window.location.origin}/editor?stripe=refresh`
                                  : `${window.location.origin}/?stripe=refresh`,
                            }),
                          },
                        );

                        const data = await res.json();
                        if (data.error) throw new Error(data.error);
                        if (data.url) window.location.href = data.url;
                      } catch (e: any) {
                        toast({
                          variant: "destructive",
                          title: "Connection Failed",
                          description: e.message,
                        });
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? "Connecting..." : "Connect Stripe"}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (role === "editor") window.location.href = "/editor";
                    else window.location.href = "/";
                  }}
                  className="w-full"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
