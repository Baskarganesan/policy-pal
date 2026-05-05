import type { ChunkMetadata } from "./types";

export type ParsedPage = { page: number; text: string };

/**
 * Parse a file into per-page text. PDFs preserve real page numbers; DOCX/TXT
 * are treated as a single logical "page 1".
 */
export async function parseFile(file: File): Promise<ParsedPage[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".txt")) return parseTxt(file);
  throw new Error(`Unsupported file type: ${file.name}`);
}

async function parsePdf(file: File): Promise<ParsedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker to avoid CORS / network worker fetch issues.
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: ParsedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: i, text });
  }
  return pages;
}

async function parseDocx(file: File): Promise<ParsedPage[]> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return [{ page: 1, text: result.value.replace(/\s+\n/g, "\n").trim() }];
}

async function parseTxt(file: File): Promise<ParsedPage[]> {
  const text = await file.text();
  return [{ page: 1, text }];
}

/* ----------------------------- Chunking ---------------------------------- */

// Approx 4 chars per token; aim for ~800 tokens chunks with ~150 overlap.
const TARGET_CHARS = 3200;
const OVERLAP_CHARS = 600;

const CLAUSE_REGEX = /(?:^|\n)\s*((?:\d+(?:\.\d+){0,3}|[A-Z]\.\d+|Section\s+\d+|SECTION\s+[A-Z0-9]+))[\s.:)\-]+/g;
const HEADING_REGEX = /\n([A-Z][A-Z0-9 \-/&]{3,80})\n/g;

type Segment = {
  text: string;
  page: number;
  section: string;
  clause_id: string;
};

/**
 * Insurance-aware chunker:
 *  1. Splits each page on clause numbers (e.g. 4.2, 5.1) and ALL-CAPS headings.
 *  2. Greedily packs segments into chunks of ~TARGET_CHARS with overlap.
 *  3. Each chunk inherits metadata from the dominant segment.
 */
export function chunkPages(pages: ParsedPage[], docName: string): Array<{
  text: string;
  meta: ChunkMetadata;
}> {
  const segments: Segment[] = [];
  let currentSection = "";
  let currentClause = "";

  for (const { page, text } of pages) {
    if (!text) continue;
    const normalized = "\n" + text + "\n";

    // Build cut points from clauses + headings on this page
    type Cut = { idx: number; type: "clause" | "heading"; label: string };
    const cuts: Cut[] = [];

    let m: RegExpExecArray | null;
    const clauseRe = new RegExp(CLAUSE_REGEX.source, "g");
    while ((m = clauseRe.exec(normalized)) !== null) {
      cuts.push({ idx: m.index, type: "clause", label: m[1].trim() });
    }
    const headRe = new RegExp(HEADING_REGEX.source, "g");
    while ((m = headRe.exec(normalized)) !== null) {
      cuts.push({ idx: m.index, type: "heading", label: m[1].trim() });
    }
    cuts.sort((a, b) => a.idx - b.idx);

    if (cuts.length === 0) {
      segments.push({
        text: normalized.trim(),
        page,
        section: currentSection,
        clause_id: currentClause,
      });
      continue;
    }

    // Pre-clause text on this page
    if (cuts[0].idx > 0) {
      const head = normalized.slice(0, cuts[0].idx).trim();
      if (head) {
        segments.push({
          text: head,
          page,
          section: currentSection,
          clause_id: currentClause,
        });
      }
    }

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      const end = i + 1 < cuts.length ? cuts[i + 1].idx : normalized.length;
      if (cut.type === "heading") currentSection = cut.label;
      else currentClause = cut.label;
      const body = normalized.slice(cut.idx, end).trim();
      if (!body) continue;
      segments.push({
        text: body,
        page,
        section: currentSection,
        clause_id: cut.type === "clause" ? cut.label : currentClause,
      });
    }
  }

  // Greedy pack segments into chunks
  const chunks: Array<{ text: string; meta: ChunkMetadata }> = [];
  let buf = "";
  let bufMeta: ChunkMetadata | null = null;

  const flush = () => {
    if (buf.trim() && bufMeta) {
      chunks.push({ text: buf.trim(), meta: bufMeta });
    }
    buf = "";
    bufMeta = null;
  };

  for (const seg of segments) {
    if (!bufMeta) {
      bufMeta = {
        doc_name: docName,
        section: seg.section,
        clause_id: seg.clause_id,
        page: seg.page,
      };
    }
    if (buf.length + seg.text.length + 2 <= TARGET_CHARS) {
      buf = buf ? buf + "\n\n" + seg.text : seg.text;
      continue;
    }
    // Need to flush; carry overlap tail forward
    flush();
    const overlap = seg.text.length > OVERLAP_CHARS ? "" : "";
    // Start a new buffer with overlap from previous chunk's tail
    const lastChunk = chunks[chunks.length - 1];
    const tail = lastChunk
      ? lastChunk.text.slice(Math.max(0, lastChunk.text.length - OVERLAP_CHARS))
      : "";
    buf = (tail ? tail + "\n\n" : "") + overlap + seg.text;
    bufMeta = {
      doc_name: docName,
      section: seg.section,
      clause_id: seg.clause_id,
      page: seg.page,
    };

    // If a single segment is huge, hard-split it
    while (buf.length > TARGET_CHARS) {
      const slice = buf.slice(0, TARGET_CHARS);
      chunks.push({ text: slice.trim(), meta: bufMeta });
      buf = buf.slice(TARGET_CHARS - OVERLAP_CHARS);
    }
  }
  flush();

  return chunks;
}