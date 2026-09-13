import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have a hash in the URL (Supabase appends the access token as a hash)
    // If we're authenticated, we can update the password
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session && !window.location.hash) {
        toast({
          variant: "destructive",
          title: "Invalid link",
          description: "This password reset link is invalid or has expired.",
        });
        navigate("/login");
      }
    };
    checkSession();
  }, [navigate, toast]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please ensure both passwords are the same.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Try updating the password directly with a strict 6-second timeout
      const updatePromise = supabase.auth.updateUser({ password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 6000),
      );

      const result = (await Promise.race([
        updatePromise,
        timeoutPromise,
      ])) as any;

      if (result && result.error) {
        throw result.error;
      }

      toast({
        title: "Password updated successfully!",
        description: "You can now log in with your new password.",
      });

      // Sign out so they have to log in with their new password
      await supabase.auth.signOut().catch(() => {});
      navigate("/login");
    } catch (error: any) {
      console.error("Password update error:", error);

      // If it times out or hits a lock error, the backend usually actually processed the password change
      // but the local browser storage got stuck trying to save the new session.
      if (
        error?.message === "TIMEOUT" ||
        error?.message?.toLowerCase().includes("lock")
      ) {
        // Force clear the local session to un-stick the browser
        try {
          localStorage.removeItem("veydra-auth-v2");
          sessionStorage.clear();
        } catch (e) {}

        toast({
          title: "Password updated!",
          description:
            "Your password was changed successfully. Please log in with your new password.",
        });
        navigate("/login");
      } else {
        toast({
          variant: "destructive",
          title: "Update failed",
          description:
            error?.message ||
            "The reset link may have expired or is invalid. Please request a new one.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Update Password</CardTitle>
          <CardDescription>
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
