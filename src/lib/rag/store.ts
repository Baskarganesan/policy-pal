import type { Chunk, RetrievedChunk } from "./types";

/** In-memory vector store with cosine similarity. */
export class VectorStore {
  private chunks: Chunk[] = [];

  add(chunks: Chunk[]) {
    this.chunks.push(...chunks);
  }

  removeByDoc(docName: string) {
    this.chunks = this.chunks.filter((c) => c.doc_name !== docName);
  }

  clear() {
    this.chunks = [];
  }

  size() {
    return this.chunks.length;
  }

  /** Returns top-k by cosine similarity, then trims to topReturn. */
  search(queryEmbedding: number[], topK = 5, topReturn = 3): RetrievedChunk[] {
    const scored: RetrievedChunk[] = this.chunks
      .filter((c) => c.embedding && c.embedding.length === queryEmbedding.length)
      .map((c) => ({ ...c, score: cosine(queryEmbedding, c.embedding!) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.min(topK, scored.length)).slice(0, topReturn);
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Module-level singleton store for the session. */
export const sessionStore = new VectorStore();