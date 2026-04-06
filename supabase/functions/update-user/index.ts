import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  isUUID,
  isEmail,
  isNonEmptyString,
  normalizeEmail,
  sanitizeString,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
  jsonOk,
  validateOptionalUUID,
  validateRequiredUUID,
} from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== UPDATE USER FUNCTION START ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return unauthorized("Требуется авторизация");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify calling user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: callingUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callingUser) {
      console.error("Auth verification failed");
      return unauthorized("Неверный токен авторизации");
    }

    console.log("Calling user verified:", callingUser.id);

    // Check permissions
    const { data: hasPermission, error: permError } = await supabaseAdmin.rpc("has_permission", {
      _user_id: callingUser.id,
      _permission_name: "users.update",
    });

    if (permError) {
      console.error("Permission check error:", permError);
      return serverError("Ошибка проверки прав доступа");
    }

    if (!hasPermission) {
      console.error("User lacks permission:", callingUser.id);
      await supabaseAdmin.from("access_denied_logs").insert({
        user_id: callingUser.id,
        permission_name: "users.update",
        action_attempted: "update_user",
        resource_type: "user",
      });
      return forbidden("Недостаточно прав для редактирования пользователей");
    }

    // Parse & validate input
    const body = await req.json();
    const {
      user_id,
      plain_email: rawEmail,
      first_name: rawFirstName,
      last_name: rawLastName,
      middle_name: rawMiddleName,
      manager_id,
      position_id,
      department_id,
      status,
      bitrix_bot_enabled,
      bitrix_user_id,
    } = body;

    // --- Validate user_id (required UUID) ---
    const userIdErr = validateRequiredUUID(user_id, "user_id");
    if (userIdErr) return userIdErr;

    // --- Validate optional UUIDs ---
    for (const [val, name] of [
      [manager_id, "manager_id"],
      [position_id, "position_id"],
      [department_id, "department_id"],
    ] as const) {
      const err = validateOptionalUUID(val, name);
      if (err) return err;
    }

    // --- Validate email if provided ---
    let normalizedEmail: string | undefined;
    if (rawEmail !== undefined && rawEmail !== null && rawEmail !== "") {
      if (!isEmail(rawEmail)) {
        console.error("Invalid email format");
        return badRequest("Неверный формат email");
      }
      normalizedEmail = normalizeEmail(rawEmail);
    }

    // --- Validate name lengths ---
    if (rawFirstName !== undefined && !isNonEmptyString(rawFirstName, 100)) {
      return badRequest("Имя слишком длинное или пустое");
    }
    if (rawLastName !== undefined && !isNonEmptyString(rawLastName, 100)) {
      return badRequest("Фамилия слишком длинная или пустая");
    }
    if (rawMiddleName !== undefined && typeof rawMiddleName === "string" && rawMiddleName.length > 100) {
      return badRequest("Отчество слишком длинное");
    }

    console.log("Input validation passed for user:", user_id);

    // Check if user exists and fetch current bitrix_bot_enabled for audit
    const { data: existingUser, error: getUserError } = await supabaseAdmin
      .from("users")
      .select("id, bitrix_bot_enabled")
      .eq("id", user_id)
      .single();

    if (getUserError || !existingUser) {
      console.error("User not found:", user_id);
      return badRequest("Пользователь не найден");
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (rawFirstName) updateData.first_name = sanitizeString(rawFirstName, 100);
    if (rawLastName) updateData.last_name = sanitizeString(rawLastName, 100);
    if (rawMiddleName !== undefined) updateData.middle_name = sanitizeString(rawMiddleName, 100);
    if (normalizedEmail) updateData.email = normalizedEmail;

    if (manager_id !== undefined) updateData.manager_id = manager_id;
    if (position_id !== undefined) updateData.position_id = position_id;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (status !== undefined) updateData.status = status;
    if (bitrix_bot_enabled !== undefined) updateData.bitrix_bot_enabled = !!bitrix_bot_enabled;
    if (bitrix_user_id !== undefined) updateData.bitrix_user_id = bitrix_user_id;

    // Update user record
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", user_id)
      .select()
      .single();

    if (updateError) {
      console.error("User update failed:", JSON.stringify(updateError));
      const userLabel = normalizedEmail || user_id || "неизвестный пользователь";
      return serverError(`Ошибка обновления пользователя: ${userLabel}. Обратитесь к администратору.`);
    }

    console.log("User updated successfully:", updatedUser.id);

    // Update auth user email if provided
    if (normalizedEmail) {
      console.log("Updating auth user email");
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email: normalizedEmail,
      });
      if (updateAuthError) {
        console.error("Auth user email update failed:", updateAuthError.message);
      }
    }

    // Log admin action
    const { error: logError } = await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: callingUser.id,
      _action_type: "user_updated",
      _target_user_id: user_id,
      _details: { updated_fields: Object.keys(updateData) },
    });
    if (logError) console.error("Failed to log admin action:", logError);

    // Audit bitrix_bot_enabled change if value actually changed
    if (
      bitrix_bot_enabled !== undefined &&
      !!existingUser.bitrix_bot_enabled !== !!bitrix_bot_enabled
    ) {
      const oldVal = String(!!existingUser.bitrix_bot_enabled);
      const newVal = String(!!bitrix_bot_enabled);
      console.log(`bitrix_bot_enabled changed: ${oldVal} -> ${newVal} for user ${user_id}`);
      const { error: auditErr } = await supabaseAdmin.rpc("log_admin_action", {
        _admin_id: callingUser.id,
        _action_type: "bitrix_bot_enabled_changed",
        _target_user_id: user_id,
        _details: {
          field: "bitrix_bot_enabled",
          old_value: oldVal,
          new_value: newVal,
          source: "update_user_function",
        },
      });
      if (auditErr) console.error("Failed to log bitrix_bot_enabled audit:", auditErr);

      // Trigger R1n welcome notification when bot is enabled
      if (!!bitrix_bot_enabled && !existingUser.bitrix_bot_enabled) {
        try {
          const enqueueUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enqueue-reminder`;
          const enqueueRes = await fetch(enqueueUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              action: "bitrix_user_connected",
              user_id: user_id,
            }),
          });
          const enqueueResult = await enqueueRes.json();
          console.log("R1n enqueue result:", JSON.stringify(enqueueResult));
        } catch (enqueueErr) {
          console.error("Failed to enqueue R1n:", enqueueErr);
        }
      }
    }

    console.log("=== USER UPDATE COMPLETED ===");

    return jsonOk({
      success: true,
      user: { id: updatedUser.id, email: updatedUser.email },
    });
  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return serverError("Внутренняя ошибка сервера. Обратитесь к администратору.");
  }
});
