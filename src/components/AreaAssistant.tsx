import { useEffect, useRef, useState } from "react";
import { X, Loader2, ArrowUp } from "lucide-react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { currentTerritoryId } from "@/lib/current-territory";

function inlineBits(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function AssistantText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList =
          lines.length > 0 &&
          lines.every((line) => /^([-*•]|\d+[.)])\s+/.test(line));
        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {inlineBits(line.replace(/^([-*•]|\d+[.)])\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {inlineBits(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const HOUSE_MARK =
  "https://assets.cdn.filesafe.space/76EKIVBXrGYIny0RbqcE/media/6abaa38a7ef452865a26c67d.gif";

const SUGGESTIONS = [
  { label: "Send sales report", question: "RUN_DAILY_REPORT" },
  { label: "Sales audit", question: "Audit our salespeople" },
  { label: "Yesterday's calls", question: "Analyze yesterday's calls" },
  { label: "Pipelines", question: "Audit our Ovanta pipelines" },
  { label: "Workflows", question: "Audit our Ovanta workflows" },
  { label: "Past due", question: "Who is past due?" },
  { label: "This week", question: "What did we book this week?" },
  { label: "Studios nearby", question: "Who are the other wedding studios around us, and what do they charge?" },
  { label: "Ready to edit", question: "How do I get a wedding ready for editing?" },
];

function runningLabel(question: string) {
  const asked = question.toLowerCase();
  if (/studio|competitor|charge|pricing/.test(asked)) return "Looking up other wedding studios around you";
  if (/call/.test(asked)) return "Reading yesterday's calls and transcripts";
  if (/run_daily_report|send today|sales report/.test(asked)) return "Sending the sales report from this Ovanta account";
  if (/sales/.test(asked)) return "Checking salespeople, bookings, and the inbox";
  if (/pipeline/.test(asked)) return "Reading each pipeline and its open deals";
  if (/workflow|automation/.test(asked)) return "Reading the automations";
  if (/past due|overdue|owed|money/.test(asked)) return "Checking who is past due";
  if (/week|book/.test(asked)) return "Checking this week's bookings";
  if (/how do|how to|where do|what happens/.test(asked)) return "Looking up the steps";
  return "Looking through this company's records";
}

function followUps(text: string, question: string) {
  const written = text
    .split("\n")
    .filter((line) => /^Next:\s+/i.test(line))
    .map((line) => line.replace(/^Next:\s+/i, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (written.length) return written;
  const asked = question.toLowerCase();
  if (/call/.test(asked)) return ["Who still needs a call back?", "Audit our salespeople"];
  if (/past due|owed|money/.test(asked)) return ["Who is due this week?", "What did we book this week?"];
  if (/studio|competitor|charge/.test(asked)) return ["How do our packages compare?", "What did we book this week?"];
  if (/pipeline/.test(asked)) return ["Which deals have not moved?", "Audit our salespeople"];
  if (/workflow|automation/.test(asked)) return ["Which of those are still drafts?", "Audit our Ovanta pipelines"];
  return ["Who is past due?", "What did we book this week?"];
}

function withoutFollowUps(text: string) {
  return text
    .split("\n")
    .filter((line) => !/^Next:\s+/i.test(line))
    .join("\n")
    .trim();
}

export function AreaAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [nameReady, setNameReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const greeted = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending, error, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const territoryId = await currentTerritoryId();
      if (!territoryId) return;
      const { data } = await supabase
        .from("portal_settings")
        .select("company_name")
        .eq("territory_id", territoryId)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setCompany(data?.company_name || "");
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || cancelled) {
        if (!cancelled) setNameReady(true);
        return;
      }
      const { data: manager } = await supabase.from("managers").select("name").eq("id", user.id).limit(1).maybeSingle();
      const full = manager?.name || user.user_metadata?.full_name || "";
      if (!cancelled) {
        setFirstName(String(full).trim().split(/\s+/)[0] || "");
        setNameReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || greeted.current || messages.length > 0 || !company || !nameReady) return;
    greeted.current = true;
    const hello = firstName ? `Hey ${firstName}.` : "Hey.";
    setMessages([
      {
        role: "assistant",
        content: `${hello} I'm looking at ${company}.\n\nI can check who still owes you, how this week booked, or how yesterday's calls went. I can also look up the other studios around you.\n\nWhat do you want to dig into?`,
      },
    ]);
  }, [open, company, firstName, nameReady, messages.length]);

  const ask = async (text?: string) => {
    const question = (text ?? draft).trim();
    if (!question || pending) return;
    setError("");
    setStatus(runningLabel(question));
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const territoryId = await currentTerritoryId();
      if (!territoryId) throw new Error("Pick an area first.");
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
      if (payload.company) setCompany(payload.company);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply || "I could not answer that." },
      ]);
    } catch (err: any) {
      setError(err?.message || "The assistant could not answer.");
    } finally {
      setPending(false);
      setStatus("");
    }
  };

  const last = messages[messages.length - 1];
  const lastQuestion = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const ideas = last?.role === "assistant" && lastQuestion && !pending ? followUps(last.content, lastQuestion) : [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.75rem] right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-stone-900 pl-2 pr-4 text-sm font-medium text-white shadow-lg md:bottom-5"
      >
        <img
          src={HOUSE_MARK}
          alt=""
          className="h-8 w-8 rounded-full bg-stone-800 object-cover"
        />
        Ask
      </button>
    );
  }

  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-background md:inset-auto md:bottom-4 md:right-4 md:top-4 md:w-[32rem] md:overflow-hidden md:rounded-3xl md:border md:border-stone-200 md:shadow-2xl dark:md:border-stone-800">
      <header className="flex items-center gap-3 border-b border-stone-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-stone-800 md:pt-4">
        <img
          src={HOUSE_MARK}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full bg-stone-100 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight">Veydra Assistant</p>
          <p className="truncate text-xs text-muted-foreground">
            {company ? `Reading ${company}` : "Reading this company"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={threadRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !company && (
          <p className="text-sm text-muted-foreground">One second. I'm seeing which company this is.</p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-12 whitespace-pre-wrap rounded-2xl rounded-br-md bg-stone-900 px-3.5 py-2.5 text-sm leading-relaxed text-white"
                : "mr-8 rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2.5 text-sm leading-relaxed dark:bg-stone-900"
            }
          >
            {message.role === "assistant" ? (
              <AssistantText text={withoutFollowUps(message.content)} />
            ) : (
              message.content
            )}
          </div>
        ))}
        {!messages.some((message) => message.role === "user") && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.question}
                type="button"
                onClick={() => ask(suggestion.question)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-left text-sm hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
        {ideas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => ask(idea)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-left text-sm hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"
              >
                {idea}
              </button>
            ))}
          </div>
        )}
        {pending && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {status || "Looking through this company's records"}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form
        className="flex items-center gap-2 border-t border-stone-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-stone-800"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this area"
          className="h-12 min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 text-base outline-none focus:border-stone-400 dark:border-stone-800 dark:bg-stone-900 md:text-sm"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
    </section>
  );
}
