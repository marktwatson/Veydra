import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Loader2,
  Search,
  MessageSquare,
  User,
  Filter,
  ArrowLeft,
  Users,
  Heart,
  Trash2,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function ManagerMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedContractorId, setSelectedContractorId] = useState<
    string | null
  >(null);
  const [chatType, setChatType] = useState<"contractors" | "clients">(
    "contractors",
  );
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const { data: contractors = [], isLoading: loadingContractors } = useQuery({
    queryKey: ["contractors"],
    queryFn: api.getContractors,
  });

  const { data: weddings = [], isLoading: loadingWeddings } = useQuery({
    queryKey: ["weddings"],
    queryFn: api.getWeddings,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", "manager"],
    queryFn: () => api.getMessages("manager"),
  });

  const getUnreadCount = (contractorId: string) => {
    return messages.filter(
      (m) =>
        m.sender_id === contractorId && m.receiver_id === "manager" && !m.read,
    ).length;
  };

  useEffect(() => {
    // Presence channel
    const presenceChannel = supabase.channel("online-users", {
      config: { presence: { key: "manager" } },
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
        if (payload.payload.receiver_id === "manager") {
          const senderId = payload.payload.sender_id;

          setTypingUsers((prev) => ({ ...prev, [senderId]: true }));

          if (typingTimeoutsRef.current[senderId]) {
            clearTimeout(typingTimeoutsRef.current[senderId]);
          }

          typingTimeoutsRef.current[senderId] = setTimeout(() => {
            setTypingUsers((prev) => ({ ...prev, [senderId]: false }));
          }, 3000);

          if (selectedContractorId === senderId) {
            setTimeout(() => {
              const scrollArea = document.getElementById("chat-scroll-area");
              if (scrollArea)
                scrollArea.scrollTo({
                  top: scrollArea.scrollHeight,
                  behavior: "smooth",
                });
            }, 100);
          }
        }
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    // Realtime subscription
    const channel = supabase
      .channel("realtime:messages_manager")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.manager`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["messages", "manager"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [queryClient, selectedContractorId]);

  const filteredContractors = contractors.filter((c) => {
    const matchesSearch =
      `${c.first_name} ${c.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (showUnreadOnly) return getUnreadCount(c.id) > 0;

    return true;
  });

  const filteredClients = weddings.filter((w) => {
    if (w.notes?.includes("[UNPAID_DRAFT]")) return false;
    const matchesSearch = w.client_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (showUnreadOnly) return getUnreadCount(w.id) > 0;

    // Only show clients that have actually sent or received messages, or match search if empty
    const hasMessages = messages.some(
      (m) => m.sender_id === w.id || m.receiver_id === w.id,
    );
    if (!hasMessages && !searchQuery) return false;

    return true;
  });

  const activeMessages = messages.filter(
    (m) =>
      m.sender_id === selectedContractorId ||
      m.receiver_id === selectedContractorId,
  );

  useEffect(() => {
    const scrollArea = document.getElementById("chat-scroll-area");
    if (scrollArea) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
    }

    // Mark messages from this contractor as read
    if (!selectedContractorId || activeMessages.length === 0) return;

    const unreadMessages = activeMessages.filter(
      (m) =>
        m.receiver_id === "manager" &&
        m.sender_id === selectedContractorId &&
        !m.read,
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => {
        api.markMessageAsRead(msg.id);
      });

      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["unreadMessages", "manager"],
        });
        queryClient.invalidateQueries({ queryKey: ["messages", "manager"] });
      }, 500);
    }
  }, [activeMessages, selectedContractorId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const msg = await api.sendMessage({
        sender_id: "manager",
        receiver_id: selectedContractorId!,
        content,
      });

      // Send Ovanta notification so the recipient knows to check the portal
      try {
        if (chatType === "contractors") {
          const contractor = contractors.find(
            (c) => c.id === selectedContractorId,
          );
          if (contractor?.email) {
            const name =
              `${contractor.first_name} ${contractor.last_name || ""}`.trim();
            const subject = `New message from ${"the team"}`;
            const body = `Hi ${contractor.first_name}, you have a new message in the Veydra portal:\n\n"${content}"\n\nLog in to view and reply: https://${window.location.hostname}`;
            await api
              .sendOvantaEmail(contractor.email, subject, body, name, true)
              .catch(() => {});
            await api
              .sendOvantaSms(contractor.email, body, name, true)
              .catch(() => {});
          }
        } else {
          const wedding = weddings.find((w) => w.id === selectedContractorId);
          if (wedding?.client_email) {
            const body = `Hi ${wedding.client_name}, you have a new message from ${"the team"} in your Bride Hub:\n\n"${content}"\n\nView and reply here: https://${window.location.hostname}/bride-portal/${wedding.id}`;
            await api
              .sendOvantaEmail(
                wedding.client_email,
                "New message from your wedding team",
                body,
                wedding.client_name,
                true,
              )
              .catch(() => {});
            await api
              .sendOvantaSms(
                wedding.client_email,
                body,
                wedding.client_name,
                true,
              )
              .catch(() => {});
          }
        }
      } catch (e) {
        console.warn(
          "Ovanta notification failed (message still sent in-portal):",
          e,
        );
      }

      return msg;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", "manager"] });
      toast.success("Message sent — recipient notified via SMS & email");
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: string) => api.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "manager"] });
      toast.success("Message deleted");
    },
    onError: () => {
      toast.error("Failed to delete message");
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContractorId) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (typingChannelRef.current && selectedContractorId) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { sender_id: "manager", receiver_id: selectedContractorId },
      });
    }
  };

  const getLastMessage = (contractorId: string) => {
    const contractorMsgs = messages.filter(
      (m) => m.sender_id === contractorId || m.receiver_id === contractorId,
    );
    if (contractorMsgs.length === 0) return null;
    return contractorMsgs[contractorMsgs.length - 1];
  };

  // Sort contractors by recent messages
  const sortedContractors = [...filteredContractors].sort((a, b) => {
    const lastA = getLastMessage(a.id);
    const lastB = getLastMessage(b.id);
    if (!lastA && !lastB) return 0;
    if (!lastA) return 1;
    if (!lastB) return -1;
    return (
      new Date(lastB.created_at).getTime() -
      new Date(lastA.created_at).getTime()
    );
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    const lastA = getLastMessage(a.id);
    const lastB = getLastMessage(b.id);
    if (!lastA && !lastB) return 0;
    if (!lastA) return 1;
    if (!lastB) return -1;
    return (
      new Date(lastB.created_at).getTime() -
      new Date(lastA.created_at).getTime()
    );
  });

  const activeList =
    chatType === "contractors" ? sortedContractors : sortedClients;

  return (
    <div className="flex-1 flex flex-col space-y-4 min-h-0">
      <div
        className={cn(
          "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
          selectedContractorId ? "hidden lg:flex" : "flex",
        )}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Messages
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Communicate directly with your contractors
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden grid lg:grid-cols-3 xl:grid-cols-4">
        {/* Sidebar */}
        <div
          className={cn(
            "border-r flex flex-col h-full col-span-1",
            selectedContractorId ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="p-4 border-b space-y-3">
            <ToggleGroup
              type="single"
              value={chatType}
              onValueChange={(v) => {
                if (v) {
                  setChatType(v as "contractors" | "clients");
                  setSelectedContractorId(null);
                }
              }}
              className="justify-start w-full bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="contractors" className="flex-1 text-xs">
                <Users className="h-3.5 w-3.5 mr-2" />
                Team
              </ToggleGroupItem>
              <ToggleGroupItem value="clients" className="flex-1 text-xs">
                <Heart className="h-3.5 w-3.5 mr-2" />
                Brides
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${chatType}...`}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {showUnreadOnly ? "Unread Messages" : "All Conversations"}
              </span>
              <Toggle
                size="sm"
                pressed={showUnreadOnly}
                onPressedChange={setShowUnreadOnly}
                aria-label="Toggle unread filter"
                className="h-8 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Filter className="h-3 w-3 mr-1" />
                Unread
              </Toggle>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {activeList.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No {chatType} found.
              </div>
            ) : (
              <div className="divide-y">
                {activeList.map((item: any) => {
                  const unread = getUnreadCount(item.id);
                  const lastMsg = getLastMessage(item.id);

                  const name =
                    chatType === "contractors"
                      ? `${item.first_name} ${item.last_name}`
                      : item.client_name;
                  const avatarUrl =
                    chatType === "contractors" ? item.avatar_url : "";
                  const initials =
                    chatType === "contractors"
                      ? `${item.first_name?.[0] || ""}${item.last_name?.[0] || ""}`
                      : item.client_name?.substring(0, 2).toUpperCase();

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedContractorId(item.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center gap-3",
                        selectedContractorId === item.id && "bg-muted",
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={avatarUrl || ""} />
                          <AvatarFallback
                            className={
                              chatType === "clients"
                                ? "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300"
                                : ""
                            }
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {onlineUsers.has(item.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-sm truncate">{name}</p>
                          {lastMsg && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                              {format(new Date(lastMsg.created_at), "MMM d")}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          {typingUsers[item.id] ? (
                            <p className="text-xs text-primary italic truncate max-w-[140px]">
                              typing...
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {lastMsg ? lastMsg.content : "No messages yet"}
                            </p>
                          )}
                          {unread > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div
          className={cn(
            "col-span-1 lg:col-span-2 xl:col-span-3 flex flex-col min-w-0 overflow-hidden",
            !selectedContractorId
              ? "hidden lg:flex lg:h-full lg:bg-muted/10"
              : "flex h-full lg:bg-muted/10 bg-background lg:bg-transparent",
          )}
        >
          {selectedContractorId ? (
            <>
              <CardHeader className="border-b py-3 px-4 bg-background shrink-0">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden shrink-0 -ml-2"
                    onClick={() => setSelectedContractorId(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  {(() => {
                    const contractor = contractors.find(
                      (c) => c.id === selectedContractorId,
                    );
                    const client = weddings.find(
                      (w) => w.id === selectedContractorId,
                    );
                    const name = contractor
                      ? `${contractor.first_name} ${contractor.last_name}`
                      : client?.client_name;
                    const avatarUrl = contractor?.avatar_url || "";
                    const initials = contractor
                      ? `${contractor.first_name?.[0] || ""}${contractor.last_name?.[0] || ""}`
                      : client?.client_name?.substring(0, 2).toUpperCase();

                    return (
                      <>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={avatarUrl} />
                          <AvatarFallback
                            className={
                              client
                                ? "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300"
                                : ""
                            }
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {onlineUsers.has(selectedContractorId) ? (
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
                      </>
                    );
                  })()}
                </div>
              </CardHeader>

              <div
                id="chat-scroll-area"
                className="flex-1 p-4 min-h-0 overflow-y-auto"
              >
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                    <p>No messages yet.</p>
                    <p className="text-sm">
                      Send a message to start the conversation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {activeMessages.map((msg) => {
                      const isMine = msg.sender_id === "manager";
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
                                onClick={() =>
                                  deleteMessageMutation.mutate(msg.id)
                                }
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
                                : "bg-muted text-foreground rounded-bl-sm border"
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
                              {format(
                                new Date(msg.created_at),
                                "MMM d, h:mm a",
                              )}
                            </span>
                          </div>
                          {!isMine && (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  deleteMessageMutation.mutate(msg.id)
                                }
                                disabled={deleteMessageMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {selectedContractorId &&
                      typingUsers[selectedContractorId] && (
                        <div className="flex justify-start">
                          <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1 w-16 h-10 border">
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                          </div>
                        </div>
                      )}
                    <div ref={scrollRef} />
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-background shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={handleTyping}
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={
                      !newMessage.trim() || sendMessageMutation.isPending
                    }
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
              <p>
                Select a {chatType === "contractors" ? "team member" : "bride"}{" "}
                to start messaging
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
