const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Local hashed TF-IDF-ish embeddings. The Lovable AI Gateway does not expose
// an embeddings endpoint for every workspace, so we compute deterministic
// bag-of-words vectors in the browser. Cosine similarity over these vectors
// gives reasonable lexical retrieval for clause-level Q&A without any
// network call or API key.
const EMBED_DIM = 512;

function hashToken(token: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 32);
}

function embedOne(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  for (const tok of tokens) {
    const h = hashToken(tok);
    const idx = h % EMBED_DIM;
    const sign = (h >> 16) & 1 ? 1 : -1;
    vec[idx] += sign;
    // bigrams for a bit more discrimination
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const h = hashToken(tokens[i] + "_" + tokens[i + 1]);
    const idx = h % EMBED_DIM;
    const sign = (h >> 16) & 1 ? 1 : -1;
    vec[idx] += sign * 0.5;
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return texts.map(embedOne);
}

export type StreamChatArgs = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  contextChunks: unknown[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string, status?: number) => void;
  signal?: AbortSignal;
};

export async function streamChat({
  messages,
  contextChunks,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamChatArgs) {
  let resp: Response;
  try {
    resp = await fetch(`${FUNCTIONS_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, contextChunks }),
      signal,
    });
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
    return;
  }

  if (!resp.ok || !resp.body) {
    let msg = `Chat failed (${resp.status})`;
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    onError(msg, resp.status);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, nl);
      textBuffer = textBuffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "" || !raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        /* ignore */
      }
    }
  }

  onDone();
}