import { useState } from "react";
import { Sparkles, X, Loader2, ArrowUp } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How do I add a wedding?",
  "What did we book this week?",
  "What is still owed?",
];

export function AreaAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const ask = async (text?: string) => {
    const question = (text ?? draft).trim();
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
        setAreaLabel([payload.company, payload.area].filter(Boolean).join(" — "));
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.75rem] right-4 z-30 flex h-11 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-md md:bottom-5"
      >
        <Sparkles className="h-4 w-4" />
        Assistant
      </button>
    );
  }

  return (
    <section className="fixed bottom-[4.75rem] left-3 right-3 z-30 flex max-h-[min(34rem,calc(100vh-8.5rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-xl md:bottom-5 md:left-auto md:w-[24rem]">
      <header className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Area assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            {areaLabel
              ? `${areaLabel} only. It cannot change anything.`
              : "Selected area only. It cannot change anything."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask about this area.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ask(suggestion)}
                  className="rounded-xl border border-border/70 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-10 whitespace-pre-wrap rounded-2xl rounded-br-md bg-stone-900 px-3 py-2 text-sm leading-relaxed text-white"
                : "mr-6 whitespace-pre-wrap rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm leading-relaxed"
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
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border/60 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this area"
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-muted/40 px-4 text-sm outline-none focus:border-stone-400"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
