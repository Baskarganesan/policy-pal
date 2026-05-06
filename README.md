# PolicyLens

A NotebookLM-style insurance document assistant. Upload policy documents (PDF, DOCX, TXT) and ask natural-language questions — every answer is grounded in the source with clause-level citations.

## Features

- 📄 **Upload policies** — PDF, DOCX, or TXT, parsed entirely in the browser
- 🔍 **Clause-aware chunking** — splits on numbered clauses (e.g. `4.2`, `Section 5`) and ALL-CAPS headings
- 🧠 **Local embeddings** — FNV-1a hashed bag-of-words (512-dim, L2-normalized), zero-cost and offline
- 💬 **Grounded RAG chat** — powered by `google/gemini-2.0-flash` via Lovable AI Gateway
- 🔗 **Inline citations** — click `[1]` to inspect the exact supporting clause, page, and similarity score
- 🚫 **No hallucinations** — refuses to answer when context is insufficient
- 📱 **Mobile-first responsive** UI

## Tech Stack

- **Frontend:** React 19, TypeScript, TanStack Start v1 (Vite 7), Tailwind CSS v4, shadcn/ui
- **Backend:** Lovable Cloud Edge Functions (Deno)
- **AI:** Lovable AI Gateway (`google/gemini-2.0-flash`)
- **Parsing:** `pdfjs-dist`, `mammoth`
- **Vector store:** In-memory session store with cosine similarity

## Getting Started

```bash
bun install
bun run dev
```

## Usage

1. Click **Upload policy** and select a PDF, DOCX, or TXT file
2. Wait for parsing → chunking → embedding → indexing
3. Ask a question in the chat panel
4. Click any `[n]` citation to inspect the source clause

## Project Structure

```
src/
  components/policy/      # ChatPanel, ChunkInspector, DocSidebar
  lib/rag/                # parse, store, api, types
  routes/                 # TanStack Start file-based routes
supabase/
  functions/chat/         # Edge function (Gemini chat)
```

## Environment

Auto-injected by Lovable Cloud:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` (edge functions only)

## Architecture

See [`system.md`](./system.md) for the full RAG pipeline and design decisions.

## License

MIT
