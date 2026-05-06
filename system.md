# PolicyLens — System Documentation

## Overview
PolicyLens is a NotebookLM-style insurance document assistant. Users upload policy documents (PDF / DOCX / TXT) and ask natural-language questions. Answers are generated via Retrieval-Augmented Generation (RAG) with clause-level citations, so every claim is traceable to the supporting excerpt in the source document.

## Goals
- Accurate question answering from uploaded insurance policies
- Clause-level traceability (every answer links to the exact supporting chunk)
- High-trust responses — refuse to answer if context is insufficient (no hallucinations)
- Mobile-first responsive UI, also great on desktop
- Sub-5s end-to-end latency for typical questions

## Tech Stack
- **Frontend:** React 19 + TypeScript, TanStack Start v1 (Vite 7), Tailwind CSS v4, shadcn/ui
- **Backend:** Lovable Cloud — Edge Functions (Deno) for chat completion
- **AI:** Lovable AI Gateway → `google/gemini-2.0-flash` for chat
- **Embeddings:** Local in-browser hashed bag-of-words (FNV-1a, 512-dim, L2-normalized) — no external embedding API
- **Document parsing:** `pdfjs-dist` (PDF), `mammoth` (DOCX), native `File.text()` (TXT)
- **Vector store:** In-memory session store with cosine similarity (top-K=5)

## Architecture
Browser hosts the full RAG pipeline (parse → chunk → embed → index → retrieve). The retrieved context plus the user's question is sent to the `/functions/chat` edge function, which calls the Lovable AI Gateway with a strict grounded system prompt and streams the answer back with inline `[n]` citations.

## RAG Pipeline
1. **Parse** — extract text + page numbers per document type.
2. **Chunk** — clause-aware splitter (`src/lib/rag/parse.ts`) using regex for numbered clauses (e.g. `4.2`, `Section 5`) and ALL-CAPS headings. Targets ~800 tokens (~3200 chars) with ~150 token overlap.
3. **Embed** — local FNV-1a hashed bigram bag-of-words → 512-dim L2-normalized vector. Deterministic, offline, zero-cost.
4. **Index** — chunks + vectors stored in an in-memory `VectorStore` keyed by document ID.
5. **Retrieve** — cosine similarity, top 5 chunks per query.
6. **Generate** — chunks injected as context into the chat edge function with a strict system prompt:
   > "Answer ONLY from the provided context. If the answer is not present, reply: *This information is not present in the provided policy documents.* Cite sources inline using `[n]`."

## Folder Structure
```
src/
  components/policy/      # ChatPanel, ChunkInspector, DocSidebar
  lib/rag/                # parse, store, api, types
  routes/                 # TanStack Start file-based routes
  integrations/supabase/  # auto-generated client + types
supabase/
  functions/chat/         # Edge function (Gemini chat)
  functions/embed/        # (deprecated — embeddings now local)
```

## Edge Cases Handled
- **No documents uploaded** → input disabled with hint to upload first
- **No relevant chunks** → model returns the standard "not present" message
- **Ambiguous questions** → model asks for clarification rather than guessing
- **Conflicting clauses** → both citations surfaced; user can compare in inspector

## Success Criteria
- Upload a policy and get accurate, cited answers within 3–5 seconds
- Clicking a citation reveals the exact supporting clause + page number + similarity score
- No hallucinations — grounded refusals when evidence is missing

## Environment
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — auto-injected by Lovable Cloud
- `LOVABLE_API_KEY` — auto-available inside edge functions for the AI Gateway

## Future Enhancements
- Persist documents + embeddings (pgvector) for cross-session memory
- Multi-document comparison view
- Highlight-in-PDF citation rendering
- Export Q&A transcript as PDF
