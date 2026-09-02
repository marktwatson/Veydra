import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

/**
 * Automatically logs out user after 30 minutes of inactivity.
 */
export function useInactivityTimer(user: any, logout: () => void) {
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const handleIdle = () => {
      logout();
      toast({
        title: "Session Expired",
        description:
          "You have been logged out due to 30 minutes of inactivity.",
        variant: "destructive",
      });
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleIdle, 30 * 60 * 1000); // 30 minutes
    };

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    events.forEach((e) =>
      document.addEventListener(e, resetTimer, { passive: true }),
    );
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((e) => document.removeEventListener(e, resetTimer));
    };
  }, [user, logout]);
}
