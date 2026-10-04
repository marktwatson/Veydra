import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getManagerTerritoryIdRaw } from "@/lib/current-territory";
import { HONEYSUCKLE_TERRITORY_ID } from "@/lib/territory";
import { sendInviteNotifications } from "@/lib/team-invite-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface TerritoryLite {
  id: string;
  name: string;
  slug: string | null;
}

/**
 * "Add New Admin" dialog, extracted from src/pages/manager/Team.tsx so that
 * file stays under the edit cap. Self-contained: loads territories, renders
 * the trigger button + form, and runs the same addManager / invite path as
 * before (CRM tracking, invite notifications, admin-invite webhook).
 *
 * `onInvited` is the existing Team.tsx success handler (refresh + toast).
 */
export function TeamAddAdminDialog({
  open,
  onOpenChange,
  onInvited,
  managers = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (name: string, email: string) => void;
  managers?: any[];
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    role: "manager",
    territory_id: "" as string,
  });

  // Load territories (id, name, slug) once. Shares the ["team-territories"]
  // query key with Team.tsx so react-query dedupes the request.
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

  const reset = () =>
    setNewAdmin({ name: "", email: "", role: "manager", territory_id: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    // Super admin picks the area; non-super-admins default to their own area.
    let territoryId: string;
    if (user?.role === "super_admin") {
      territoryId = newAdmin.territory_id || HONEYSUCKLE_TERRITORY_ID;
    } else {
      territoryId =
        (await getManagerTerritoryIdRaw()) || HONEYSUCKLE_TERRITORY_ID;
    }

    const currentActiveEmails = new Set(
      managers.map((m: any) => m.email?.toLowerCase()),
    );
    if (currentActiveEmails.has(newAdmin.email.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Already active",
        description: "This admin already has an active account.",
      });
      return;
    }

    // CRM tracking (external form submission event).
    const trackingPayload = {
      type: "external_form_submission",
      timestamp: Date.now(),
      formId: "Add Admin Form",
      formData: {
        first_name: newAdmin.name.split(" ")[0] || "",
        last_name: newAdmin.name.split(" ").slice(1).join(" ") || "",
        email: newAdmin.email,
      },
      formLabels: {
        first_name: "First Name",
        last_name: "Last Name",
        email: "Email",
      },
      url: window.location.href,
      title: document.title,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      trackingId: "tk_02f0b02f7766475e8e0dd257bf546895",
      locationId: "fkA7m9pf9sdKd1sNoKJv",
      sessionId: crypto.randomUUID(),
      properties: {
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
      },
    };
    fetch("https://backend.leadconnectorhq.com/external-tracking/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", version: "2021-07-28" },
      body: JSON.stringify(trackingPayload),
    }).catch(() => {});

    const pendingUser = {
      id: crypto.randomUUID(),
      name: newAdmin.name,
      email: newAdmin.email,
      status: "invited",
      territory_id: territoryId,
    };

    setSubmitting(true);
    try {
      if (newAdmin.role === "editor") {
        await api.addManager({
          ...pendingUser,
          role: "editor",
          status: "invited",
        } as any);
      } else {
        await api.addManager({ ...pendingUser, role: newAdmin.role } as any);
      }
    } catch (error: any) {
      setSubmitting(false);
      toast({
        variant: "destructive",
        title: "Failed to add",
        description: error.message,
      });
      return;
    }

    // Invite notifications + admin-invite webhook.
    try {
      const token = crypto.randomUUID();
      const settings = await api.getPortalSettings();
      const baseUrl = window.location.origin;
      const setupUrl = `${baseUrl}/setup-password?email=${encodeURIComponent(newAdmin.email)}&token=${token}&role=${newAdmin.role}&name=${encodeURIComponent(newAdmin.name)}`;
      await sendInviteNotifications({
        role: newAdmin.role,
        name: pendingUser.name,
        email: newAdmin.email,
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
            first_name: newAdmin.name.split(" ")[0],
            last_name: newAdmin.name.split(" ").slice(1).join(" "),
            full_name: newAdmin.name,
            email: newAdmin.email,
            tags: ["invited-manager"],
            setup_token: token,
            setup_url: setupUrl,
          }),
        }).catch(console.error);
      }
    } catch (e) {
      console.error("Failed to send invites", e);
    }

    setSubmitting(false);
    onOpenChange(false);
    reset();
    onInvited(newAdmin.name, newAdmin.email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Admin</DialogTitle>
          <DialogDescription>
            Send an invitation link to a new manager so they can set their
            password and gain access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="e.g. Jane Doe"
              value={newAdmin.name}
              onChange={(e) =>
                setNewAdmin({ ...newAdmin, name: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. jane@example.com"
              value={newAdmin.email}
              onChange={(e) =>
                setNewAdmin({ ...newAdmin, email: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={newAdmin.role}
              onValueChange={(value) =>
                setNewAdmin({ ...newAdmin, role: value })
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
          {user?.role === "super_admin" && (
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Select
                value={newAdmin.territory_id}
                onValueChange={(value) =>
                  setNewAdmin({ ...newAdmin, territory_id: value })
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
          )}
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
