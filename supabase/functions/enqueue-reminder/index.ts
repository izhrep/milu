import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, badRequest, serverError, jsonOk } from "../_shared/validation.ts";

const VALID_ACTIONS = ["schedule", "reschedule", "summary_saved", "deleted", "bitrix_user_connected", "hrbp_summary_available", "hrbp_regularity_alert"] as const;
type Action = typeof VALID_ACTIONS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const body = await req.json();
    const { meeting_id, action, new_date, summary_saved_by, user_id, hrbp_id, manager_name, employee_name } = body;

    if (!VALID_ACTIONS.includes(action)) return badRequest("Invalid action");

    // R1n: welcome message — no meeting_id needed
    if (action === "bitrix_user_connected") {
      if (!isUUID(user_id)) return badRequest("Invalid user_id");

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Only skip if there's already a pending R1n queued
      const { data: pending } = await supabase
        .from("meeting_notifications")
        .select("id")
        .eq("recipient_id", user_id)
        .eq("scenario_id", "R1n")
        .eq("status", "pending")
        .limit(1);

      if (pending && pending.length > 0) {
        return jsonOk({ skipped: true, reason: "r1n_already_pending" });
      }

      const scheduledAt = new Date().toISOString();

      await supabase.from("meeting_notifications").insert({
        meeting_id: null,
        recipient_id: user_id,
        scenario_id: "R1n",
        scheduled_at: scheduledAt,
        status: "pending",
      });

      // Trigger immediate processing
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

      if (supabaseUrl && supabaseAnonKey) {
        fetch(`${supabaseUrl}/functions/v1/process-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }).catch((error) => {
          console.error("Immediate process-reminders call failed:", error);
        });
      }

      return jsonOk({ action: "bitrix_user_connected", user_id });
    }

    // ─── HRBP SUMMARY AVAILABLE (R8) ───
    if (action === "hrbp_summary_available") {
      if (!isUUID(meeting_id)) return badRequest("Invalid meeting_id");
      if (!isUUID(hrbp_id)) return badRequest("Invalid hrbp_id");

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const now = new Date().toISOString();

      // Deduplicate: skip if R8 already pending/sent for this meeting+HRBP
      const { data: existing } = await supabase
        .from("meeting_notifications")
        .select("id")
        .eq("meeting_id", meeting_id)
        .eq("recipient_id", hrbp_id)
        .eq("scenario_id", "R8")
        .in("status", ["pending", "sent"])
        .limit(1);

      if (existing && existing.length > 0) {
        return jsonOk({ skipped: true, reason: "r8_already_exists" });
      }

      await supabase.from("meeting_notifications").insert({
        meeting_id,
        recipient_id: hrbp_id,
        scenario_id: "R8",
        scheduled_at: now,
        status: "pending",
      });

      // Trigger immediate processing
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && supabaseAnonKey) {
        fetch(`${supabaseUrl}/functions/v1/process-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }).catch((e) => console.error("Immediate process-reminders failed:", e));
      }

      return jsonOk({ action: "hrbp_summary_available", meeting_id, hrbp_id });
    }

    // ─── HRBP REGULARITY ALERT (R7) ───
    if (action === "hrbp_regularity_alert") {
      if (!isUUID(hrbp_id)) return badRequest("Invalid hrbp_id");
      const employee_id = body.employee_id;
      if (!isUUID(employee_id)) return badRequest("Invalid employee_id");

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const now = new Date().toISOString();

      // Deduplicate by employee_id stored in meeting_id field (no real meeting)
      // Use a deterministic key: scenario R7 + recipient hrbp + "employee:<id>" stored via meeting_id=null
      const { data: existing } = await supabase
        .from("meeting_notifications")
        .select("id")
        .is("meeting_id", null)
        .eq("recipient_id", hrbp_id)
        .eq("scenario_id", "R7")
        .in("status", ["pending", "sent"])
        .limit(1);

      // For R7, we skip entirely if there's any pending R7 for this HRBP
      // More granular dedup would require schema changes; this is sufficient
      // since the cron already deduplicates tasks per employee
      if (existing && existing.length > 0) {
        return jsonOk({ skipped: true, reason: "r7_already_pending" });
      }

      await supabase.from("meeting_notifications").insert({
        meeting_id: null,
        recipient_id: hrbp_id,
        scenario_id: "R7",
        scheduled_at: now,
        status: "pending",
      });

      // Trigger immediate processing
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && supabaseAnonKey) {
        fetch(`${supabaseUrl}/functions/v1/process-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }).catch((e) => console.error("Immediate process-reminders failed:", e));
      }

      return jsonOk({ action: "hrbp_regularity_alert", hrbp_id, employee_id });
    }

    if (!isUUID(meeting_id)) return badRequest("Invalid meeting_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ─── DELETE ───
    if (action === "deleted") {
      const { error } = await supabase
        .from("meeting_notifications")
        .delete()
        .eq("meeting_id", meeting_id);
      if (error) console.error("Delete notifications error:", error.message);
      return jsonOk({ action: "deleted", meeting_id });
    }

    // Fetch meeting data for other actions
    const { data: meeting, error: meetingErr } = await supabase
      .from("one_on_one_meetings")
      .select("id, employee_id, manager_id, meeting_date, meeting_summary, summary_saved_by")
      .eq("id", meeting_id)
      .single();

    if (meetingErr || !meeting) {
      console.error("Meeting not found:", meeting_id, meetingErr?.message);
      return jsonOk({ skipped: true, reason: "meeting_not_found" });
    }

    // ─── SUMMARY SAVED ───
    if (action === "summary_saved") {
      // Cancel all pending notifications for this meeting
      await supabase
        .from("meeting_notifications")
        .delete()
        .eq("meeting_id", meeting_id)
        .eq("status", "pending");

      // Determine who saved and who to notify
      const savedBy = summary_saved_by || meeting.summary_saved_by;
      const isManagerSaved = savedBy === meeting.manager_id;
      const isEmployeeSaved = savedBy === meeting.employee_id;
      const isHrbpSaved = !isManagerSaved && !isEmployeeSaved;

      const now = new Date().toISOString();

      if (isHrbpSaved) {
        // HRBP: notify BOTH participants with neutral scenario R6h
        const records = [
          { meeting_id, recipient_id: meeting.employee_id, scenario_id: "R6h", scheduled_at: now, status: "pending" },
          { meeting_id, recipient_id: meeting.manager_id, scenario_id: "R6h", scheduled_at: now, status: "pending" },
        ];
        await supabase.from("meeting_notifications").upsert(records, {
          onConflict: "meeting_id,recipient_id,scenario_id,scheduled_at",
        });
      } else {
        const recipientId = isManagerSaved ? meeting.employee_id : meeting.manager_id;
        const scenarioId = isManagerSaved ? "R6" : "R6a";

        await supabase.from("meeting_notifications").upsert(
          {
            meeting_id,
            recipient_id: recipientId,
            scenario_id: scenarioId,
            scheduled_at: now,
            status: "pending",
          },
          { onConflict: "meeting_id,recipient_id,scenario_id,scheduled_at" },
        );
      }

      // Trigger immediate processing
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && supabaseAnonKey) {
        fetch(`${supabaseUrl}/functions/v1/process-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }).catch((error) => {
          console.error("Immediate process-reminders call failed:", error);
        });
      }

      return jsonOk({ action: "summary_saved" });
    }

    // ─── RESCHEDULE ───
    if (action === "reschedule") {
      // Delete old pending pre-meeting jobs
      await supabase
        .from("meeting_notifications")
        .delete()
        .eq("meeting_id", meeting_id)
        .eq("status", "pending");

      // Create R5a (notify both about reschedule)
      const now = new Date().toISOString();
      const r5aRecords = [
        { meeting_id, recipient_id: meeting.employee_id, scenario_id: "R5a", scheduled_at: now, status: "pending" },
        { meeting_id, recipient_id: meeting.manager_id, scenario_id: "R5a", scheduled_at: now, status: "pending" },
      ];

      await supabase
        .from("meeting_notifications")
        .upsert(r5aRecords, { onConflict: "meeting_id,recipient_id,scenario_id,scheduled_at" });

      // Trigger immediate processing for R5a
      const supabaseUrlR5a = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKeyR5a = Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrlR5a && supabaseAnonKeyR5a) {
        fetch(`${supabaseUrlR5a}/functions/v1/process-reminders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKeyR5a}`,
          },
        }).catch((error) => {
          console.error("Immediate process-reminders call for R5a failed:", error);
        });
      }

      // Fall through to create new R1–R4
    }

    // ─── SCHEDULE (also after reschedule) ───
    if (action === "schedule" || action === "reschedule") {
      if (!meeting.meeting_date) {
        return jsonOk({ skipped: true, reason: "no_meeting_date" });
      }

      const meetingDate = new Date(meeting.meeting_date);
      const now = new Date();

      const jobs: Array<{
        meeting_id: string;
        recipient_id: string;
        scenario_id: string;
        scheduled_at: string;
        status: string;
      }> = [];

      // R1/R2: 24 hours before
      const minus24h = new Date(meetingDate.getTime() - 24 * 60 * 60 * 1000);
      if (minus24h > now) {
        jobs.push(
          { meeting_id, recipient_id: meeting.employee_id, scenario_id: "R1", scheduled_at: minus24h.toISOString(), status: "pending" },
          { meeting_id, recipient_id: meeting.manager_id, scenario_id: "R2", scheduled_at: minus24h.toISOString(), status: "pending" },
        );
      }

      // R3/R4: 1 hour before
      const minus1h = new Date(meetingDate.getTime() - 60 * 60 * 1000);
      if (minus1h > now) {
        jobs.push(
          { meeting_id, recipient_id: meeting.employee_id, scenario_id: "R3", scheduled_at: minus1h.toISOString(), status: "pending" },
          { meeting_id, recipient_id: meeting.manager_id, scenario_id: "R4", scheduled_at: minus1h.toISOString(), status: "pending" },
        );
      }

      if (jobs.length > 0) {
        const { error } = await supabase
          .from("meeting_notifications")
          .upsert(jobs, { onConflict: "meeting_id,recipient_id,scenario_id,scheduled_at" });
        if (error) console.error("Upsert jobs error:", error.message);
      }

      return jsonOk({ action, jobs_created: jobs.length });
    }

    return jsonOk({ action });
  } catch (err) {
    console.error("enqueue-reminder error:", err);
    return serverError();
  }
});
