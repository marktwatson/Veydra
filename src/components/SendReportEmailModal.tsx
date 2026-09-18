import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Mail, Loader2, Users, CheckSquare, Square } from "lucide-react";
import type { SalesRecipientChoice } from "@/lib/sales-activity-api";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
}

interface SendReportEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (recipients: SalesRecipientChoice[]) => Promise<void>;
  isSending: boolean;
  companyName: string;
}

export function SendReportEmailModal({
  open,
  onOpenChange,
  onSend,
  isSending,
  companyName,
}: SendReportEmailModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    async function loadTeam() {
      setLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from("managers")
          .select("id, name, email, role, status")
          .order("name", { ascending: true });

        if (error) {
          console.warn(
            "[SendReportEmailModal] error loading managers:",
            error.message,
          );
          return;
        }

        const validMembers: TeamMember[] = [];
        const seen = new Set<string>();

        for (const m of data || []) {
          const email = (m.email || "").trim().toLowerCase();
          if (!email || seen.has(email)) continue;
          seen.add(email);
          const r = String(m.role || "").toLowerCase();
          // Filter to Admins, Owners, Managers (exclude pure contractors or editors if desired)
          if (
            r.includes("owner") ||
            r.includes("admin") ||
            r.includes("manager") ||
            r === "super_admin" ||
            r === "owner_readonly"
          ) {
            validMembers.push({
              id: m.id,
              name: m.name || email.split("@")[0],
              email,
              role: m.role || "Manager",
              status: m.status,
            });
          }
        }

        // Also ensure default recipients if they exist
        const defaultEmails = [
          "mark.t.watson83@gmail.com",
          "gosocialonline@gmail.com",
        ];
        for (const defEmail of defaultEmails) {
          if (!seen.has(defEmail)) {
            validMembers.push({
              id: defEmail,
              name:
                defEmail === "mark.t.watson83@gmail.com"
                  ? "Mark Watson"
                  : "Nik Krohn",
              email: defEmail,
              role: "Owner",
            });
            seen.add(defEmail);
          }
        }

        if (isMounted) {
          setMembers(validMembers);
          // Default selection: select active managers/owners or mark & nik
          const preselected = new Set<string>();
          for (const m of validMembers) {
            if (
              defaultEmails.includes(m.email) ||
              m.role.toLowerCase().includes("owner") ||
              m.role === "super_admin"
            ) {
              preselected.add(m.email);
            }
          }
          if (preselected.size === 0 && validMembers.length > 0) {
            preselected.add(validMembers[0].email);
          }
          setSelectedEmails(preselected);
        }
      } catch (err) {
        console.warn(
          "[SendReportEmailModal] failed to load team members:",
          err,
        );
      } finally {
        if (isMounted) setLoadingMembers(false);
      }
    }

    loadTeam();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEmails(new Set(members.map((m) => m.email)));
  };

  const deselectAll = () => {
    setSelectedEmails(new Set());
  };

  const handleConfirm = async () => {
    const chosenRecipients: SalesRecipientChoice[] = members
      .filter((m) => selectedEmails.has(m.email))
      .map((m) => ({
        email: m.email,
        name: m.name,
        role: m.role,
      }));

    if (chosenRecipients.length === 0) return;
    await onSend(chosenRecipients);
  };

  const roleLabel = (r: string) => {
    const lower = r.toLowerCase();
    if (lower === "super_admin") return "Super Admin";
    if (lower === "owner_readonly") return "Owner (Read Only)";
    if (lower === "owner") return "Owner";
    if (lower === "manager") return "Manager";
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Email Sales Report</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Select administrators, owners, and managers to receive the{" "}
                {companyName} report.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-3 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
            <span className="font-medium text-foreground">
              {selectedEmails.size} of {members.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <CheckSquare className="h-3 w-3" /> Select all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={deselectAll}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Square className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>

          {loadingMembers ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading team members…</span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No team members found.</p>
            </div>
          ) : (
            <div className="space-y-1.5 divide-y divide-border/40">
              {members.map((member) => {
                const isChecked = selectedEmails.has(member.email);
                return (
                  <label
                    key={member.email}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/5 hover:bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleEmail(member.email)}
                        className="rounded"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">
                          {member.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 font-normal"
                    >
                      {roleLabel(member.role)}
                    </Badge>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSending || selectedEmails.size === 0 || loadingMembers}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending Report…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send to {selectedEmails.size} Recipient
                {selectedEmails.size === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
