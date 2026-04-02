import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonOk, serverError } from "../_shared/validation.ts";
import { formatMeetingDateRu, resolveTimezone } from "../_shared/timezone.ts";

// ─── Link Builder ───
function buildMiluLink(type: "meeting" | "fallback", meetingId?: string): string {
  const base = Deno.env.get("MILU_BASE_URL") || "https://milu.lovable.app";
  if (type === "meeting" && meetingId) return `${base}/meetings?meeting=${meetingId}`;
  return `${base}/meetings`;
}

// ─── Scenario texts ───
interface MessageContext {
  meetingId: string;
  managerPosition?: string;
  newDate?: string;
}

function getScenarioText(scenarioId: string, ctx: MessageContext): string {
  const link = buildMiluLink("meeting", ctx.meetingId);
  const pos = ctx.managerPosition || "руководителем";

  switch (scenarioId) {
    case "R1":
      return `Завтра у тебя One-to-one с ${pos}. Если хочешь, можно заранее набросать в форме вопросы, темы или мысли к встрече. ${link}`;
    case "R2":
      return `Завтра у тебя One-to-one с сотрудником. Предлагаю заранее занести в форму темы для обсуждения, новости, похвалу или обратную связь. ${link}`;
    case "R3":
      return `Через час у тебя One-to-one. Если нужно, можно за пару минут зафиксировать в форме, что хочется обсудить. ${link}`;
    case "R4":
      return `Через час у тебя One-to-one с сотрудником. Если нужно, можно быстро отметить в форме основные акценты к встрече. ${link}`;
    case "R5":
      return `По вчерашнему One-to-one нет зафиксированного итога. Если встреча состоялась, заполни Итоги встречи. Если не состоялась, перенеси встречу на новую дату. ${link}`;
    case "R5a": {
      const dateStr = ctx.newDate || "новую дату";
      return `One-to-one перенесён на новую дату: ${dateStr}. Проверь обновленный слот встречи в Milu. ${link}`;
    }
    case "R6":
      return `По встрече One-to-one руководитель внес итоги. Ты можешь увидеть их на платформе. ${link}`;
    case "R6a":
      return `По встрече One-to-one сотрудник внес итоги. Ты можешь увидеть их на платформе. ${link}`;
    case "R6h":
      return `HR внёс изменения в итоги встречи One-to-one. Проверь обновления на платформе. ${link}`;
    case "R1n": {
      const fallbackLink = buildMiluLink("fallback");
      return `Привет! Я Мила, помощница от HR-платформы по развитию Milu в Ракете. Буду помогать тебе не пропускать важные события по one-to-one: напоминать о встречах, подсказывать, когда пора зафиксировать итоги и присылать важные уведомления из Milu. ${fallbackLink}`;
    }
    default:
      return `У тебя обновление по One-to-one. ${link}`;
  }
}

/**
 * Fetch recipient timezone from users table, with fallback + logging.
 */
