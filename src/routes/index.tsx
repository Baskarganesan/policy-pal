import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useId, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { FileText, X } from "lucide-react";
import { DocSidebar } from "@/components/policy/DocSidebar";
import { ChatPanel } from "@/components/policy/ChatPanel";
import { ChunkInspector } from "@/components/policy/ChunkInspector";
import { parseFile, chunkPages } from "@/lib/rag/parse";
import { sessionStore } from "@/lib/rag/store";
import { embedTexts, streamChat } from "@/lib/rag/api";
import type {
  ChatMessage,
  PolicyDoc,
  RetrievedChunk,
  Chunk,
} from "@/lib/rag/types";

export const Route = createFileRoute("/")({
  component: Index,
});

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function Index() {
  const [docs, setDocs] = useState<PolicyDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChunk, setActiveChunk] = useState<RetrievedChunk | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const openFilePicker = useCallback(() => {
    const el = fileInputRef.current;
    if (!el) return;
    try {
      el.value = "";
      el.click();
    } catch {
      /* ignore */
    }
  }, []);

  const isReady = docs.some((d) => d.status === "ready");

  const updateDoc = useCallback((id: string, patch: Partial<PolicyDoc>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        const id = uid();
        const baseDoc: PolicyDoc = {
          id,
          name: file.name,
          size: file.size,
          status: "uploading",
          progress: 5,
          pages: 0,
          chunkCount: 0,
        };
        setDocs((prev) => [...prev, baseDoc]);

        try {
          updateDoc(id, { status: "parsing", progress: 15 });
          const pages = await parseFile(file);

          updateDoc(id, {
            status: "chunking",
            progress: 35,
            pages: pages.length,
          });
          const rawChunks = chunkPages(pages, file.name);
          if (rawChunks.length === 0) {
            throw new Error("No text content extracted from this document.");
          }

          updateDoc(id, { status: "embedding", progress: 55 });
          const texts = rawChunks.map((c) => c.text);
          const embeddings = await embedTexts(texts);

          updateDoc(id, { status: "indexing", progress: 85 });
          const chunks: Chunk[] = rawChunks.map((c, i) => ({
            id: `${id}-${i}`,
            text: c.text,
            embedding: embeddings[i],
            ...c.meta,
          }));
          sessionStore.add(chunks);

          updateDoc(id, {
            status: "ready",
            progress: 100,
            chunkCount: chunks.length,
          });
          toast.success(`${file.name} indexed`, {
            description: `${chunks.length} chunks across ${pages.length} pages.`,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Processing failed";
          updateDoc(id, { status: "error", error: msg });
          toast.error(`Failed to process ${file.name}`, { description: msg });
        }
      }
    },
    [updateDoc],
  );

  const removeDoc = (id: string) => {
    const doc = docs.find((d) => d.id === id);
    if (doc) sessionStore.removeByDoc(doc.name);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSend = async (question: string) => {
    if (sessionStore.size() === 0) {
      toast.error("Upload a policy first");
      return;
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: question,
    };
    const assistantId = uid();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      // Embed query + retrieve top-3 of top-5
      const [queryEmbedding] = await embedTexts([question]);
      const retrieved = sessionStore.search(queryEmbedding, 5, 3);

      // Build chat history (excluding the empty assistant placeholder)
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let acc = "";
      await streamChat({
        messages: history,
        contextChunks: retrieved,
        onDelta: (delta) => {
          acc += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: acc, pending: false } : m,
            ),
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, citations: retrieved, pending: false }
                : m,
            ),
          );
          setIsStreaming(false);
        },
        onError: (msg, status) => {
          const friendly =
            status === 429
              ? "Rate limit reached. Wait a moment and try again."
              : status === 402
                ? "AI credits exhausted. Add funds in Workspace → Usage."
                : msg;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, error: friendly, pending: false } : m,
            ),
          );
          setIsStreaming(false);
          toast.error(friendly);
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, error: msg, pending: false } : m,
        ),
      );
      setIsStreaming(false);
      toast.error(msg);
    }
  };

  const handleCitationClick = (c: RetrievedChunk) => {
    setActiveChunk(c);
    setMobileInspectorOpen(true);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background lg:flex-row">
      <Toaster richColors position="top-center" />
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept=".pdf,.docx,.txt"
        multiple
        className="sr-only"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gradient-primary)]">
            <FileText className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">PolicyLens</span>
        </div>
        <label
          htmlFor={fileInputId}
          onClick={openFilePicker}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          + Policy
        </label>
      </header>

      {/* Sidebar */}
      <div className="hidden w-[280px] shrink-0 lg:block">
        <DocSidebar
          docs={docs}
          onUploadClick={openFilePicker}
          onRemove={removeDoc}
        />
      </div>

      {/* Mobile docs strip */}
      {docs.length > 0 && (
        <div className="border-b border-border bg-card px-3 py-2 lg:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px]"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    d.status === "ready"
                      ? "bg-[var(--citation)]"
                      : d.status === "error"
                        ? "bg-destructive"
                        : "bg-primary animate-pulse"
                  }`}
                />
                <span className="max-w-[140px] truncate">{d.name}</span>
                <button onClick={() => removeDoc(d.id)} aria-label="Remove">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <ChatPanel
          messages={messages}
          isReady={isReady}
          isStreaming={isStreaming}
          onSend={handleSend}
          onCitationClick={handleCitationClick}
          activeCitationId={activeChunk?.id ?? null}
        />
      </main>

      {/* Inspector — desktop */}
      <div className="hidden w-[360px] shrink-0 lg:block">
        <ChunkInspector chunk={activeChunk} onClose={() => setActiveChunk(null)} />
      </div>

      {/* Inspector — mobile drawer */}
      {mobileInspectorOpen && activeChunk && (
        <div className="fixed inset-0 z-50 flex flex-col bg-card lg:hidden">
          <ChunkInspector
            chunk={activeChunk}
            onClose={() => setMobileInspectorOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
