import { useState } from "react";
import { Loader2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ChangePasswordDialog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    setUpdating(true);
    if (user?.id === "m1") {
      setTimeout(() => {
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully.",
        });
        setOpen(false);
        setNewPassword("");
        setUpdating(false);
      }, 500);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);
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
      setOpen(false);
      setNewPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Update Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