async function getRecipientTimezone(
  supabase: ReturnType<typeof createClient>,
  recipientId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", recipientId)
    .single();
  const rawTz = data?.timezone ?? null;
  const resolved = resolveTimezone(rawTz, recipientId);
  if (rawTz !== resolved || !rawTz) {
    console.warn(`[tz-diag] recipient=${recipientId} raw_tz=${JSON.stringify(rawTz)} resolved=${resolved} db_error=${error?.message ?? "none"}`);
  }
  return resolved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Fetch due pending notifications (limit batch to 50)
    const { data: pendingJobs, error: fetchErr } = await supabase
      .from("meeting_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchErr) {
      console.error("Fetch pending jobs error:", fetchErr.message);
      return serverError();
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      // 2. Check for R5 overdue (meetings past date with no summary)
      await enqueueR5Overdue(supabase);
      return jsonOk({ processed: 0 });
    }

    console.log(`Processing ${pendingJobs.length} pending notifications`);

    let sentCount = 0;
    let failedCount = 0;

    for (const job of pendingJobs) {
      try {
        // R1n: welcome message — no meeting context needed
        if (job.scenario_id === "R1n") {
          const text = getScenarioText("R1n", { meetingId: "" });

          const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-bitrix-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ user_id: job.recipient_id, text }),
          });

          const sendResult = await sendResponse.json();
          if (sendResult.sent || sendResult.skipped) {
            await markAs(supabase, job.id, "sent");
            sentCount++;
          } else {
            await markAs(supabase, job.id, "failed", sendResult.error || "send_failed");
            failedCount++;
          }
          continue;
        }

        // Verify meeting still exists and is relevant
        const { data: meeting } = await supabase
          .from("one_on_one_meetings")
          .select("id, employee_id, manager_id, meeting_date, meeting_summary, status")
          .eq("id", job.meeting_id)
          .single();

        if (!meeting) {
          // Meeting deleted — remove notification
          await supabase.from("meeting_notifications").delete().eq("id", job.id);
          continue;
        }

        // For pre-meeting reminders (R1-R4), skip if summary already exists
        if (["R1", "R2", "R3", "R4"].includes(job.scenario_id) && meeting.meeting_summary) {
          await markAs(supabase, job.id, "sent", "skipped_summary_exists");
          continue;
        }

        // For R5, skip if summary already filled
        if (job.scenario_id === "R5" && meeting.meeting_summary) {
          await markAs(supabase, job.id, "sent", "skipped_summary_exists");
          continue;
        }

        // Get manager position for R1 text
        let managerPosition: string | undefined;
        if (job.scenario_id === "R1") {
          const { data: managerUser } = await supabase
            .from("users")
            .select("position_id")
            .eq("id", meeting.manager_id)
            .single();
          if (managerUser?.position_id) {
            const { data: pos } = await supabase
              .from("positions")
              .select("name")
              .eq("id", managerUser.position_id)
              .single();
            managerPosition = pos?.name;
          }
        }

        // Fetch recipient's timezone for localized date formatting
        const recipientTz = await getRecipientTimezone(supabase, job.recipient_id);

        // Diagnostic logging for timezone-sensitive scenarios
        const formattedDate = meeting.meeting_date
          ? formatMeetingDateRu(meeting.meeting_date, recipientTz)
          : undefined;

        if (["R5a", "R1", "R2", "R3", "R4"].includes(job.scenario_id)) {
          console.log(`[tz-diag] scenario=${job.scenario_id} recipient=${job.recipient_id} tz_resolved=${recipientTz} meeting_date_raw=${meeting.meeting_date} formatted="${formattedDate}"`);
        }

        // Build message text
        const text = getScenarioText(job.scenario_id, {
          meetingId: job.meeting_id,
          managerPosition,
          newDate: formattedDate,
        });

        // Call send-bitrix-message
        const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-bitrix-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ user_id: job.recipient_id, text }),
        });

        const sendResult = await sendResponse.json();

        if (sendResult.sent || sendResult.skipped) {
          await markAs(supabase, job.id, "sent");
          sentCount++;
        } else {
          await markAs(supabase, job.id, "failed", sendResult.error || "send_failed");
          failedCount++;
        }
      } catch (jobErr) {
        console.error(`Error processing job ${job.id}:`, jobErr);
        await markAs(supabase, job.id, "failed", String(jobErr));
        failedCount++;
      }
    }

    // Also check for new R5 overdue
    await enqueueR5Overdue(supabase);

    return jsonOk({ processed: pendingJobs.length, sent: sentCount, failed: failedCount });
  } catch (err) {
    console.error("process-reminders error:", err);
    return serverError();
  }
});

async function markAs(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: string,
  error?: string,
) {
  await supabase
    .from("meeting_notifications")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error: error || null,
    })
    .eq("id", id);
}

/**
 * R5: Find overdue meetings (past meeting_date, no summary, status = awaiting_summary)
 * and create ONE R5 notification per meeting for the manager.
 * R5 is scheduled for next day 10:00 Moscow (07:00 UTC) after the meeting_date.
 * If an R5 was already sent or is pending for this meeting, skip it.
 */
async function enqueueR5Overdue(supabase: ReturnType<typeof createClient>) {
  // Meetings that are overdue: meeting_date < now, no summary, awaiting_summary
  const { data: overdue } = await supabase
    .from("one_on_one_meetings")
    .select("id, manager_id, meeting_date")
    .is("meeting_summary", null)
    .eq("status", "awaiting_summary")
    .lt("meeting_date", new Date().toISOString())
    .limit(50);

  if (!overdue || overdue.length === 0) return;

  for (const m of overdue) {
    // Check if R5 already exists (sent or pending) for this meeting+manager
    const { data: existing } = await supabase
      .from("meeting_notifications")
      .select("id")
      .eq("meeting_id", m.id)
      .eq("recipient_id", m.manager_id)
      .eq("scenario_id", "R5")
      .in("status", ["pending", "sent"])
      .limit(1);

    if (existing && existing.length > 0) {
      // Already queued or sent — skip to avoid duplicates
      continue;
    }

    // Schedule R5 for next day 10:00 Moscow time (07:00 UTC) after the meeting
    const meetingDate = new Date(m.meeting_date);
    const nextDay = new Date(meetingDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(7, 0, 0, 0); // 10:00 Moscow = 07:00 UTC

    // If next day 07:00 UTC is already past, schedule for immediate delivery
    const now = new Date();
    const scheduledAt = nextDay > now ? nextDay.toISOString() : now.toISOString();

    await supabase.from("meeting_notifications").insert({
      meeting_id: m.id,
      recipient_id: m.manager_id,
      scenario_id: "R5",
      scheduled_at: scheduledAt,
      status: "pending",
    });
  }
}
