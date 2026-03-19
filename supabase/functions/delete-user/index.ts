import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== DELETE USER FUNCTION START ===");

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
        _permission_name: "users.delete",
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
        permission_name: "users.delete",
        action_attempted: "delete_user",
        resource_type: "user",
      });

      return new Response(
        JSON.stringify({ error: "Недостаточно прав для удаления пользователей" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: DeleteUserRequest = await req.json();
    const { user_id } = body;

    console.log("Request data received for user:", user_id);

    // Validate user_id
    if (!user_id) {
      console.error("Missing user_id");
      return new Response(
        JSON.stringify({ error: "Отсутствует обязательное поле: user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (user_id === callingUser.id) {
      console.error("User attempted to delete themselves:", user_id);
      return new Response(
        JSON.stringify({ error: "Нельзя удалить самого себя" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists
    const { data: existingUser, error: getUserError } = await supabaseAdmin
      .from("users")
      .select("id, email, first_name, last_name")
      .eq("id", user_id)
      .single();

    if (getUserError || !existingUser) {
      console.error("User not found:", user_id);
      return new Response(
        JSON.stringify({ error: "Пользователь не найден" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User found, proceeding with deletion");

    // Log admin action before deletion
    const { error: logError } = await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: callingUser.id,
      _action_type: "user_deleted",
      _target_user_id: user_id,
      _details: {
        email: existingUser.email,
        first_name: existingUser.first_name,
        last_name: existingUser.last_name,
      },
    });

    if (logError) {
      console.error("Failed to log admin action:", logError);
    }

    // Delete user from public.users (CASCADE will handle related records)
    console.log("Deleting user record from public.users");
    const { error: deleteUserError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user_id);

    if (deleteUserError) {
      console.error("User deletion failed:", JSON.stringify(deleteUserError));
      const userLabel = existingUser.email || `${existingUser.first_name ?? ""} ${existingUser.last_name ?? ""}`.trim() || user_id;
      return new Response(
        JSON.stringify({ error: `Ошибка удаления пользователя: ${userLabel}. Обратитесь к администратору.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User record deleted from public.users");

    // Delete user from auth.users
    console.log("Deleting user from auth.users");
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      console.error("Auth user deletion failed:", deleteAuthError);
      // Don't fail the entire operation if auth deletion fails
      // The user record is already deleted from public.users
      console.warn("Continuing despite auth deletion error");
    } else {
      console.log("User deleted from auth.users");
    }

    console.log("=== USER DELETION COMPLETED ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Пользователь успешно удален",
        user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера. Обратитесь к администратору." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
