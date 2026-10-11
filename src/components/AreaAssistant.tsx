import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AreaAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const ask = async () => {
    const question = draft.trim();
    if (!question || pending) return;
    setError("");
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const territoryId = await currentTerritoryId();
      if (!territoryId) throw new Error("Pick an area first.");
      const { data: area } = await supabase
        .from("territories")
        .select("name")
        .eq("id", territoryId)
        .maybeSingle();
      setAreaLabel(area?.name || "this area");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again.");
      const res = await fetch(`${supabaseUrl}/functions/v1/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ territoryId, messages: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "The assistant could not answer.");
      if (payload.company || payload.area) {
        setAreaLabel(
          [payload.company, payload.area].filter(Boolean).join(" — "),
        );
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply || "I could not answer that." },
      ]);
    } catch (err: any) {
      setError(err?.message || "The assistant could not answer.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-3 z-40 flex h-[min(32rem,calc(100vh-8rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-xl border bg-background shadow-xl md:bottom-6">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Area assistant</p>
              <p className="text-xs text-muted-foreground">
                {areaLabel
                  ? `Reads ${areaLabel} only. It cannot change anything.`
                  : "Reads the selected area only. It cannot change anything."}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask how to do something in Veydra, or ask for this area's booked
                value, what is still owed, open jobs, or a couple by name.
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white"
                    : "mr-6 rounded-lg bg-muted px-3 py-2 text-sm"
                }
              >
                {message.content}
              </div>
            ))}
            {pending && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking this area
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <form
            className="flex gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about this area"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
              Ask
            </Button>
          </form>
        </div>
      )}
      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-20 right-3 z-40 gap-2 shadow-lg md:bottom-6"
      >
        <Sparkles className="h-4 w-4" />
        Assistant
      </Button>
    </>
  );
}
