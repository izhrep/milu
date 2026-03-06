import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  user_id: string;
  plain_email?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  manager_id?: string;
  position_id?: string;
  department_id?: string;
  status?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== UPDATE USER FUNCTION START ===");

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Требуется авторизация" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify calling user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callingUser) {
      console.error("Auth verification failed:", authError);
      return new Response(
        JSON.stringify({ error: "Неверный токен авторизации" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling user verified:", callingUser.id);

    // Check permissions
    const { data: hasPermission, error: permError } = await supabaseAdmin.rpc(
      "has_permission",
      {
        _user_id: callingUser.id,
        _permission_name: "users.update",
      }
    );

    if (permError) {
      console.error("Permission check error:", permError);
      return new Response(
        JSON.stringify({ error: "Ошибка проверки прав доступа" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasPermission) {
      console.error("User lacks permission:", callingUser.id);

      await supabaseAdmin.from("access_denied_logs").insert({
        user_id: callingUser.id,
        permission_name: "users.update",
        action_attempted: "update_user",
        resource_type: "user",
      });

      return new Response(
        JSON.stringify({ error: "Недостаточно прав для редактирования пользователей" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: UpdateUserRequest = await req.json();
    const {
      user_id,
      plain_email,
      first_name,
      last_name,
      middle_name,
      manager_id,
      position_id,
      department_id,
      status,
    } = body;

    console.log("Request data received for user:", user_id);

    // Validate user_id
    if (!user_id) {
      console.error("Missing user_id");
      return new Response(
        JSON.stringify({ error: "Отсутствует обязательное поле: user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists
    const { data: existingUser, error: getUserError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", user_id)
      .single();

    if (getUserError || !existingUser) {
      console.error("User not found:", user_id);
      return new Response(
        JSON.stringify({ error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare update data (plain text, no encryption)
    const updateData: any = {};

    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (middle_name !== undefined) updateData.middle_name = middle_name;
    if (plain_email) updateData.email = plain_email;

    // Add non-PII fields
    if (manager_id !== undefined) updateData.manager_id = manager_id;
    if (position_id !== undefined) updateData.position_id = position_id;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (status !== undefined) updateData.status = status;

    // Update user record
    console.log("Updating user record with plain data");
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", user_id)
      .select()
      .single();

    if (updateError) {
      console.error("User update failed:", updateError);
      return new Response(
        JSON.stringify({ error: `Ошибка обновления пользователя: ${updateError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User updated successfully:", updatedUser.id);

    // Update auth user email if provided
    if (plain_email) {
      console.log("Updating auth user email");
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { email: plain_email }
      );

      if (updateAuthError) {
        console.error("Auth user email update failed:", updateAuthError);
        // Don't fail the entire operation, just log the error
      }
    }

    // Log admin action
    const { error: logError } = await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: callingUser.id,
      _action_type: "user_updated",
      _target_user_id: user_id,
      _details: { updated_fields: Object.keys(updateData) },
    });

    if (logError) {
      console.error("Failed to log admin action:", logError);
    }

    console.log("=== USER UPDATE COMPLETED ===");

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return new Response(
      JSON.stringify({ error: `Внутренняя ошибка сервера: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
