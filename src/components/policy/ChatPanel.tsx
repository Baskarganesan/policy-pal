import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, FileSearch, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage, RetrievedChunk } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

type Props = {
  messages: ChatMessage[];
  isReady: boolean;
  isStreaming: boolean;
  onSend: (q: string) => void;
  onCitationClick: (chunk: RetrievedChunk) => void;
  activeCitationId?: string | null;
};

const SAMPLE_QUESTIONS = [
  "What is covered under accidental damage?",
  "List all exclusions that apply to water damage.",
  "What is the deductible and claim limit?",
  "Are pre-existing conditions covered?",
];

export function ChatPanel({
  messages,
  isReady,
  isStreaming,
  onSend,
  onCitationClick,
  activeCitationId,
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const submit = () => {
    const q = input.trim();
    if (!q || !isReady || isStreaming) return;
    setInput("");
    onSend(q);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--gradient-subtle)]">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Policy Q&A</h2>
          <p className="text-[11px] text-muted-foreground">
            Answers grounded strictly in your uploaded documents.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isReady ? "bg-[var(--citation)]" : "bg-muted-foreground/40",
            )}
          />
          {isReady ? "RAG ready" : "Awaiting policy"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <EmptyState
            isReady={isReady}
            onPick={(q) => isReady && onSend(q)}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onCitationClick={onCitationClick}
                activeCitationId={activeCitationId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/40 focus-within:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)]">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                isReady
                  ? "Ask about coverage, exclusions, limits, conditions…"
                  : "Upload a policy to start asking questions."
              }
              disabled={!isReady || isStreaming}
              className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <Button
              onClick={submit}
              disabled={!isReady || isStreaming || !input.trim()}
              size="icon"
              className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 px-1 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  isReady,
  onPick,
}: {
  isReady: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center pt-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gradient-primary)] shadow-[var(--shadow-elegant)]">
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">
        Ask anything about your policy
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Every answer is retrieved from the document, cites the exact clause,
        and surfaces the source so you can verify before acting.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            disabled={!isReady}
            onClick={() => onPick(q)}
            className={cn(
              "rounded-lg border border-border bg-card px-4 py-3 text-left text-sm transition-[var(--transition-smooth)]",
              isReady
                ? "hover:border-primary/40 hover:bg-accent/30 hover:shadow-[var(--shadow-soft)]"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            {q}
          </button>
        ))}
      </div>

      {!isReady && (
        <div className="mt-8 flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <FileSearch className="h-3.5 w-3.5" />
          Upload a policy from the left to enable questions.
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onCitationClick,
  activeCitationId,
}: {
  message: ChatMessage;
  onCitationClick: (c: RetrievedChunk) => void;
  activeCitationId?: string | null;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-[var(--shadow-soft)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-5 py-4 shadow-[var(--shadow-soft)]">
        {message.error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.error}</span>
          </div>
        ) : message.content ? (
          <AnswerWithCitations
            content={message.content}
            citations={message.citations ?? []}
            onCitationClick={onCitationClick}
            activeCitationId={activeCitationId}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching policy…
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onCitationClick(c)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] transition-[var(--transition-smooth)]",
                    activeCitationId === c.id
                      ? "border-[var(--citation)] bg-[var(--citation-bg)] text-[var(--citation)]"
                      : "border-border bg-background hover:border-[var(--citation)]/50 hover:bg-[var(--citation-bg)]/50",
                  )}
                >
                  <span className="font-mono font-semibold">[{i + 1}]</span>{" "}
                  <span className="text-muted-foreground">
                    {c.doc_name} · p.{c.page}
                    {c.clause_id ? ` · ${c.clause_id}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerWithCitations({
  content,
  citations,
  onCitationClick,
  activeCitationId,
}: {
  content: string;
  citations: RetrievedChunk[];
  onCitationClick: (c: RetrievedChunk) => void;
  activeCitationId?: string | null;
}) {
  // Render markdown-lite + inline [n] citations
  const parts = content.split(/(\[\d+\])/g);
  return (
    <div className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
      {parts.map((part, idx) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m) {
          const n = parseInt(m[1], 10);
          const c = citations[n - 1];
          if (c) {
            return (
              <button
                key={idx}
                onClick={() => onCitationClick(c)}
                className={cn(
                  "mx-0.5 inline-flex items-center rounded px-1 font-mono text-[11px] font-semibold align-baseline transition",
                  activeCitationId === c.id
                    ? "bg-[var(--citation)] text-primary-foreground"
                    : "bg-[var(--citation-bg)] text-[var(--citation)] hover:bg-[var(--citation)] hover:text-primary-foreground",
                )}
              >
                [{n}]
              </button>
            );
          }
        }
        // Light bold markdown
        const bolded = part.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
          const bm = /^\*\*(.+)\*\*$/.exec(seg);
          if (bm)
            return (
              <strong key={i} className="font-semibold text-foreground">
                {bm[1]}
              </strong>
            );
          return <span key={i}>{seg}</span>;
        });
        return <span key={idx}>{bolded}</span>;
      })}
    </div>
  );
}