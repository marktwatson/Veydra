import { useState } from "react";
import { Loader2, Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Territory } from "./constants";

interface AddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (t: {
    name: string;
    project_ref: string;
    supabase_url: string;
    access_token: string;
  }) => void;
  pending: boolean;
}

export function AddTerritoryDialog({
  open,
  onOpenChange,
  onAdd,
  pending,
}: AddDialogProps) {
  const [territory, setTerritory] = useState({
    name: "",
    project_ref: "",
    supabase_url: "",
    access_token: "",
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Territory</DialogTitle>
          <DialogDescription>
            Enter the Supabase project details for this territory. You'll need a
            Personal Access Token from the territory's Supabase dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="terr-name">Territory Name</Label>
            <Input
              id="terr-name"
              placeholder="e.g. Nashville, TN"
              value={territory.name}
              onChange={(e) =>
                setTerritory({ ...territory, name: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found in Supabase Dashboard → Settings → General → Reference ID
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="terr-ref">Supabase Project Ref</Label>
            <Input
              id="terr-ref"
              placeholder="e.g. abcdefghijklmnop"
              value={territory.project_ref}
              onChange={(e) =>
                setTerritory({ ...territory, project_ref: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found in Supabase Dashboard → Settings → General → Reference ID
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="terr-token">Supabase Personal Access Token</Label>
            <Input
              id="terr-token"
              type="password"
              placeholder="sbp_xxxxxxxxxxxxxxxxxxxx"
              value={territory.access_token}
              onChange={(e) =>
                setTerritory({ ...territory, access_token: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Generate at: Supabase Dashboard → Account → Access Tokens
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onAdd(territory)}
            disabled={
              !territory.name ||
              !territory.project_ref ||
              !territory.access_token ||
              pending
            }
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Territory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TokenDialogProps {
  territory: Territory | null;
  onClose: () => void;
  onSave: (token: string) => void;
}

export function TokenDialog({ territory, onClose, onSave }: TokenDialogProps) {
  const [token, setToken] = useState(territory?.access_token || "");
  return (
    <Dialog
      open={!!territory}
      onOpenChange={(open) => {
        if (!open) {
          setToken("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Access Token</DialogTitle>
          <DialogDescription>
            Enter a Supabase Personal Access Token for{" "}
            <strong>{territory?.name}</strong>. Generate one at Supabase
            Dashboard → Account → Access Tokens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="token-input">Personal Access Token</Label>
            <Input
              id="token-input"
              type="password"
              autoComplete="off"
              placeholder="sbp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This token is stored in the territories table and used to deploy
              edge functions via the Supabase Management API.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setToken("");
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => onSave(token)} disabled={!token.trim()}>
            <Key className="mr-2 h-4 w-4" />
            Save Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
