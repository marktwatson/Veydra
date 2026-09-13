import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, User, UserCheck, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function Messages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const { data: contractors = [] } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const currentUser = contractors.find(
    (c) => c.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase(),
  );

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", currentUser?.id],
    queryFn: () => api.getMessages(currentUser!.id),
    enabled: !!currentUser?.id,
  });

  useEffect(() => {
    if (!currentUser?.id) return;

    // Presence channel
    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: currentUser.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const newState = presenceChannel.presenceState();
        const online = new Set<string>();
        for (const id in newState) {
          online.add(id);
        }
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online: true });
        }
      });

    // Typing indicator channel
    const typingChannel = supabase.channel("typing", {
      config: { broadcast: { self: false } },
    });

    typingChannel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (
          payload.payload.receiver_id === currentUser.id &&
          payload.payload.sender_id === "manager"
        ) {
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);

          setTimeout(() => {
            const scrollArea = document.getElementById("chat-scroll-area");
            if (scrollArea)
              scrollArea.scrollTo({
                top: scrollArea.scrollHeight,
                behavior: "smooth",
              });
          }, 100);
        }
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    // Realtime subscription
    const channel = supabase
      .channel("realtime:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${currentUser.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({
            queryKey: ["messages", currentUser.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser?.id, queryClient]);

  useEffect(() => {
    const scrollArea = document.getElementById("chat-scroll-area");
    if (scrollArea) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
    }

    // Mark unread messages as read
    if (!currentUser?.id || messages.length === 0) return;
    const unreadMessages = messages.filter(
      (m) => m.receiver_id === currentUser.id && !m.read,
    );

    if (unreadMessages.length > 0) {
      let marked = false;
      unreadMessages.forEach((msg) => {
        api.markMessageAsRead(msg.id).then(() => {
          marked = true;
        });
      });

      if (unreadMessages.length > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["unreadMessages", currentUser.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["messages", currentUser.id],
          });
        }, 500);
      }
    }
  }, [messages, currentUser?.id, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      api.sendMessage({
        sender_id: currentUser!.id,
        receiver_id: "manager", // Send to manager
        content,
      }),
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({
        queryKey: ["messages", currentUser?.id],
      });
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => api.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["messages", currentUser?.id],
      });
      toast.success("Message deleted");
    },
    onError: () => {
      toast.error("Failed to delete message");
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser?.id) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  if (!currentUser?.id) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-4 min-h-0">
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Chat with your manager</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 rounded-none border-0 md:rounded-xl md:border">
        <CardHeader className="border-b py-3 px-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              {onlineUsers.has("manager") && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
              )}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                Manager Support
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                {onlineUsers.has("manager") ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                    <p className="text-xs text-muted-foreground truncate">
                      Online
                    </p>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0"></span>
                    <p className="text-xs text-muted-foreground truncate">
                      Offline
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden min-h-0">
          <div
            id="chat-scroll-area"
            className="flex-1 p-4 min-h-0 overflow-y-auto"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
                <User className="h-12 w-12 mb-4 opacity-20" />
                <p>No messages yet.</p>
                <p className="text-sm">
                  Send a message to start the conversation.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex group ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      {isMine && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMessageMutation.mutate(msg.id)}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <span
                          className={`text-[10px] mt-1 block ${
                            isMine
                              ? "text-primary-foreground/70 text-right"
                              : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      {!isMine && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMessageMutation.mutate(msg.id)}
                            disabled={deleteMessageMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-background shrink-0">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
