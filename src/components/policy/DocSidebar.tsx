import { FileText, Loader2, AlertCircle, CheckCircle2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PolicyDoc } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<PolicyDoc["status"], string> = {
  uploading: "Uploading",
  parsing: "Parsing",
  chunking: "Chunking",
  embedding: "Embedding",
  indexing: "Indexing",
  ready: "Ready",
  error: "Error",
};

type Props = {
  docs: PolicyDoc[];
  onUploadClick: () => void;
  onRemove: (id: string) => void;
};

export function DocSidebar({ docs, onUploadClick, onRemove }: Props) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--gradient-primary)] shadow-[var(--shadow-elegant)]">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">PolicyLens</h1>
            <p className="text-[11px] text-muted-foreground">Insurance policy Q&A</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <Button
          onClick={onUploadClick}
          className="w-full justify-center gap-2 bg-primary hover:bg-primary/90"
          size="sm"
        >
          <Upload className="h-4 w-4" />
          Upload policy
        </Button>
        <p className="mt-3 px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Sources ({docs.length})
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {docs.length === 0 ? (
          <div className="mt-8 px-2 text-center text-xs text-muted-foreground">
            No documents yet. Upload a PDF, DOCX, or TXT policy to begin.
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className={cn(
                  "group rounded-lg border border-border bg-background p-3 shadow-[var(--shadow-soft)] transition-[var(--transition-smooth)]",
                  d.status === "ready" && "border-accent",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {d.status === "ready" ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--citation)]" />
                    ) : d.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" title={d.name}>
                      {d.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {STATUS_LABEL[d.status]}
                      {d.status === "ready" && (
                        <>
                          {" · "}
                          {d.chunkCount} chunks · {d.pages} pp
                        </>
                      )}
                    </p>
                    {d.status !== "ready" && d.status !== "error" && (
                      <Progress value={d.progress} className="mt-2 h-1" />
                    )}
                    {d.error && (
                      <p className="mt-1 text-[10px] text-destructive">{d.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(d.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground">
        Stateless session. Documents are processed in your browser and discarded
        when you close the tab.
      </div>
    </div>
  );
}