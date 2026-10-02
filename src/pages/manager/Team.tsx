import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
import { TeamAddAdminDialog } from "@/components/TeamAddAdminDialog";
import {
  sendInviteNotifications,
  sendResetNotifications,
} from "@/lib/team-invite-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Trash2,
  Loader2,
  Key,
  Mail,
  MoreHorizontal,
  Edit,
  Camera,
  LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface TerritoryLite {
  id: string;
  name: string;
  slug: string | null;
}

export default function ManagerTeam() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [, setRefreshTrigger] = useState(0);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();

  // Load territories (id, name, slug) once for the Team page — used for the
  // Area badge on each member and the Area <Select> on invite / edit. Falls
  // back to the Honeysuckle single-area option when the table is empty.
  const { data: territories = [] } = useQuery({
    queryKey: ["team-territories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("territories")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (error && error.code !== "42P01") throw error;
      return (data || []) as TerritoryLite[];
    },
  });

  const areaOptions: TerritoryLite[] =
    territories.length > 0
      ? territories
      : [{ id: HONEYSUCKLE_TERRITORY_ID, name: "Honeysuckle", slug: null }];

  const territoryNameById = (id?: string | null): string => {
    if (!id) return "Honeysuckle";
    const t = territories.find((x) => x.id === id);
    return t?.name || "Honeysuckle";
  };

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ["managers", "team-territory"],
    queryFn: () => loadTeamForTerritory(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (member: any) => {
      const idsToDelete = [member.id];
      if (member.email) {
        const { data: editors } = await supabase
          .from("editors")
          .select("id")
          .eq("email", member.email);
        if (editors) editors.forEach((e) => idsToDelete.push(e.id));
        const { data: mgrs } = await supabase
          .from("managers")
          .select("id")
          .eq("email", member.email);
        if (mgrs) mgrs.forEach((m) => idsToDelete.push(m.id));
      }
      const uniqueIds = [...new Set(idsToDelete)];
      for (const id of uniqueIds) {
        await supabase
          .from("weddings")
          .update({ editor_id: null })
          .eq("editor_id", id);
        await supabase
          .from("messages")
          .delete()
          .or(`sender_id.eq.${id},receiver_id.eq.${id}`);
        await supabase.from("activity_logs").delete().eq("manager_id", id);
        await supabase.from("notifications").delete().eq("contractor_id", id);
        await supabase.from("invoices").delete().eq("contractor_id", id);
        await supabase.from("assignments").delete().eq("contractor_id", id);
        await supabase.from("applications").delete().eq("contractor_id", id);
      }
      if (member.email) {
        const { error: edError } = await supabase
          .from("editors")
          .delete()
          .eq("email", member.email);
        if (edError && edError.code !== "42P01")
          throw new Error(`Editor delete failed: ${edError.message}`);
        const { error: mgError } = await supabase
          .from("managers")
          .delete()
          .eq("email", member.email);
        if (mgError && mgError.code !== "42P01")
          throw new Error(`Manager delete failed: ${mgError.message}`);
      }
      for (const id of uniqueIds) {
        const { error: idError1 } = await supabase
          .from("editors")
          .delete()
          .eq("id", id);
        if (idError1 && idError1.code !== "42P01")
          throw new Error(`Editor ID delete failed: ${idError1.message}`);
        const { error: idError2 } = await supabase
          .from("managers")
          .delete()
          .eq("id", id);
        if (idError2 && idError2.code !== "42P01")
          throw new Error(`Manager ID delete failed: ${idError2.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({
        title: "Team member removed",
        description: "The team member has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove team member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { member: any; updates: any }) => {
      const { member, updates } = data;
      // territory_id lives on the managers table only; preserve it across
      // role conversions where a managers row is (re)created.
      const territoryId =
        updates.territory_id || member.territory_id || HONEYSUCKLE_TERRITORY_ID;

      if (member.role === "editor" && updates.role !== "editor") {
        await api.removeEditor(member.id).catch(() => {});
        await supabase.from("managers").delete().eq("email", member.email);
        return api.addManager({
          id: member.id,
          name: updates.name,
          email: member.email,
          role: updates.role,
          status: member.status,
          avatar_url: member.avatar_url,
          territory_id: territoryId,
        } as any);
      } else if (member.role !== "editor" && updates.role === "editor") {
        await api.removeManager(member.id).catch(() => {});
        if (member.status === "invited") {
          return api.addManager({
            id: member.id,
            name: updates.name,
            email: member.email,
            role: "editor",
            status: "invited",
            avatar_url: member.avatar_url,
            territory_id: territoryId,
          } as any);
        }
        return api.addEditor({
          id: member.id,
          name: updates.name,
          email: member.email,
          status: member.status,
          avatar_url: member.avatar_url,
        });
      }

      if (updates.role === "editor" || member.role === "editor") {
        return api.updateEditor(member.id, { name: updates.name });
      } else {
        await supabase
          .from("managers")
          .update({ name: updates.name, role: updates.role })
          .eq("email", member.email);
        // Update managers.territory_id only (plus name/role as today); do not
        // overwrite email or other fields.
        return api.updateManager(member.id, {
          name: updates.name,
          role: updates.role,
          territory_id: territoryId,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({
        title: "Team member updated",
        description: "Team member details have been updated.",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update team member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    const originalMember = managers.find((m: any) => m.id === editingAdmin.id);
    updateMutation.mutate({
      member: originalMember,
      updates: {
        name: editingAdmin.name,
        role: editingAdmin.role || "manager",
        territory_id: editingAdmin.territory_id || HONEYSUCKLE_TERRITORY_ID,
      },
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingAdmin) return;
    try {
      setIsUploadingAvatar(true);
      const fileExt = file.name.split(".").pop();
      const safeEmail = editingAdmin.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `admin-${safeEmail}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setEditingAdmin({ ...editingAdmin, avatar_url: publicUrl });
      if (editingAdmin.role === "editor") {
        await supabase
          .from("editors")
          .update({ avatar_url: publicUrl })
          .eq("email", editingAdmin.email);
      } else {
        const { error: updateError } = await supabase
          .from("managers")
          .update({ avatar_url: publicUrl })
          .eq("email", editingAdmin.email);
        if (updateError) throw updateError;
      }
      queryClient.invalidateQueries({ queryKey: ["managers"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteInvite = async (member: any) => {
    deleteMutation.mutate(member);
  };

  const handleResendInvite = async (manager: any) => {
    try {
      const token = crypto.randomUUID();
      const settings = await api.getPortalSettings();
      const baseUrl = window.location.origin;
      const setupUrl = `${baseUrl}/setup-password?email=${encodeURIComponent(manager.email)}&token=${token}&role=${manager.role || "manager"}&name=${encodeURIComponent(manager.name)}`;
      await sendInviteNotifications({
        role: manager.role || "manager",
        name: manager.name,
        email: manager.email,
        settings,
        baseUrl,
        setupUrl,
      });
      const webhookUrl =
        settings?.admin_invite_webhook ||
        localStorage.getItem("veydra_admin_invite_webhook");
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: manager.name.split(" ")[0],
            last_name: manager.name.split(" ").slice(1).join(" "),
            full_name: manager.name,
            email: manager.email,
            tags: ["invited-manager"],
            setup_token: token,
            setup_url: setupUrl,
          }),
        }).catch(console.error);
      }
      toast({
        title: "Invite resent",
        description: `A new invitation was sent to ${manager.email}.`,
      });
    } catch (e) {
      console.error("Failed to resend invite", e);
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: "Could not send the invitation.",
      });
    }
  };

  const handleDeleteAdmin = (member: any) => {
    if (member.id === user?.id) {
      toast({
        title: "Action not allowed",
        description: "You cannot remove your own access.",
        variant: "destructive",
      });
      return;
    }
    setMemberToDelete(member);
  };

  const handleSendResetEmail = async (email: string) => {
    try {
      const settings = await api.getPortalSettings();
      const baseUrl = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      });
      if (error) throw error;
      await api.logApiEvent(
        "Supabase Auth",
        `Reset Password requested for ${email}`,
        "Success",
        "success",
      );
      try {
        const manager = managers.find((m) => m.email === email);
        const managerName = manager?.name || email.split("@")[0];
        await sendResetNotifications({
          role: manager?.role || "manager",
          name: managerName,
          email,
          settings,
          baseUrl,
        });
      } catch (err) {
        console.warn("Could not send notifications for password reset", err);
      }
      toast({
        title: "Reset email sent",
        description: `A password reset link has been sent to ${email}.`,
      });
    } catch (error: any) {
      await api.logApiEvent(
        "Supabase Auth",
        `Reset Password Failed for ${email}`,
        error.message,
        "error",
      );
      toast({
        title: "Failed to send reset email",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id === "m1") {
      toast({
        title: "Action not allowed",
        description:
          "You are logged in using the fallback hardcoded account. To change your password, please create a new Admin account for yourself, log in with that, and then you can manage your password.",
        variant: "destructive",
      });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
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

  const allManagers = Array.isArray(managers) ? managers : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Team Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage admin access to the manager portal.
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog
            open={isPasswordDialogOpen}
            onOpenChange={setIsPasswordDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Key className="h-4 w-4" /> Change My Password
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>
                  Update the password for your own manager account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
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

          <TeamAddAdminDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            managers={allManagers}
            onInvited={(name) => {
              setRefreshTrigger((prev) => prev + 1);
              toast({
                title: "Admin Invited",
                description: `${name} has been sent an invitation link.`,
              });
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Active Administrators
          </CardTitle>
          <CardDescription>
            These users have full access to the manager portal, including jobs,
            weddings, and contractor data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allManagers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Shield className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>No database admins found.</p>
              <p className="text-sm mt-1">
                Add an admin using the button above.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allManagers.map((manager: any) => (
                    <TableRow key={manager.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={manager.avatar_url} />
                            <AvatarFallback>
                              {manager.name?.charAt(0) ||
                                manager.email?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {manager.name}
                              {manager.id === user?.id && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-normal">
                              {manager.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {isSuperAdminEmail(manager.email)
                            ? "All"
                            : territoryNameById(manager.territory_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {manager.role === "owner_readonly"
                            ? "Owner (Read Only)"
                            : manager.role
                              ? manager.role.replace("_", " ")
                              : "Manager"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {manager.role === "editor" &&
                          (manager.stripe_account_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-indigo-50/50 text-indigo-600"
                            >
                              Stripe Connected
                            </Badge>
                          ) : manager.venmo_handle ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-sky-50/50 text-sky-600"
                            >
                              Venmo Added
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-red-50/50 text-red-600"
                            >
                              No Payment Info
                            </Badge>
                          ))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            manager.status === "invited"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {manager.status === "invited" ? "Invited" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(manager.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {manager.status === "invited" ? (
                          <div className="flex justify-end gap-2 items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingAdmin(manager);
                                setIsEditDialogOpen(true);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              title="Edit Admin Role"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(manager)}
                                >
                                  Resend Invite
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                  onClick={() => handleDeleteInvite(manager)}
                                >
                                  Delete Invite
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 items-center">
                            {manager.id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  let targetRole = manager.role || "manager";
                                  if (targetRole === "super_admin")
                                    targetRole = "super_admin";
                                  if (targetRole === "owner_readonly")
                                    targetRole = "owner_readonly";
                                  impersonate({
                                    id: manager.id,
                                    name: manager.name,
                                    email: manager.email,
                                    role: targetRole as any,
                                  });
                                  if (targetRole === "editor")
                                    navigate("/editor");
                                  else navigate("/manager");
                                  toast({
                                    title: `Logged in as ${manager.name}`,
                                    description: `You are now impersonating ${manager.name} (${targetRole})`,
                                  });
                                }}
                                className="text-primary hover:bg-primary/10 gap-1 text-xs"
                                title={`Log in as ${manager.name}`}
                              >
                                <LogIn className="h-4 w-4" /> Log in as
                              </Button>
                            )}
                            {manager.id === user?.id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsPasswordDialogOpen(true)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Key className="h-4 w-4 mr-2" /> Reset Password
                              </Button>
                            ) : manager.role !== "owner" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSendResetEmail(manager.email)
                                }
                                className="text-muted-foreground hover:text-foreground"
                                title="Send Password Reset Email"
                              >
                                <Mail className="h-4 w-4 mr-2" /> Reset Password
                              </Button>
                            ) : null}
                            {(manager.role !== "owner" ||
                              manager.id === user?.id) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingAdmin(manager);
                                  setIsEditDialogOpen(true);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Edit Admin"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAdmin(manager)}
                              disabled={
                                manager.id === user?.id ||
                                manager.role === "super_admin" ||
                                (manager.role === "owner" &&
                                  user?.role !== "super_admin") ||
                                (manager.role === "owner_readonly" &&
                                  user?.role !== "super_admin") ||
                                isSuperAdminEmail(manager.email) ||
                                deleteMutation.isPending
                              }
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Remove Team Member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Administrator</DialogTitle>
            <DialogDescription>
              Update details and permissions for this admin.
            </DialogDescription>
          </DialogHeader>
          {editingAdmin && (
            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div className="flex flex-col items-center gap-4 mb-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={editingAdmin.avatar_url} />
                  <AvatarFallback>
                    {editingAdmin.name?.charAt(0) ||
                      editingAdmin.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    className="hidden"
                    accept="image/*"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Upload Photo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editingAdmin.name || ""}
                  onChange={(e) =>
                    setEditingAdmin({ ...editingAdmin, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editingAdmin.role || "manager"}
                  onValueChange={(value) =>
                    setEditingAdmin({ ...editingAdmin, role: value })
                  }
                  disabled={
                    editingAdmin.role === "super_admin" ||
                    isSuperAdminEmail(editingAdmin.email)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {user?.role === "super_admin" && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="owner_readonly">
                      Owner (Read Only)
                    </SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="read_only">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-area">Area</Label>
                <Select
                  value={editingAdmin.territory_id || HONEYSUCKLE_TERRITORY_ID}
                  onValueChange={(value) =>
                    setEditingAdmin({ ...editingAdmin, territory_id: value })
                  }
                  disabled={
                    editingAdmin.role === "super_admin" ||
                    isSuperAdminEmail(editingAdmin.email)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToDelete?.name}? They will
              lose access to the portal immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate(memberToDelete);
                setMemberToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
