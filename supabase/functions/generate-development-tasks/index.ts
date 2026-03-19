import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  isNonEmptyString,
  sanitizeString,
  badRequest,
  unauthorized,
  serverError,
  jsonOk,
} from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FIELD_LEN = 500;
const MAX_ARRAY_LEN = 50;

interface CompetencyItem {
  name: string;
  current_level: unknown;
  target_level: unknown;
}

function validateAndSanitizeCompetencies(
  items: unknown,
  label: string
): { valid: CompetencyItem[]; error?: Response } {
  if (!Array.isArray(items)) {
    return { valid: [], error: badRequest("Invalid input") };
  }
  if (items.length > MAX_ARRAY_LEN) {
    return { valid: [], error: badRequest(`Слишком много элементов в ${label}`) };
  }
  const result: CompetencyItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { valid: [], error: badRequest("Invalid input") };
    }
    if (typeof item.name !== "string" || item.name.trim().length === 0) {
      return { valid: [], error: badRequest("Invalid input") };
    }
    result.push({
      name: sanitizeString(item.name, MAX_FIELD_LEN),
      current_level: item.current_level,
      target_level: item.target_level,
    });
  }
  return { valid: result };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return unauthorized();
    }

    const body = await req.json();
    const { skills: rawSkills, qualities: rawQualities, trackName: rawTrackName, stepName: rawStepName } = body;

    // Validate & sanitize trackName, stepName
    if (!isNonEmptyString(rawTrackName, MAX_FIELD_LEN)) {
      return badRequest("Invalid input");
    }
    if (!isNonEmptyString(rawStepName, MAX_FIELD_LEN)) {
      return badRequest("Invalid input");
    }
    const trackName = sanitizeString(rawTrackName, MAX_FIELD_LEN);
    const stepName = sanitizeString(rawStepName, MAX_FIELD_LEN);

    // Validate & sanitize skills/qualities arrays
    const skillsResult = validateAndSanitizeCompetencies(rawSkills, "skills");
    if (skillsResult.error) return skillsResult.error;

    const qualitiesResult = validateAndSanitizeCompetencies(rawQualities, "qualities");
    if (qualitiesResult.error) return qualitiesResult.error;

    const skills = skillsResult.valid;
    const qualities = qualitiesResult.valid;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return serverError("Сервис временно недоступен");
    }

    const systemPrompt = `Ты - эксперт по развитию персонала. Создай конкретные, измеримые задачи для развития навыков и качеств сотрудника.
Каждая задача должна быть:
- Конкретной и выполнимой
- Иметь четкую цель
- Включать описание "как выполнить"
- Иметь измеримый результат

Ответ должен быть структурированным списком задач.`;

    const userPrompt = `Сотрудник движется по карьерному треку "${trackName}" и хочет достичь уровня "${stepName}".

Необходимо развить следующие навыки:
${skills.map((s) => `- ${s.name} (текущий уровень: ${s.current_level}, целевой: ${s.target_level})`).join("\n")}

Необходимо развить следующие качества:
${qualities.map((q) => `- ${q.name} (текущий уровень: ${q.current_level}, целевой: ${q.target_level})`).join("\n")}

Создай 3-5 конкретных задач для развития этих навыков и качеств.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_development_tasks",
              description: "Создание списка задач для развития навыков и качеств",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Название задачи" },
                        goal: { type: "string", description: "Цель задачи" },
                        how_to: { type: "string", description: "Как выполнить задачу" },
                        measurable_result: { type: "string", description: "Измеримый результат" },
                        priority: { type: "string", enum: ["low", "medium", "high"], description: "Приоритет" },
                        competency_type: { type: "string", enum: ["skill", "quality"], description: "Тип компетенции" },
                        competency_name: { type: "string", description: "Название навыка или качества" },
                      },
                      required: ["title", "goal", "how_to", "measurable_result", "priority", "competency_type", "competency_name"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_development_tasks" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("AI gateway error:", status);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return serverError("Ошибка AI сервиса");
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      console.error("No tool call in AI response");
      return serverError("Ошибка AI сервиса");
    }

    const tasksData = JSON.parse(toolCall.function.arguments);

    return jsonOk({ tasks: tasksData.tasks });
  } catch (error) {
    console.error("Error in generate-development-tasks:", error);
    return serverError("Внутренняя ошибка сервера");
  }
});
