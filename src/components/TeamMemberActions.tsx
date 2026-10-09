import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Edit, Key, LogIn, Mail, MoreHorizontal, Trash2 } from "lucide-react";
import { isSuperAdminEmail } from "@/lib/super-admin";

interface TeamMemberActionsProps {
  manager: any;
  user: any;
  onEdit: (manager: any) => void;
  onDelete: (manager: any) => void;
  onResendInvite: (manager: any) => void;
  onDeleteInvite: (manager: any) => void;
  onSendResetEmail: (email: string) => void;
  onOpenOwnPassword: () => void;
  onImpersonate: (manager: any) => void;
  isDeleting: boolean;
  className?: string;
}

export function TeamMemberActions({
  manager,
  user,
  onEdit,
  onDelete,
  onResendInvite,
  onDeleteInvite,
  onSendResetEmail,
  onOpenOwnPassword,
  onImpersonate,
  isDeleting,
  className,
}: TeamMemberActionsProps) {
  const isSuperAdmin = user?.role === "super_admin";
  const isSelf = manager.id === user?.id;

  if (manager.status === "invited") {
    return (
      <div className={className || "flex items-center justify-end gap-2"}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(manager)}
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
            <DropdownMenuItem onClick={() => onResendInvite(manager)}>
              Resend Invite
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
              onClick={() => onDeleteInvite(manager)}
            >
              Delete Invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Active admin:
  // Can edit if: not owner, or is self, or the viewer is super_admin.
  const canEdit = manager.role !== "owner" || isSelf || isSuperAdmin;

  return (
    <div className={className || "flex items-center justify-end gap-2"}>
      {!isSelf && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onImpersonate(manager)}
          className="text-primary hover:bg-primary/10 gap-1 text-xs"
          title={`Log in as ${manager.name}`}
        >
          <LogIn className="h-4 w-4" /> Log in as
        </Button>
      )}

      {isSelf ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenOwnPassword}
          className="text-muted-foreground hover:text-foreground"
        >
          <Key className="h-4 w-4 mr-2" /> Reset Password
        </Button>
      ) : manager.role !== "owner" || isSuperAdmin ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSendResetEmail(manager.email)}
          className="text-muted-foreground hover:text-foreground"
          title="Send Password Reset Email"
        >
          <Mail className="h-4 w-4 mr-2" /> Reset Password
        </Button>
      ) : null}

      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(manager)}
          className="text-muted-foreground hover:text-foreground"
          title="Edit Admin"
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(manager)}
        disabled={
          isSelf ||
          manager.role === "super_admin" ||
          (manager.role === "owner" && !isSuperAdmin) ||
          (manager.role === "owner_readonly" && !isSuperAdmin) ||
          isSuperAdminEmail(manager.email) ||
          isDeleting
        }
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="Remove Team Member"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
