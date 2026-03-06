import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TARGET_ID = "695aa5cc-c402-43a0-bdea-1ca505a34392";
const TARGET_EMAIL = "tkachenko@raketa.im";
const BATCH_SIZE = 10;

interface CommentRow {
  id: string;
  comment: string;
  table: "hard_skill_results" | "soft_skill_results";
  type: "self" | "respondent";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function anonymizeBatch(comments: string[]): Promise<string[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "You are a text anonymizer working with Russian-language employee feedback comments. For each comment in the input JSON array, AGGRESSIVELY rewrite it preserving meaning, tone, and approximate length (±20%). You MUST remove or generalize ALL of the following: 1) ALL names of people, teams, roles mentioning specific people. 2) ALL emails, phone numbers, logins. 3) ALL client/project/team/department names. 4) ALL internal system names, product names (e.g. Jira, Bitrix, specific 1C configurations by name). 5) ALL ticket/contract/document numbers. 6) ALL links/URLs. 7) ALL specific dates, time periods ('последние полгода' → 'в последнее время', 'за 4 года' → 'за длительный период'). 8) ALL rare unique events that could identify a person ('запуск проекта в роли тех лида' → 'участие в крупном проекте'). 9) ALL references to specific company processes or artifacts that are unique. Replace specifics with generic equivalents. Do not add new facts. Do not translate — keep Russian. Return ONLY a valid JSON array of rewritten texts in the same order, no markdown, no explanation.",
        },
        {
          role: "user",
          content: JSON.stringify(comments),
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content ?? "";

  // Strip markdown fences if present
  content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed) || parsed.length !== comments.length) {
    throw new Error(
      `AI returned ${Array.isArray(parsed) ? parsed.length : "non-array"} items, expected ${comments.length}`
    );
  }
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode = "dry-run" } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify target user exists
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", TARGET_ID)
      .single();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Target user not found", target_id: TARGET_ID }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.email !== TARGET_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Email mismatch — safety stop", expected: TARGET_EMAIL, got: user.email }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch comments from both tables
    const allComments: CommentRow[] = [];

    for (const table of ["hard_skill_results", "soft_skill_results"] as const) {
      const { data: rows, error } = await supabase
        .from(table)
        .select("id, comment, evaluating_user_id")
        .eq("evaluated_user_id", TARGET_ID)
        .not("comment", "is", null);

      if (error) throw new Error(`Error fetching ${table}: ${error.message}`);

      for (const row of rows ?? []) {
        const text = (row.comment ?? "").trim();
        if (text.length === 0 || wordCount(text) <= 3) continue;
        allComments.push({
          id: row.id,
          comment: text,
          table,
          type: row.evaluating_user_id === TARGET_ID ? "self" : "respondent",
        });
      }
    }

    const selfCount = allComments.filter((c) => c.type === "self").length;
    const respondentCount = allComments.filter((c) => c.type === "respondent").length;

    const summary: Record<string, unknown> = {
      target_id: TARGET_ID,
      target_email: TARGET_EMAIL,
      mode,
      total_comments: allComments.length,
      self_comments: selfCount,
      respondent_comments: respondentCount,
      hard_skill_results: allComments.filter((c) => c.table === "hard_skill_results").length,
      soft_skill_results: allComments.filter((c) => c.table === "soft_skill_results").length,
    };

    if (mode === "dry-run") {
      return new Response(JSON.stringify({ ...summary, status: "dry-run complete, no changes made" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply mode — anonymize in batches
    const examples: { table: string; type: string; before_preview: string; after_preview: string }[] = [];
    let updatedCount = 0;

    for (let i = 0; i < allComments.length; i += BATCH_SIZE) {
      const batch = allComments.slice(i, i + BATCH_SIZE);
      const originals = batch.map((c) => c.comment);
      const anonymized = await anonymizeBatch(originals);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const newComment = anonymized[j];

        const { error: updateErr } = await supabase
          .from(row.table)
          .update({ comment: newComment })
          .eq("id", row.id)
          .eq("evaluated_user_id", TARGET_ID); // safety: double-check target

        if (updateErr) {
          throw new Error(`Update failed for ${row.table}/${row.id}: ${updateErr.message}`);
        }
        updatedCount++;

        // Collect up to 5 examples (masked: first 40 chars + "…")
        if (examples.length < 5) {
          const mask = (s: string) => (s.length > 40 ? s.slice(0, 40) + "…" : s);
          examples.push({
            table: row.table,
            type: row.type,
            before_preview: mask(row.comment),
            after_preview: mask(newComment),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ...summary,
        status: "apply complete",
        updated_count: updatedCount,
        examples,
        confirmation: "Only comment fields updated. No other fields, tables, or employees touched.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
