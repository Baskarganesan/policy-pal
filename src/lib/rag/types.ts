export type ChunkMetadata = {
  doc_name: string;
  section: string;
  clause_id: string;
  page: number;
};

export type Chunk = {
  id: string;
  text: string;
  embedding?: number[];
} & ChunkMetadata;

export type RetrievedChunk = Chunk & { score: number };

export type DocStatus =
  | "uploading"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "error";

export type PolicyDoc = {
  id: string;
  name: string;
  size: number;
  status: DocStatus;
  progress: number; // 0-100
  pages: number;
  chunkCount: number;
  error?: string;
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: RetrievedChunk[];
  pending?: boolean;
  error?: string;
};