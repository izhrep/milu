import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonOk, serverError } from "../_shared/validation.ts";
import { formatMeetingDateRu, resolveTimezone } from "../_shared/timezone.ts";

// ─── Link Builder ───
function buildMiluLink(type: "meeting" | "monitoring" | "fallback", id?: string): string {
  const base = Deno.env.get("MILU_BASE_URL") || "https://milu.raketa.im";
  if (type === "meeting" && id) return `${base}/meetings?meeting=${id}`;
  if (type === "monitoring") return `${base}/meetings-monitoring`;
  return base;
}

// ─── Scenario texts ───
interface MessageContext {
  meetingId: string;
  managerPosition?: string;
  newDate?: string;
  employeeName?: string;
  managerName?: string;
}

function getScenarioText(scenarioId: string, ctx: MessageContext): string {
  const link = buildMiluLink("meeting", ctx.meetingId);
  const pos = ctx.managerPosition || "руководителем";

  switch (scenarioId) {
    case "R1":
      return `Завтра у тебя One-to-one с ${pos}. Если хочешь, можно заранее набросать в форме вопросы, темы или мысли к встрече. [URL=${link}]Открыть встречу в Milu[/URL]`;
    case "R2":
      return `Завтра у тебя One-to-one с сотрудником. Предлагаю заранее занести в форму темы для обсуждения, новости, похвалу или обратную связь. [URL=${link}]Открыть встречу в Milu[/URL]`;
    case "R3":
      return `Через час у тебя One-to-one. Если нужно, можно за пару минут зафиксировать в форме, что хочется обсудить. [URL=${link}]Открыть встречу в Milu[/URL]`;
    case "R4":
      return `Через час у тебя One-to-one с сотрудником. Если нужно, можно быстро отметить в форме основные акценты к встрече. [URL=${link}]Открыть встречу в Milu[/URL]`;
    case "R5":
      return `По вчерашнему One-to-one нет зафиксированного итога. Если встреча состоялась, заполни Итоги встречи. Если не состоялась, перенеси встречу на новую дату. [URL=${link}]Открыть встречу в Milu[/URL]`;
    case "R5a": {
      const dateStr = ctx.newDate || "новую дату";
      return `One-to-one перенесён на новую дату: ${dateStr}. Проверь обновленный слот встречи в Milu. [URL=${link}]Открыть встречу[/URL]`;
    }
    case "R6":
      return `По встрече One-to-one руководитель внес итоги. Ты можешь увидеть их на платформе. [URL=${link}]Открыть в Milu[/URL]`;
    case "R6a":
      return `По встрече One-to-one сотрудник внес итоги. Ты можешь увидеть их на платформе. [URL=${link}]Открыть в Milu[/URL]`;
    case "R6h":
      return `HR внёс изменения в итоги встречи One-to-one. Проверь обновления на платформе. [URL=${link}]Открыть в Milu[/URL]`;
    case "R7": {
      const monitoringLink = buildMiluLink("monitoring");
      const empName = ctx.employeeName || "сотруднику";
      return `По сотруднику ${empName} встречи one-to-one выпали из регулярности. Проверь кейс в Milu. [URL=${monitoringLink}]Открыть мониторинг[/URL]`;
    }
    case "R8": {
      const mgrName = ctx.managerName || "";
      const empName = ctx.employeeName || "";
      const namesText = mgrName && empName
        ? `между ${mgrName} и ${empName} `
        : "";
      return `По встрече one-to-one ${namesText}внесены итоги. Они доступны в Milu. [URL=${link}]Посмотреть итоги[/URL]`;
    }
    case "R1n": {
      const fallbackLink = buildMiluLink("fallback");
      return `Привет! Я Мила — помощница HR-платформы развития Milu в Ракете. Я помогу тебе с one-to-one: напомню о встречах, подскажу, когда пора зафиксировать итоги, и буду держать в курсе важных событий. [URL=${fallbackLink}]Открыть Milu[/URL]`;
    }
    default:
      return `У тебя обновление по One-to-one. [URL=${link}]Открыть в Milu[/URL]`;
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
      // 3. Check for R7 regularity alerts for HRBP
      await enqueueR7RegularityAlerts(supabase, SUPABASE_URL, SUPABASE_ANON_KEY);
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

        // R7: regularity alert — no meeting context needed
        if (job.scenario_id === "R7") {
          // Get employee name from the notification metadata or from tasks
          // R7 notifications don't have a meeting_id; we get context from tasks
          const text = getScenarioText("R7", { meetingId: "", employeeName: "" });

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

        // R8: HRBP summary available
        if (job.scenario_id === "R8") {
          // Fetch meeting to get manager/employee names
          let managerName = "";
          let employeeName = "";
          if (job.meeting_id) {
            const { data: meeting } = await supabase
              .from("one_on_one_meetings")
              .select("manager_id, employee_id")
              .eq("id", job.meeting_id)
              .single();

            if (meeting) {
              const { data: mgrUser } = await supabase
                .from("users")
                .select("first_name, last_name")
                .eq("id", meeting.manager_id)
                .single();
              const { data: empUser } = await supabase
                .from("users")
                .select("first_name, last_name")
                .eq("id", meeting.employee_id)
                .single();
              if (mgrUser) managerName = [mgrUser.last_name, mgrUser.first_name].filter(Boolean).join(" ");
              if (empUser) employeeName = [empUser.last_name, empUser.first_name].filter(Boolean).join(" ");
            }
          }

          const text = getScenarioText("R8", {
            meetingId: job.meeting_id || "",
            managerName,
            employeeName,
          });

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

    // Also check for new R5 overdue and R7 regularity alerts
    await enqueueR5Overdue(supabase);
    await enqueueR7RegularityAlerts(supabase, SUPABASE_URL, SUPABASE_ANON_KEY);

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
 */
async function enqueueR5Overdue(supabase: ReturnType<typeof createClient>) {
  const { data: overdue } = await supabase
    .from("one_on_one_meetings")
    .select("id, manager_id, meeting_date")
    .is("meeting_summary", null)
    .eq("status", "awaiting_summary")
    .lt("meeting_date", new Date().toISOString())
    .limit(50);

  if (!overdue || overdue.length === 0) return;

  for (const m of overdue) {
    const { data: existing } = await supabase
      .from("meeting_notifications")
      .select("id")
      .eq("meeting_id", m.id)
      .eq("recipient_id", m.manager_id)
      .eq("scenario_id", "R5")
      .in("status", ["pending", "sent"])
      .limit(1);

    if (existing && existing.length > 0) continue;

    const meetingDate = new Date(m.meeting_date);
    const nextDay = new Date(meetingDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(7, 0, 0, 0);

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

/**
 * R7: Enqueue regularity alert Bitrix notifications for HRBPs.
 * Mirrors the meeting_regularity_alert task logic in process_meeting_tasks().
 * Only creates R7 if no pending/sent R7 exists for this HRBP.
 */
async function enqueueR7RegularityAlerts(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  // Find HRBP users who have active meeting_regularity_alert tasks
  // that were recently created (within the last hour) to avoid re-sending
  const { data: alertTasks } = await supabase
    .from("tasks")
    .select("user_id, assignment_id")
    .eq("task_type", "meeting_regularity_alert")
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(50);

  if (!alertTasks || alertTasks.length === 0) return;

  for (const task of alertTasks) {
    // Check if R7 already pending/sent for this HRBP
    const { data: existing } = await supabase
      .from("meeting_notifications")
      .select("id")
      .is("meeting_id", null)
      .eq("recipient_id", task.user_id)
      .eq("scenario_id", "R7")
      .in("status", ["pending", "sent"])
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Get employee name for the notification text
    const { data: empUser } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", task.assignment_id)
      .single();

    const employeeName = empUser
      ? [empUser.last_name, empUser.first_name].filter(Boolean).join(" ")
      : "";

    await supabase.from("meeting_notifications").insert({
      meeting_id: null,
      recipient_id: task.user_id,
      scenario_id: "R7",
      scheduled_at: new Date().toISOString(),
      status: "pending",
    });
  }
}
