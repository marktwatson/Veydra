import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TerritoryLite {
  id: string;
  name: string;
  slug: string | null;
}

/**
 * Edit-admin dialog extracted from Team.tsx (which is at the edit cap).
 *
 * Adds a multi-area picker: an owner or super admin can grant a manager one
 * or more areas. Saving writes `territory_ids` and sets `territory_id` to
 * the first selected area (the home area). Super admins keep "All" and the
 * area picker is disabled for them.
 */
export function TeamEditAdminDialog({
  open,
  onOpenChange,
  admin,
  territories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: any;
  territories: TerritoryLite[];
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (admin) {
      // Seed selected areas from territory_ids, falling back to [territory_id].
      const ids: string[] = Array.isArray(admin.territory_ids)
        ? admin.territory_ids.filter(Boolean)
        : [];
      const home = admin.territory_id || HONEYSUCKLE_TERRITORY_ID;
      if (!ids.includes(home)) ids.unshift(home);
      setEditing({ ...admin, territory_ids: ids });
    }
  }, [admin]);

  const areaOptions: TerritoryLite[] =
    territories.length > 0
      ? territories
      : [{ id: HONEYSUCKLE_TERRITORY_ID, name: "Honeysuckle", slug: null }];

  const territoryNameById = (id?: string | null): string => {
    if (!id) return "Honeysuckle";
    const t = territories.find((x) => x.id === id);
    return t?.name || "Honeysuckle";
  };

  const isSuper = isSuperAdminEmail(editing?.email);
  const isViewerSuperAdmin = user?.role === "super_admin";

  const toggleArea = (id: string) => {
    if (!editing) return;
    const set = new Set<string>(editing.territory_ids || []);
    if (set.has(id)) {
      if (set.size === 1) return; // keep at least one
      set.delete(id);
    } else {
      set.add(id);
    }
    const next = Array.from(set);
    // Home area = first selected.
    setEditing({ ...editing, territory_ids: next, territory_id: next[0] });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { member: any; updates: any }) => {
      const { member, updates } = data;
      const territoryId =
        updates.territory_id || member.territory_id || HONEYSUCKLE_TERRITORY_ID;
      const territoryIds: string[] = updates.territory_ids || [territoryId];

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
          territory_ids: territoryIds,
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
            territory_ids: territoryIds,
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
      }
      await supabase
        .from("managers")
        .update({
          name: updates.name,
          role: updates.role,
          territory_ids: territoryIds,
        })
        .eq("email", member.email);
      return api.updateManager(member.id, {
        name: updates.name,
        role: updates.role,
        territory_id: territoryId,
        territory_ids: territoryIds,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({
        title: "Team member updated",
        description: "Team member details have been updated.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update team member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    try {
      setIsUploadingAvatar(true);
      const fileExt = file.name.split(".").pop();
      const safeEmail = editing.email.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `admin-${safeEmail}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setEditing({ ...editing, avatar_url: publicUrl });
      if (editing.role === "editor") {
        await supabase
          .from("editors")
          .update({ avatar_url: publicUrl })
          .eq("email", editing.email);
      } else {
        await supabase
          .from("managers")
          .update({ avatar_url: publicUrl })
          .eq("email", editing.email);
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
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !admin) return;
    const ids = (editing.territory_ids || []).filter(Boolean);
    if (ids.length === 0) {
      toast({
        title: "Pick at least one area",
        description: "A team member must have access to at least one area.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      member: admin,
      updates: {
        name: editing.name,
        role: editing.role || "manager",
        territory_id: isViewerSuperAdmin ? ids[0] : admin.territory_id,
        territory_ids: isViewerSuperAdmin ? ids : admin.territory_ids || [],
      },
    });
  };

  if (!editing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle>Edit Administrator</DialogTitle>
          <DialogDescription>
            Update details and permissions for this admin.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          <div className="flex flex-col items-center gap-3 pb-2">
            <Avatar className="h-20 w-20 ring-2 ring-border">
              <AvatarImage src={editing.avatar_url} />
              <AvatarFallback className="text-lg">
                {editing.name?.charAt(0) || editing.email?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                onChange={handleAvatarUpload}
                className="hidden"
                accept="image/*"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) =>
                  (
                    e.currentTarget.previousElementSibling as HTMLInputElement
                  )?.click()
                }
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
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={editing.role || "manager"}
              onValueChange={(value) => setEditing({ ...editing, role: value })}
              disabled={
                !isViewerSuperAdmin &&
                (editing.role === "super_admin" ||
                  isSuper ||
                  editing.role === "owner")
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

          {isViewerSuperAdmin && (
            <div className="space-y-2">
              <Label>Areas</Label>
              <p className="text-xs text-muted-foreground">
                Grant access to one or more areas. The first checked area is
                their home area.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1 bg-muted/20">
                {areaOptions.map((t) => {
                  const checked = (editing.territory_ids || []).includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-accent/60 cursor-pointer select-none transition-colors"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleArea(t.id)}
                        disabled={isSuper}
                      />
                      <span className="text-sm font-medium">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {!isViewerSuperAdmin && (
            <div className="space-y-2">
              <Label>Area</Label>
              <p className="text-xs text-muted-foreground">
                {territoryNameById(editing.territory_id)} — only a super admin
                can assign or change areas.
              </p>
            </div>
          )}

          <DialogFooter className="pt-4 border-t mt-6 -mx-6 -mb-6 px-6 py-4 bg-muted/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}
