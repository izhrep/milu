import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  role: string;
  manager_id?: string;
  position_id?: string;
  department_id?: string;
  grade_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== CREATE USER FUNCTION START ===");

    // Get authorization token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Требуется авторизация" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user token (for getUser call)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // Create admin client (for admin operations)
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

    // Get calling user from token
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();

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
        _permission_name: "users.create",
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
        permission_name: "users.create",
        action_attempted: "create_user",
        resource_type: "user",
      });

      return new Response(
        JSON.stringify({ error: "Недостаточно прав для создания пользователей" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    const {
      email,
      password,
      first_name,
      last_name,
      middle_name = "",
      role,
      manager_id,
      position_id,
      department_id,
      grade_id,
    } = body;

    console.log("Request data received - storing plain text data (no encryption)");

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({
          error: "Отсутствуют обязательные поля: email, password, first_name, last_name, role",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    console.log("Checking for existing email:", email);
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

    if (!checkError && existingUsers?.users) {
      const emailExists = existingUsers.users.some((u) => u.email === email);
      if (emailExists) {
        console.error("Email already exists:", email);
        return new Response(
          JSON.stringify({ error: "Пользователь с таким email уже существует" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create auth user with plain data (no encryption)
    console.log("Creating auth user for email:", email);
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
        middle_name: middle_name,
      },
    });

    if (createAuthError || !authData.user) {
      console.error("=== AUTH USER CREATION FAILED ===");
      console.error("Error object:", JSON.stringify(createAuthError, null, 2));
      console.error("Error message:", createAuthError?.message);
      console.error("Error status:", createAuthError?.status);
      
      let errorMessage = "Ошибка создания пользователя";
      let statusCode = 400;
      
      if (createAuthError?.message) {
        const msg = createAuthError.message.toLowerCase();
        
        if (msg.includes("already exists") || msg.includes("already registered")) {
          errorMessage = "Пользователь с таким email уже существует";
          statusCode = 409;
        } else if (msg.includes("invalid email") || msg.includes("email")) {
          errorMessage = "Неверный формат email";
          statusCode = 400;
        } else if (msg.includes("password") && (msg.includes("short") || msg.includes("length") || msg.includes("minimum"))) {
          errorMessage = "Пароль должен содержать минимум 8 символов";
          statusCode = 400;
        } else if (msg.includes("password")) {
          errorMessage = "Неверный формат пароля. Пароль должен содержать минимум 8 символов";
          statusCode = 400;
        } else {
          errorMessage = `Ошибка создания пользователя: ${createAuthError.message}`;
          statusCode = 500;
        }
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: createAuthError?.message
        }),
        { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUser = authData.user;
    console.log("Auth user created:", authUser.id);

    // Create user record in public.users with plain data
    console.log("=== CREATING USER RECORD ===");
    console.log("User ID:", authUser.id);
    console.log("Email:", email);
    console.log("Position ID:", position_id);
    console.log("Department ID:", department_id);
    console.log("Grade ID:", grade_id);
    
    const { data: newUser, error: createUserError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authUser.id,
        email: email,
        first_name: first_name,
        last_name: last_name,
        middle_name: middle_name,
        employee_number: `EMP${Date.now().toString().slice(-6)}`,
        manager_id: manager_id || null,
        position_id: position_id || null,
        department_id: department_id || null,
        grade_id: grade_id || null,
        status: true,
      })
      .select()
      .single();

    if (createUserError) {
      console.error("=== USER RECORD CREATION FAILED ===");
      console.error("Error object:", JSON.stringify(createUserError, null, 2));
      console.error("Error message:", createUserError.message);
      console.error("Error code:", createUserError.code);
      console.error("Error details:", createUserError.details);
      console.error("Error hint:", createUserError.hint);

      // Rollback: delete auth user
      console.log("Rolling back: deleting auth user", authUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      return new Response(
        JSON.stringify({ 
          error: `Ошибка создания записи пользователя: ${createUserError.message}`,
          details: createUserError.details,
          hint: createUserError.hint
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User record created successfully:", newUser.id);

    // Create role entry
    console.log("=== CREATING ROLE ENTRY ===");
    console.log("User ID:", newUser.id);
    console.log("Role:", role);
    
    const { error: createRoleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.id,
      role: role,
    });

    if (createRoleError) {
      console.error("=== ROLE CREATION FAILED ===");
      console.error("Error object:", JSON.stringify(createRoleError, null, 2));
      console.error("Error message:", createRoleError.message);
      console.error("Error code:", createRoleError.code);
      console.error("Error details:", createRoleError.details);
      console.error("Error hint:", createRoleError.hint);

      // Rollback: delete user and auth user
      console.log("Rolling back: deleting user and auth user");
      await supabaseAdmin.from("users").delete().eq("id", newUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      return new Response(
        JSON.stringify({ 
          error: `Ошибка создания роли: ${createRoleError.message}`,
          details: createRoleError.details,
          hint: createRoleError.hint
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Role created successfully");

    // Log admin action
    const { error: logError } = await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: callingUser.id,
      _action_type: "user_created",
      _target_user_id: newUser.id,
      _details: { email: email, role },
    });

    if (logError) {
      console.error("Failed to log admin action:", logError);
    }

    console.log("=== USER CREATION COMPLETED ===");
    console.log("User ID:", newUser.id, "Email:", email, "Role:", role);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          role,
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
