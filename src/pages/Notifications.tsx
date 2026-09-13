import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  Info,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.getNotifications(user!.id),
    enabled: !!user?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsAsRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      toast.success("All notifications marked as read");
    },
  });

  const markAllAsRead = () => {
    if (!user?.id) return;
    markAllAsReadMutation.mutate();
  };

  const markAsRead = (id: string, read: boolean) => {
    if (read) return;
    markAsReadMutation.mutate(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "job":
      case "position":
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case "assignment":
        return <Calendar className="h-4 w-4 text-green-500" />;
      case "announcement":
        return <MessageSquare className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Stay updated on your jobs and assignments.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <Check className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-muted-foreground">
                Loading notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer",
                    !notification.read && "bg-muted/20",
                  )}
                  onClick={() => markAsRead(notification.id, notification.read)}
                >
                  <div className="mt-1 rounded-full p-2 bg-background border shadow-sm">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          !notification.read && "text-foreground",
                        )}
                      >
                        {notification.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {format(
                          new Date(notification.created_at),
                          "MMM d, yyyy",
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
