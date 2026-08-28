import { useState, useEffect, useRef } from "react";
import {
  User,
  Mail,
  MapPin,
  Briefcase,
  Star,
  Settings,
  Camera,
  Shield,
  Loader2,
  DollarSign,
  Info,
  FileText,
  Upload,
  CheckCircle2,
  Sparkles,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { parseRegions } from "@/lib/utils";
import { BlackoutDatesManager } from "@/components/BlackoutDatesManager";

export default function Profile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeCountry, setStripeCountry] = useState("US");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    region: [] as string[],
    portfolio_url: "",
    specialty: "",
    venmo_handle: "",
    bio: "",
    gear_list: "",
    stripe_account_id: "",
    insurance_url: "",
    insurance_expiry: "",
    contract_url: "",
    contract_expiry: "",
    drone_license_url: "",
    drone_license_expiry: "",
  });

  // Fetch real profile data from Supabase
  const { data: profile, isLoading } = useQuery({
    queryKey: ["contractor-profile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .ilike("email", user.email)
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user?.email,
  });

  // Sync form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
        region: parseRegions(profile.region),
        portfolio_url: profile.portfolio_url || "",
        specialty: profile.specialty || "",
        venmo_handle: profile.venmo_handle || "",
        bio: profile.bio || "",
        gear_list: profile.gear_list || "",
        stripe_account_id: profile.stripe_account_id || "",
        insurance_url: profile.insurance_url || "",
        insurance_expiry: profile.insurance_expiry || "",
        contract_url: profile.contract_url || "",
        contract_expiry: profile.contract_expiry || "",
        drone_license_url: profile.drone_license_url || "",
        drone_license_expiry: profile.drone_license_expiry || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("stripe") === "success") {
      toast({
        title: "Stripe Connected",
        description: "Your Stripe account has been successfully linked.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("stripe") === "refresh") {
      toast({
        variant: "destructive",
        title: "Stripe connection incomplete",
        description: "Please try connecting your Stripe account again.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Save changes to Supabase
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      // Only updating fields we know exist in your current database schema
      if (!user?.email) throw new Error("User email not found");

      const { data: contractor } = await supabase
        .from("contractors")
        .select("id")
        .ilike("email", user.email)
        .limit(1);

      if (!contractor || contractor.length === 0)
        throw new Error("Contractor record not found");

      const { error } = await supabase
        .from("contractors")
        .update({
          first_name: updates.first_name,
          last_name: updates.last_name,
          phone: updates.phone,
          address: updates.address,
          specialty: updates.specialty,
          region: updates.region,
          venmo_handle: updates.venmo_handle,
          portfolio_url: updates.portfolio_url,
          bio: updates.bio,
          gear_list: updates.gear_list,
          stripe_account_id: updates.stripe_account_id,
          insurance_url: updates.insurance_url,
          insurance_expiry: updates.insurance_expiry,
          contract_url: updates.contract_url,
          contract_expiry: updates.contract_expiry,
          drone_license_url: updates.drone_license_url,
          drone_license_expiry: updates.drone_license_expiry,
        })
        .eq("id", contractor[0].id)
        .select();

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["contractor-profile", user?.email],
      });
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update profile",
        description: error.message,
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleToggleSetting = async (
    field: "email_notifications" | "sms_notifications",
    value: boolean,
  ) => {
    if (!user?.email) return;
    try {
      const { data: contractor } = await supabase
        .from("contractors")
        .select("id")
        .ilike("email", user.email)
        .limit(1);

      if (!contractor || contractor.length === 0)
        throw new Error("Contractor record not found");

      const { error } = await supabase
        .from("contractors")
        .update({ [field]: value })
        .eq("id", contractor[0].id);
      if (error) throw error;
      queryClient.invalidateQueries({
        queryKey: ["contractor-profile", user.email],
      });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: err.message,
      });
    }
  };

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "insurance_url" | "contract_url" | "drone_license_url",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user?.email) return;

    try {
      setUploadingDoc(field);

      const fileExt = file.name.split(".").pop();
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `docs/${field}-${safeEmail}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { data: contractor } = await supabase
        .from("contractors")
        .select("id")
        .ilike("email", user.email)
        .limit(1);

      if (!contractor || contractor.length === 0)
        throw new Error("Contractor record not found");

      const { error: updateError } = await supabase
        .from("contractors")
        .update({ [field]: publicUrl })
        .eq("id", contractor[0].id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({
        queryKey: ["contractor-profile", user.email],
      });

      toast({
        title: "Document uploaded!",
        description: "Your document has been securely saved.",
      });
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description:
          error.message || "Please make sure your storage bucket is set up.",
      });
    } finally {
      setUploadingDoc(null);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.email) return;

    try {
      setIsUploading(true);

      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${safeEmail}-${Date.now()}.${fileExt}`;

      // 1. Upload the image to the 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get the public URL for the image
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      if (!user?.email) throw new Error("User email not found");

      const { data: contractor } = await supabase
        .from("contractors")
        .select("id")
        .ilike("email", user.email)
        .limit(1);

      if (!contractor || contractor.length === 0)
        throw new Error("Contractor record not found");

      // 3. Update the contractor's profile in the database
      const { error: updateError } = await supabase
        .from("contractors")
        .update({ avatar_url: publicUrl })
        .eq("id", contractor[0].id);

      if (updateError) throw updateError;

      // Refresh the profile data
      queryClient.invalidateQueries({
        queryKey: ["contractor-profile", user.email],
      });
      queryClient.invalidateQueries({
        queryKey: ["contractor-avatar", user.email],
      });

      toast({
        title: "Profile picture updated!",
        description: "Your new avatar has been saved successfully.",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description:
          error.message ||
          "Please make sure your 'avatars' storage bucket is set up.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">
        Profile not found. Please log out and back in.
      </div>
    );
  }

  const fullName =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    "Contractor";
  const displayAvatar =
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

  const completionItems = [
    { label: "First Name", isComplete: !!profile.first_name },
    { label: "Last Name", isComplete: !!profile.last_name },
    { label: "Phone Number", isComplete: !!profile.phone },
    { label: "Home Address", isComplete: !!profile.address },
    {
      label: "Assigned Regions",
      isComplete:
        Array.isArray(parseRegions(profile.region)) &&
        parseRegions(profile.region).length > 0,
    },
    { label: "Portfolio URL", isComplete: !!profile.portfolio_url },
    { label: "Short Bio", isComplete: !!profile.bio },
    { label: "Gear List", isComplete: !!profile.gear_list },
    { label: "Venmo Handle", isComplete: !!profile.venmo_handle },
    { label: "Profile Picture", isComplete: !!profile.avatar_url },
  ];

  const completedCount = completionItems.filter(
    (item) => item.isComplete,
  ).length;
  const completionPercentage = Math.round(
    (completedCount / completionItems.length) * 100,
  );
  const missingFields = completionItems
    .filter((item) => !item.isComplete)
    .map((item) => item.label);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your contractor profile and settings.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-muted overflow-hidden border-4 border-background">
                    <img
                      src={displayAvatar}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Hidden file input for avatar upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{fullName}</h2>
                  <p className="text-sm text-muted-foreground">
                    {formData.region.length > 0
                      ? formData.region.join(", ")
                      : "No regions assigned"}
                  </p>
                </div>

                {profile.rating ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-yellow-500 font-medium cursor-help">
                          <Star className="h-4 w-4 fill-current" />
                          <span>{profile.rating} Rating</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-sm">
                          Your overall rating is calculated from:
                          <br />
                          • Client Feedback (40%)
                          <br />
                          • Editor Review (40%)
                          <br />• Submission Speed & Quality (20%)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}

                <div className="w-full pt-4 border-t flex flex-wrap gap-2 justify-center">
                  {profile.specialty ? (
                    <Badge variant="secondary">{profile.specialty}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No specialty assigned
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    Verified Contractor
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-green-500 border-green-500 capitalize"
                >
                  {profile.status || "Active"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Member since{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "recently"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Profile Completion
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Your profile information is used to match you with
                        appropriate assignments and is displayed to brides in
                        their portal so they can get to know their team.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} />
              </div>
              {missingFields.length > 0 && (
                <div className="text-xs text-muted-foreground mt-4">
                  <p className="font-medium mb-1 text-foreground">
                    Missing details:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {missingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Profile Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="documents">Compliance</TabsTrigger>
              <TabsTrigger value="blackout">Blackout Dates</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Update your contact details and portfolio.
                    </CardDescription>
                  </div>
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    onClick={() =>
                      isEditing ? handleSave() : setIsEditing(true)
                    }
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending
                      ? "Saving..."
                      : isEditing
                        ? "Save Changes"
                        : "Edit Profile"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              first_name: e.target.value,
                            })
                          }
                          className="pl-9"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              last_name: e.target.value,
                            })
                          }
                          className="pl-9"
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          defaultValue={profile.email}
                          className="pl-9 bg-muted"
                          disabled={true}
                          title="Email cannot be changed here"
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
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">Home Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              address: e.target.value,
                            })
                          }
                          className="pl-9"
                          placeholder="123 Main St, Austin, TX 78701"
                          disabled={!isEditing}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Used to calculate distance to job locations.
                      </p>
                    </div>

                    <div className="space-y-3 sm:col-span-2">
                      <Label>Assigned Regions</Label>
                      <div className="flex flex-wrap gap-4 p-4 border rounded-md bg-muted/30">
                        {(() => {
                          let availableRegions = ["Charlotte", "Raleigh"];
                          try {
                            const saved =
                              localStorage.getItem("veydra_regions");
                            if (saved) availableRegions = JSON.parse(saved);
                          } catch (e) {}

                          formData.region.forEach((r) => {
                            if (
                              r &&
                              r !== "All Regions" &&
                              !availableRegions.includes(r)
                            ) {
                              availableRegions.push(r);
                            }
                          });

                          return availableRegions.map((r) => (
                            <div
                              key={r}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`region-${r}`}
                                disabled={!isEditing}
                                checked={formData.region.includes(r)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      region: [...formData.region, r],
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      region: formData.region.filter(
                                        (reg) => reg !== r,
                                      ),
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`region-${r}`}
                                className="font-normal cursor-pointer"
                              >
                                {r}
                              </Label>
                            </div>
                          ));
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select all regions you are available to work in.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="portfolio">Portfolio URL</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="portfolio"
                          type="url"
                          value={formData.portfolio_url}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              portfolio_url: e.target.value,
                            })
                          }
                          className="pl-9"
                          disabled={!isEditing}
                          placeholder="https://"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bio">Short Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) =>
                          setFormData({ ...formData, bio: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="Tell us a little about yourself and your experience..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="gear_list">Gear List</Label>
                      <Textarea
                        id="gear_list"
                        value={formData.gear_list}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            gear_list: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        placeholder="List your camera bodies, lenses, and other equipment..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="venmo_handle">Venmo Handle</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="venmo_handle"
                          type="text"
                          value={formData.venmo_handle}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              venmo_handle: e.target.value,
                            })
                          }
                          className="pl-9"
                          disabled={!isEditing}
                          placeholder="@username"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Required to receive payouts.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Specialty</Label>
                      <Select
                        disabled={true}
                        value={formData.specialty}
                        onValueChange={(val) =>
                          setFormData({ ...formData, specialty: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your specialty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Photographer">
                            Photographer
                          </SelectItem>
                          <SelectItem value="Videographer">
                            Videographer
                          </SelectItem>
                          <SelectItem value="Photographer & Videographer">
                            Photographer & Videographer
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Your primary role for assignments. Only an admin can
                        update your specialty.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-6">
              {/* Native Digital Paperwork Section */}
              {(profile.w9_signature || profile.contract_signature) && (
                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Signed Digital Paperwork
                    </CardTitle>
                    <CardDescription>
                      View and download your officially signed tax forms and
                      agreements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.w9_signature && (
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-background shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">Form W-9</p>
                              <p className="text-xs text-muted-foreground">
                                Signed{" "}
                                {new Date(
                                  profile.w9_signed_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const content = document.createElement("div");
                              content.innerHTML = `
                              <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #000;">
                                <h1 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">Form W-9: Request for Taxpayer Identification Number</h1>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Name</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_name}</p>
                                  </div>
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Business Name</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_business_name || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Tax Classification</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_tax_classification}</p>
                                  </div>
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Address</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_address}</p>
                                  </div>
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">City, State, Zip</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_city_state_zip}</p>
                                  </div>
                                  <div>
                                    <p style="font-size: 12px; color: #666; margin: 0;">SSN / EIN</p>
                                    <p style="font-size: 16px; font-weight: bold; margin: 0;">${profile.w9_ssn_ein}</p>
                                  </div>
                                </div>
                                <div style="border-top: 1px solid #ccc; padding-top: 20px;">
                                  <p style="font-size: 12px; margin-bottom: 20px;">Under penalties of perjury, I certify that the information provided is correct and I am a U.S. person.</p>
                                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 8px; background: #fafafa;">
                                    <p style="font-size: 12px; color: #666; margin: 0;">Digitally Signed By</p>
                                    <p style="font-family: serif; font-size: 24px; font-style: italic; margin: 10px 0;">${profile.w9_signature}</p>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Date: ${new Date(profile.w9_signed_at).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            `;
                              const win = window.open("", "_blank");
                              win?.document.write(content.innerHTML);
                              win?.document.close();
                              win?.print();
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        </div>
                      )}

                      {profile.contract_signature && (
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-background shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                              <Shield className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                Contractor Agreement
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Signed{" "}
                                {new Date(
                                  profile.contract_signed_at,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const { data: settings } = await supabase
                                .from("portal_settings")
                                .select("contract_template, company_name")
                                .single();
                              const companyName =
                                settings?.company_name || "the Company";
                              const contractorName = `${profile.first_name} ${profile.last_name}`;
                              const signedDate = new Date(
                                profile.contract_signed_at,
                              ).toLocaleDateString();

                              const template =
                                settings?.contract_template ||
                                "<h1>Independent Contractor Agreement</h1>";
                              const processed = template
                                .replace(/{{company_name}}/g, companyName)
                                .replace(/{{contractor_name}}/g, contractorName)
                                .replace(/{{date}}/g, signedDate);

                              const content = document.createElement("div");
                              content.innerHTML = `
                              <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #000;">
                                ${processed}
                                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
                                  <div style="padding: 20px; border: 1px solid #eee; border-radius: 8px; background: #fafafa;">
                                    <p style="font-size: 12px; color: #666; margin: 0;">Agreed and Digitally Signed By</p>
                                    <p style="font-family: serif; font-size: 24px; font-style: italic; margin: 10px 0;">${profile.contract_signature}</p>
                                    <p style="font-size: 12px; color: #666; margin: 0;">Date: ${new Date(profile.contract_signed_at).toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            `;
                              const win = window.open("", "_blank");
                              win?.document.write(content.innerHTML);
                              win?.document.close();
                              win?.print();
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Compliance & Certifications</CardTitle>
                  <CardDescription>
                    Upload your required professional documents securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Native Digital Paperwork Section */}
                  {(profile.w9_signature || profile.contract_signature) && (
                    <div className="space-y-4 pb-6 border-b">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Native Digital Paperwork
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {profile.w9_signature && (
                          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  <span className="font-semibold text-sm">
                                    Verified W-9 Form
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Signed{" "}
                                  {new Date(
                                    profile.w9_signed_at,
                                  ).toLocaleDateString()}
                                </p>
                                <p className="text-[10px] font-mono text-blue-600/70">
                                  Signature: {profile.w9_signature}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] bg-white dark:bg-black"
                                onClick={() => {
                                  const win = window.open("", "_blank");
                                  if (win) {
                                    win.document.write(`
                                      <html>
                                        <head>
                                          <title>W-9 Form - ${profile.first_name} ${profile.last_name}</title>
                                          <style>
                                            body { font-family: sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: #333; }
                                            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                                            .field { margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                                            .label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; }
                                            .value { font-size: 16px; margin-top: 5px; }
                                            .signature-box { margin-top: 50px; padding: 20px; border: 1px solid #ccc; background: #f9f9f9; }
                                            .sig { font-family: cursive; font-size: 24px; border-bottom: 1px solid #333; display: inline-block; min-width: 200px; }
                                            @media print { .no-print { display: none; } }
                                          </style>
                                        </head>
                                        <body>
                                          <div class="header">
                                            <h1>Form W-9</h1>
                                            <p>Request for Taxpayer Identification Number and Certification</p>
                                          </div>
                                          <div class="field"><div class="label">Name</div><div class="value">${profile.w9_name}</div></div>
                                          <div class="field"><div class="label">Business Name</div><div class="value">${profile.w9_business_name || "N/A"}</div></div>
                                          <div class="field"><div class="label">Tax Classification</div><div class="value">${profile.w9_tax_classification}</div></div>
                                          <div class="field"><div class="label">Address</div><div class="value">${profile.w9_address}</div></div>
                                          <div class="field"><div class="label">City, State, Zip</div><div class="value">${profile.w9_city_state_zip}</div></div>
                                          <div class="field"><div class="label">SSN/EIN</div><div class="value">${profile.w9_ssn_ein}</div></div>
                                          <div class="signature-box">
                                            <div class="label">Certified Digital Signature</div>
                                            <div class="sig">${profile.w9_signature}</div>
                                            <div class="value" style="font-size: 12px; color: #666; margin-top: 10px;">Signed on: ${new Date(profile.w9_signed_at).toLocaleString()}</div>
                                          </div>
                                          <div style="margin-top: 30px;" class="no-print">
                                            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Print or Save as PDF</button>
                                          </div>
                                        </body>
                                      </html>
                                    `);
                                    win.document.close();
                                  }
                                }}
                              >
                                View/Print
                              </Button>
                            </div>
                          </Card>
                        )}

                        {profile.contract_signature && (
                          <Card className="p-4 border-purple-200 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-800">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-purple-600" />
                                  <span className="font-semibold text-sm">
                                    Signed Agreement
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Signed{" "}
                                  {new Date(
                                    profile.contract_signed_at,
                                  ).toLocaleDateString()}
                                </p>
                                <p className="text-[10px] font-mono text-purple-600/70">
                                  Signature: {profile.contract_signature}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] bg-white dark:bg-black"
                                onClick={() => {
                                  api.getPortalSettings().then((settings) => {
                                    const win = window.open("", "_blank");
                                    if (win) {
                                      const companyName =
                                        settings?.company_name || "the Company";
                                      const contractorName = `${profile.first_name} ${profile.last_name}`;
                                      const signedDate = new Date(
                                        profile.contract_signed_at,
                                      ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      });

                                      const processedTemplate =
                                        settings?.contract_template
                                          ? settings.contract_template
                                              .replace(
                                                /{{company_name}}/g,
                                                companyName,
                                              )
                                              .replace(
                                                /{{contractor_name}}/g,
                                                contractorName,
                                              )
                                              .replace(/{{date}}/g, signedDate)
                                          : `<h1>Independent Contractor Agreement</h1><p>Effective Date: ${signedDate}</p><p>This Agreement is between ${companyName} and ${contractorName}.</p>`;

                                      win.document.write(`
                                        <html>
                                          <head>
                                            <title>Contractor Agreement - ${contractorName}</title>
                                            <style>
                                              body { font-family: 'Inter', sans-serif; padding: 60px; line-height: 1.6; max-width: 850px; margin: 0 auto; color: #333; }
                                              .content { margin-bottom: 50px; }
                                              .signature-section { border-top: 2px solid #333; padding-top: 30px; margin-top: 50px; page-break-inside: avoid; }
                                              .sig-line { font-family: 'Brush Script MT', cursive; font-size: 32px; margin-bottom: 10px; }
                                              @media print { .no-print { display: none; } }
                                            </style>
                                          </head>
                                          <body>
                                            <div class="content">${processedTemplate}</div>
                                            <div class="signature-section">
                                              <div style="display: flex; justify-content: space-between;">
                                                <div>
                                                  <div class="sig-line">${profile.contract_signature}</div>
                                                  <div style="font-weight: bold; border-top: 1px solid #333; padding-top: 5px;">${contractorName}</div>
                                                  <div style="font-size: 12px; color: #666;">Digitally Signed: ${new Date(profile.contract_signed_at).toLocaleString()}</div>
                                                </div>
                                                <div style="text-align: right;">
                                                  <div style="height: 48px;"></div>
                                                  <div style="font-weight: bold; border-top: 1px solid #333; padding-top: 5px;">${companyName}</div>
                                                  <div style="font-size: 12px; color: #666;">Authorized Signature</div>
                                                </div>
                                              </div>
                                            </div>
                                            <div style="margin-top: 40px;" class="no-print">
                                              <button onclick="window.print()" style="padding: 12px 24px; background: #333; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Download as PDF / Print</button>
                                            </div>
                                          </body>
                                        </html>
                                      `);
                                      win.document.close();
                                    }
                                  });
                                }}
                              >
                                View/Print
                              </Button>
                            </div>
                          </Card>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Liability Insurance */}

                  <div className="flex flex-col p-4 border rounded-lg bg-card gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-full ${formData.insurance_url ? "bg-green-100 text-green-600" : "bg-muted"}`}
                        >
                          {formData.insurance_url ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">
                            Liability Insurance
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Upload your current certificate of insurance.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.insurance_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={formData.insurance_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            id="insurance_upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) =>
                              handleDocumentUpload(e, "insurance_url")
                            }
                            disabled={uploadingDoc === "insurance_url"}
                          />
                          <Button
                            variant={
                              formData.insurance_url ? "secondary" : "default"
                            }
                            size="sm"
                            disabled={uploadingDoc === "insurance_url"}
                          >
                            {uploadingDoc === "insurance_url" ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {formData.insurance_url ? "Replace" : "Upload"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="insurance_expiry" className="text-xs">
                          Expiration Date
                        </Label>
                        <Input
                          id="insurance_expiry"
                          type="date"
                          value={formData.insurance_expiry}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              insurance_expiry: e.target.value,
                            });
                            updateMutation.mutate({
                              ...formData,
                              insurance_expiry: e.target.value,
                            });
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        {formData.insurance_expiry &&
                          new Date(formData.insurance_expiry) < new Date() && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Document Expired
                            </Badge>
                          )}
                        {formData.insurance_expiry &&
                          new Date(formData.insurance_expiry) > new Date() &&
                          new Date(formData.insurance_expiry) <
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-orange-500 border-orange-200 bg-orange-50"
                            >
                              Expires Soon
                            </Badge>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Drone License */}
                  <div className="flex flex-col p-4 border rounded-lg bg-card gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-full ${formData.drone_license_url ? "bg-green-100 text-green-600" : "bg-muted"}`}
                        >
                          {formData.drone_license_url ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">
                            Drone License (Part 107)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Required if you are flying drones for assignments.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.drone_license_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={formData.drone_license_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            id="drone_upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) =>
                              handleDocumentUpload(e, "drone_license_url")
                            }
                            disabled={uploadingDoc === "drone_license_url"}
                          />
                          <Button
                            variant={
                              formData.drone_license_url
                                ? "secondary"
                                : "default"
                            }
                            size="sm"
                            disabled={uploadingDoc === "drone_license_url"}
                          >
                            {uploadingDoc === "drone_license_url" ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {formData.drone_license_url ? "Replace" : "Upload"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="drone_expiry" className="text-xs">
                          Expiration Date
                        </Label>
                        <Input
                          id="drone_expiry"
                          type="date"
                          value={formData.drone_license_expiry}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              drone_license_expiry: e.target.value,
                            });
                            updateMutation.mutate({
                              ...formData,
                              drone_license_expiry: e.target.value,
                            });
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        {formData.drone_license_expiry &&
                          new Date(formData.drone_license_expiry) <
                            new Date() && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Document Expired
                            </Badge>
                          )}
                        {formData.drone_license_expiry &&
                          new Date(formData.drone_license_expiry) >
                            new Date() &&
                          new Date(formData.drone_license_expiry) <
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-orange-500 border-orange-200 bg-orange-50"
                            >
                              Expires Soon
                            </Badge>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Signed Contract */}
                  <div className="flex flex-col p-4 border rounded-lg bg-card gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-2 rounded-full ${formData.contract_url ? "bg-green-100 text-green-600" : "bg-muted"}`}
                        >
                          {formData.contract_url ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">
                            Contractor Agreement
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Upload your signed contractor agreement.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData.contract_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={formData.contract_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            id="contract_upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) =>
                              handleDocumentUpload(e, "contract_url")
                            }
                            disabled={uploadingDoc === "contract_url"}
                          />
                          <Button
                            variant={
                              formData.contract_url ? "secondary" : "default"
                            }
                            size="sm"
                            disabled={uploadingDoc === "contract_url"}
                          >
                            {uploadingDoc === "contract_url" ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {formData.contract_url ? "Replace" : "Upload"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor="contract_expiry" className="text-xs">
                          Renewal Date
                        </Label>
                        <Input
                          id="contract_expiry"
                          type="date"
                          value={formData.contract_expiry}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              contract_expiry: e.target.value,
                            });
                            updateMutation.mutate({
                              ...formData,
                              contract_expiry: e.target.value,
                            });
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        {formData.contract_expiry &&
                          new Date(formData.contract_expiry) < new Date() && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Contract Expired
                            </Badge>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="blackout" className="mt-4">
              <BlackoutDatesManager contractorId={profile.id} />
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>
                    Manage your app settings and notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Stripe Payouts
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Connect your Stripe account to receive direct payouts.
                        </p>
                      </div>
                      {formData.stripe_account_id ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-600 border-green-200"
                          >
                            Connected
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                stripe_account_id: "",
                              }));
                              updateMutation.mutate({
                                ...formData,
                                stripe_account_id: null,
                              });
                              toast({
                                title: "Stripe Disconnected",
                                description:
                                  "Your Stripe account has been removed.",
                              });
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            value={stripeCountry}
                            onValueChange={setStripeCountry}
                            disabled={isConnectingStripe}
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
                            variant="outline"
                            disabled={isConnectingStripe}
                            onClick={async () => {
                              if (!profile?.id || !user?.email) return;
                              setIsConnectingStripe(true);
                              try {
                                const returnUrl = `${window.location.origin}/profile?stripe=success`;
                                const refreshUrl = `${window.location.origin}/profile?stripe=refresh`;

                                // Direct fetch to bypass Supabase client JWT formatting issues
                                let {
                                  data: { session },
                                } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  const { data } =
                                    await supabase.auth.refreshSession();
                                  session = data.session;
                                }

                                const token = session?.access_token;
                                if (!token || !token.startsWith("eyJ")) {
                                  throw new Error(
                                    "Your session has expired. Please log out and log back in.",
                                  );
                                }

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
                                      contractor_id: profile.id,
                                      email: user.email,
                                      country: stripeCountry,
                                      return_url: returnUrl,
                                      refresh_url: refreshUrl,
                                    }),
                                  },
                                );

                                if (!res.ok) {
                                  let errorText = `Server returned ${res.status}`;
                                  try {
                                    const json = await res.json();
                                    if (json.error) errorText = json.error;
                                  } catch (e) {
                                    try {
                                      const text = await res.text();
                                      if (text) errorText = text;
                                    } catch (e2) {}
                                  }
                                  throw new Error(
                                    errorText ||
                                      "Failed to initialize Stripe onboarding",
                                  );
                                }

                                const data = await res.json();

                                if (data?.url) {
                                  window.open(data.url, "_blank");
                                  setIsConnectingStripe(false);
                                } else {
                                  throw new Error(
                                    "No URL returned from Stripe",
                                  );
                                }
                              } catch (err: any) {
                                console.error("Stripe Onboard Error:", err);
                                toast({
                                  variant: "destructive",
                                  title: "Failed to connect Stripe",
                                  description:
                                    err.message ||
                                    "An error occurred while connecting to Stripe.",
                                });
                                setIsConnectingStripe(false);
                              }
                            }}
                          >
                            {isConnectingStripe ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Connect Stripe
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive emails about new job opportunities.
                        </p>
                      </div>
                      <Switch
                        checked={profile.email_notifications !== false}
                        onCheckedChange={(checked) =>
                          handleToggleSetting("email_notifications", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">SMS Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive text messages for assignment updates.
                        </p>
                      </div>
                      <Switch
                        checked={profile.sms_notifications !== false}
                        onCheckedChange={(checked) =>
                          handleToggleSetting("sms_notifications", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive browser push notifications for new jobs.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if ("Notification" in window) {
                            try {
                              const permission =
                                await Notification.requestPermission();
                              if (permission === "granted") {
                                toast({
                                  title: "Notifications enabled",
                                  description:
                                    "You will now receive push notifications for new jobs.",
                                });
                                if ("serviceWorker" in navigator) {
                                  await navigator.serviceWorker.register(
                                    "/sw.js",
                                  );
                                }
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: "Notifications disabled",
                                  description:
                                    "You denied permission for push notifications. You can change this in your browser settings.",
                                });
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          } else {
                            const isIOS =
                              /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                              (navigator.platform === "MacIntel" &&
                                navigator.maxTouchPoints > 1);
                            if (isIOS) {
                              toast({
                                variant: "destructive",
                                title: "Add to Home Screen Required",
                                description:
                                  "To enable push notifications on iPhone/iPad, please tap 'Share' then 'Add to Home Screen' first.",
                              });
                            } else {
                              toast({
                                variant: "destructive",
                                title: "Not supported",
                                description:
                                  "Your browser does not support push notifications.",
                              });
                            }
                          }
                        }}
                      >
                        Enable Push
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
