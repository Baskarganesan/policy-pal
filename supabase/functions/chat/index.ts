import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Chunk = {
  id: string;
  text: string;
  doc_name: string;
  section: string;
  clause_id: string;
  page: number;
  score: number;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are an insurance policy analysis assistant. Your job is to answer questions strictly using the policy excerpts provided in the CONTEXT block.

STRICT RULES:
1. Use ONLY information present in the provided CONTEXT. Never use outside knowledge about insurance.
2. Cite every factual claim inline using bracketed source numbers like [1], [2] that map to the sources listed in CONTEXT.
3. When the answer is not present in the CONTEXT, respond exactly: "This information is not present in the provided policy documents."
4. Prefer quoting the exact clause text in quotation marks when the question concerns coverage, exclusions, conditions, or limits.
5. Structure answers clearly. When relevant, organize using these labels: **Coverage**, **Exclusions**, **Conditions**, **Limits**.
6. If clauses appear to conflict, surface the conflict explicitly and cite both sources.
7. Be concise. Do not speculate. Do not add disclaimers beyond what is in the policy.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const { messages, contextChunks } = (await req.json()) as {
      messages: ChatMessage[];
      contextChunks: Chunk[];
    };

    const contextBlock = (contextChunks ?? [])
      .map(
        (c, i) =>
          `[${i + 1}] Document: ${c.doc_name} | Section: ${c.section || "—"} | Clause: ${c.clause_id || "—"} | Page: ${c.page}\n"""\n${c.text}\n"""`,
      )
      .join("\n\n");

    const systemContent =
      contextChunks && contextChunks.length > 0
        ? `${SYSTEM_PROMPT}\n\nCONTEXT:\n${contextBlock}`
        : `${SYSTEM_PROMPT}\n\nCONTEXT:\n(no relevant policy excerpts found)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemContent }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});