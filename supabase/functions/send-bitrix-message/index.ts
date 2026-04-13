import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, isNonEmptyString, badRequest, serverError, jsonOk } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, text } = await req.json();

    if (!isUUID(user_id)) return badRequest("Invalid user_id");
    if (!isNonEmptyString(text, 2000)) return badRequest("Invalid text");

    const BITRIX_WEBHOOK_URL = Deno.env.get("BITRIX_WEBHOOK_URL");
    if (!BITRIX_WEBHOOK_URL) {
      console.error("BITRIX_WEBHOOK_URL not configured");
      return serverError("Bitrix integration not configured");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get user's Bitrix settings
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("bitrix_user_id, bitrix_bot_enabled")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      console.error("User not found:", user_id, userError?.message);
      return jsonOk({ skipped: true, reason: "user_not_found" });
    }

    if (!user.bitrix_bot_enabled) {
      return jsonOk({ skipped: true, reason: "bot_disabled" });
    }

    if (!user.bitrix_user_id) {
      console.warn("No bitrix_user_id for user:", user_id);
      return jsonOk({ skipped: true, reason: "no_bitrix_user_id" });
    }

    // Send message via Bitrix API
    const BOT_ID = 2674;
    const bitrixUrl = `${BITRIX_WEBHOOK_URL}/imbot.message.add.json`;

    const bitrixResponse = await fetch(bitrixUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        BOT_ID: BOT_ID,
        CLIENT_ID: "b9x8q9n7pjymiqv3zpjxbiwtvxybkb0p",
        DIALOG_ID: String(user.bitrix_user_id),
        MESSAGE: text,
        URL_PREVIEW: "N",
      }),
    });

    const bitrixResult = await bitrixResponse.json();

    if (!bitrixResponse.ok || bitrixResult.error) {
      console.error("Bitrix API error:", JSON.stringify(bitrixResult));
      return jsonOk({ sent: false, error: bitrixResult.error || "bitrix_api_error" });
    }

    console.log(`Message sent to bitrix_user_id=${user.bitrix_user_id}`);
    return jsonOk({ sent: true, message_id: bitrixResult.result });

  } catch (err) {
    console.error("send-bitrix-message error:", err);
    return serverError();
  }
});
