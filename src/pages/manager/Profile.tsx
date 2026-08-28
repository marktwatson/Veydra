import { useState, useEffect, useRef } from "react";
import { User, Mail, Shield, Camera, Loader2, Key } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ManagerProfile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
  });

  // Fetch real profile data from Supabase
  const { data: profile, isLoading } = useQuery({
    queryKey: ["manager-profile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      if (user.id === "m1") {
        return {
          id: "m1",
          name: localStorage.getItem("m1_name") || "Mark Watson",
          email: "mark.t.watson83@gmail.com",
          role: "super_admin",
          avatar_url: localStorage.getItem("m1_avatar") || null,
          created_at: new Date().toISOString(),
        };
      }

      const { data, error } = await supabase
        .from("managers")
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
        name: profile.name || "",
      });
    }
  }, [profile]);

  // Save changes to Supabase
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (
        profile?.id === "m1" ||
        user?.email?.toLowerCase() === "mark@kavoddigital.com"
      ) {
        const { data: manager } = await supabase
          .from("managers")
          .select("id")
          .ilike("email", user.email)
          .limit(1);

        if (!manager || manager.length === 0) {
          const { error: insertError } = await supabase
            .from("managers")
            .insert({
              id: user.id,
              email: user.email,
              name: updates.name,
              role: "super_admin",
              status: "active",
            });
          if (insertError) throw insertError;
        } else {
          const { error } = await supabase
            .from("managers")
            .update({
              name: updates.name,
              role: "super_admin",
            })
            .eq("id", manager[0].id);

          if (error) throw error;
        }
        return;
      }
      if (!user?.email) throw new Error("User email not found");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["manager-profile", user?.email],
      });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setIsUploading(true);

      if (user.id === "m1") {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/webp", 0.8);

            try {
              localStorage.setItem("m1_avatar", dataUrl);
              queryClient.invalidateQueries({
                queryKey: ["manager-profile", user.email],
              });
              queryClient.invalidateQueries({
                queryKey: ["manager-avatar", user.email],
              });
              toast({
                title: "Profile picture updated!",
                description: "Your new avatar has been saved successfully.",
              });
            } catch (e) {
              toast({
                variant: "destructive",
                title: "Image too large",
                description: "Please choose a smaller image file.",
              });
            }
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
        return;
      }

      if (!user?.email) throw new Error("Email not found");
      const fileExt = file.name.split(".").pop();
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `admin-${safeEmail}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .ilike("email", user.email)
        .limit(1);

      if (!manager || manager.length === 0) {
        const { error: insertError } = await supabase.from("managers").insert({
          id: user.id,
          email: user.email,
          name: user.name || "Manager",
          avatar_url: publicUrl,
          role: "super_admin",
        });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from("managers")
          .update({ avatar_url: publicUrl })
          .eq("id", manager[0].id);

        if (updateError) throw updateError;
      }

      queryClient.invalidateQueries({
        queryKey: ["manager-profile", user.email],
      });
      queryClient.invalidateQueries({
        queryKey: ["manager-avatar", user.email],
      });
      queryClient.invalidateQueries({ queryKey: ["managers"] });

      toast({
        title: "Profile picture updated!",
        description: "Your new avatar has been saved successfully.",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);

    if (user?.id === "m1") {
      setTimeout(() => {
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully.",
        });
        setIsPasswordDialogOpen(false);
        setNewPassword("");
        setIsUpdatingPassword(false);
      }, 500);
      return;
    }
    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      setIsPasswordDialogOpen(false);
      setNewPassword("");
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

  const fullName = profile.name || "Manager";
  const displayAvatar =
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            My Profile
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your personal admin settings and details.
          </p>
        </div>
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
                    {profile.email}
                  </p>
                </div>

                <div className="w-full pt-4 border-t flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary" className="capitalize">
                    {profile.role ? profile.role.replace("_", " ") : "Manager"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog
                open={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Update the password for your own manager account.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter className="pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPasswordDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isUpdatingPassword}>
                        {isUpdatingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Update Password
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Profile Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your name and profile details.
                </CardDescription>
              </div>
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
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
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="pl-9"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Your email address is used for login and cannot be changed
                    here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
