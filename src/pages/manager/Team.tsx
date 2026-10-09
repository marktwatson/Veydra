import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
import { loadTeamForTerritory } from "@/lib/team-territory-scoped";
import { TeamAddAdminDialog } from "@/components/TeamAddAdminDialog";
import { TeamEditAdminDialog } from "@/components/TeamEditAdminDialog";
import { TeamDeleteAdminDialog } from "@/components/TeamDeleteAdminDialog";
import { TeamMemberActions } from "@/components/TeamMemberActions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Loader2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import {
  applyHomeAreaOnLogin,
  stashViewArea,
} from "@/lib/current-territory";

interface TerritoryLite {
  id: string;
  name: string;
  slug: string | null;
}

export default function ManagerTeam() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [, setRefreshTrigger] = useState(0);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();

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

  const handleImpersonate = async (manager: any) => {
    let targetRole = manager.role || "manager";
    if (targetRole === "super_admin") targetRole = "super_admin";
    if (targetRole === "owner_readonly") targetRole = "owner_readonly";
    const opensAnArea =
      targetRole === "manager" ||
      targetRole === "owner" ||
      targetRole === "owner_readonly";
    if (opensAnArea) stashViewArea();
    impersonate({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: targetRole as any,
    });
    if (opensAnArea) {
      await applyHomeAreaOnLogin();
      window.location.href = "/manager";
      return;
    }
    if (targetRole === "editor") navigate("/editor");
    else navigate("/manager");
    toast({
      title: `Logged in as ${manager.name}`,
      description: `You are now impersonating ${manager.name} (${targetRole})`,
    });
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
            <>
            <div className="space-y-3 md:hidden">
              {allManagers.map((manager: any) => (
                <div key={manager.id} className="space-y-3 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {manager.name}
                        {manager.id === user?.id ? " · You" : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">{manager.email}</div>
                    </div>
                    <TeamMemberActions
                      manager={manager}
                      user={user}
                      onEdit={(m) => {
                        setEditingAdmin(m);
                        setIsEditDialogOpen(true);
                      }}
                      onDelete={handleDeleteAdmin}
                      onResendInvite={handleResendInvite}
                      onDeleteInvite={handleDeleteInvite}
                      onSendResetEmail={handleSendResetEmail}
                      onOpenOwnPassword={() => setIsPasswordDialogOpen(true)}
                      onImpersonate={handleImpersonate}
                      isDeleting={deleteMutation.isPending}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md border px-2 py-1">
                      {isSuperAdminEmail(manager.email)
                        ? "All Areas"
                        : Array.isArray(manager.territory_ids) && manager.territory_ids.length > 1
                          ? manager.territory_ids.map((tid: string) => territoryNameById(tid)).join(", ")
                          : territoryNameById(manager.territory_id)}
                    </span>
                    <span className="rounded-md border px-2 py-1">
                      {manager.role === "super_admin" || isSuperAdminEmail(manager.email)
                        ? "Super Admin"
                        : manager.role === "owner"
                          ? "Owner"
                          : manager.role === "owner_readonly"
                            ? "Owner (Read Only)"
                            : manager.role === "editor"
                              ? "Editor"
                              : manager.role === "read_only"
                                ? "Read Only"
                                : "Manager"}
                    </span>
                    <span className="rounded-md border px-2 py-1">
                      {manager.status === "invited" ? "Invited" : "Active"}
                    </span>
                    {manager.role === "editor" && (
                      <span className="rounded-md border px-2 py-1">
                        {manager.stripe_account_id
                          ? "Stripe Connected"
                          : manager.venmo_handle
                            ? "Venmo Added"
                            : "No Payment Info"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Added {new Date(manager.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden rounded-md border md:block">
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
                      <TableCell className="align-middle">
                        {isSuperAdminEmail(manager.email) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 whitespace-nowrap">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            All Areas
                          </span>
                        ) : Array.isArray(manager.territory_ids) &&
                          manager.territory_ids.length > 1 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {manager.territory_ids.map((tid: string) => (
                              <span
                                key={tid}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-foreground border border-border/60 whitespace-nowrap"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                                {territoryNameById(tid)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/80 text-foreground border border-border/60 whitespace-nowrap">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {territoryNameById(manager.territory_id)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        {manager.role === "super_admin" ||
                        isSuperAdminEmail(manager.email) ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            Super Admin
                          </span>
                        ) : manager.role === "owner" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            Owner
                          </span>
                        ) : manager.role === "owner_readonly" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            Owner (Read Only)
                          </span>
                        ) : manager.role === "editor" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            Editor
                          </span>
                        ) : manager.role === "read_only" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Read Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            Manager
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        {manager.role === "editor" ? (
                          manager.stripe_account_id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
                              Stripe Connected
                            </span>
                          ) : manager.venmo_handle ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap">
                              Venmo Added
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 whitespace-nowrap">
                              No Payment Info
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground/60">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-nowrap">
                        {manager.status === "invited" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Invited
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap align-middle text-xs">
                        {new Date(manager.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <TeamMemberActions
                          manager={manager}
                          user={user}
                          onEdit={(m) => {
                            setEditingAdmin(m);
                            setIsEditDialogOpen(true);
                          }}
                          onDelete={handleDeleteAdmin}
                          onResendInvite={handleResendInvite}
                          onDeleteInvite={handleDeleteInvite}
                          onSendResetEmail={handleSendResetEmail}
                          onOpenOwnPassword={() =>
                            setIsPasswordDialogOpen(true)
                          }
                          onImpersonate={handleImpersonate}
                          isDeleting={deleteMutation.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <TeamEditAdminDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        admin={editingAdmin}
        territories={territories}
      />

      <TeamDeleteAdminDialog
        member={memberToDelete}
        onClose={() => setMemberToDelete(null)}
        onConfirm={(member) => {
          deleteMutation.mutate(member);
          setMemberToDelete(null);
        }}
      />
    </div>
  );
}
