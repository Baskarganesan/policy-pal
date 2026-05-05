import { FileSearch, X } from "lucide-react";
import type { RetrievedChunk } from "@/lib/rag/types";

type Props = {
  chunk: RetrievedChunk | null;
  onClose: () => void;
};

export function ChunkInspector({ chunk, onClose }: Props) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Source inspector</h2>
        </div>
        {chunk && (
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!chunk ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/40">
            <FileSearch className="h-5 w-5 text-accent-foreground" />
          </div>
          <p className="text-sm font-medium">No source selected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a citation like <span className="font-mono text-[var(--citation)]">[1]</span>{" "}
            in any answer to inspect the exact policy clause it was drawn from.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 space-y-2">
            <Field label="Document" value={chunk.doc_name} />
            <Field label="Section" value={chunk.section || "—"} />
            <Field label="Clause" value={chunk.clause_id || "—"} mono />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Page" value={String(chunk.page)} mono />
              <Field
                label="Similarity"
                value={chunk.score.toFixed(3)}
                mono
                accent
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Excerpt
            </p>
            <div className="rounded-md border border-[var(--citation)]/30 bg-[var(--citation-bg)]/40 p-4 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
              {chunk.text}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Field({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xs ${mono ? "font-mono" : ""} ${
          accent ? "text-[var(--citation)] font-semibold" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}