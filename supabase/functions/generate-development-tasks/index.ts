import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Check for authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { skills, qualities, trackName, stepName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
${skills.map((s: any) => `- ${s.name} (текущий уровень: ${s.current_level}, целевой: ${s.target_level})`).join('\n')}

Необходимо развить следующие качества:
${qualities.map((q: any) => `- ${q.name} (текущий уровень: ${q.current_level}, целевой: ${q.target_level})`).join('\n')}

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
          { role: "user", content: userPrompt }
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
                        competency_name: { type: "string", description: "Название навыка или качества" }
                      },
                      required: ["title", "goal", "how_to", "measurable_result", "priority", "competency_type", "competency_name"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["tasks"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_development_tasks" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Ошибка AI сервиса" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const tasksData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ tasks: tasksData.tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-development-tasks:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
