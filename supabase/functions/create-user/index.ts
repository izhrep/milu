import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  isUUID,
  isEmail,
  isAllowedRole,
  isNonEmptyString,
  normalizeEmail,
  sanitizeString,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
  jsonOk,
  validateOptionalUUID,
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
    console.log("=== CREATE USER FUNCTION START ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return unauthorized("Требуется авторизация");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const {
      data: { user: callingUser },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !callingUser) {
      console.error("Auth verification failed");
      return unauthorized("Неверный токен авторизации");
    }

    console.log("Calling user verified:", callingUser.id);

    // Permission check
    const { data: hasPermission, error: permError } = await supabaseAdmin.rpc("has_permission", {
      _user_id: callingUser.id,
      _permission_name: "users.create",
    });

    if (permError) {
      console.error("Permission check error:", permError);
      return serverError("Ошибка проверки прав доступа");
    }

    if (!hasPermission) {
      console.error("User lacks permission:", callingUser.id);
      await supabaseAdmin.from("access_denied_logs").insert({
        user_id: callingUser.id,
        permission_name: "users.create",
        action_attempted: "create_user",
        resource_type: "user",
      });
      return forbidden("Недостаточно прав для создания пользователей");
    }

    // Parse & validate input
    const body = await req.json();
    const {
      email: rawEmail,
      password,
      first_name: rawFirstName,
      last_name: rawLastName,
      middle_name: rawMiddleName,
      role,
      manager_id,
      position_id,
      department_id,
      grade_id,
    } = body;

    // --- Validate required fields ---
    if (!rawEmail || !password || !rawFirstName || !rawLastName || !role) {
      console.error("Missing required fields");
      return badRequest("Отсутствуют обязательные поля");
    }

    // --- Validate & normalize email ---
    if (!isEmail(rawEmail)) {
      console.error("Invalid email format");
      return badRequest("Неверный формат email");
    }
    const email = normalizeEmail(rawEmail);

    // --- Validate password type ---
    if (typeof password !== "string" || password.length === 0) {
      console.error("Invalid password");
      return badRequest("Неверный формат пароля");
    }

    // --- Validate role against allowlist ---
    if (!isAllowedRole(role)) {
      console.error("Invalid role:", role);
      return badRequest("Недопустимая роль");
    }

    // --- Validate name lengths ---
    if (!isNonEmptyString(rawFirstName, 100)) {
      return badRequest("Имя слишком длинное или пустое");
    }
    if (!isNonEmptyString(rawLastName, 100)) {
      return badRequest("Фамилия слишком длинная или пустая");
    }
    const first_name = sanitizeString(rawFirstName, 100);
    const last_name = sanitizeString(rawLastName, 100);
    const middle_name = rawMiddleName ? sanitizeString(rawMiddleName, 100) : "";

    // --- Validate optional UUIDs ---
    for (const [val, name] of [
      [manager_id, "manager_id"],
      [position_id, "position_id"],
      [department_id, "department_id"],
      [grade_id, "grade_id"],
    ] as const) {
      const err = validateOptionalUUID(val, name);
      if (err) return err;
    }

    console.log("Input validation passed");

    // Check if email already exists
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    if (!checkError && existingUsers?.users) {
      const emailExists = existingUsers.users.some((u) => u.email === email);
      if (emailExists) {
        console.error("Email already exists");
        return badRequest("Пользователь с таким email уже существует");
      }
    }

    // Create auth user
    console.log("Creating auth user");
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, middle_name },
    });

    if (createAuthError || !authData.user) {
      console.error("Auth user creation failed:", createAuthError?.message);

      // Map known errors to safe messages
      const msg = (createAuthError?.message || "").toLowerCase();
      if (msg.includes("already exists") || msg.includes("already registered")) {
        return badRequest("Пользователь с таким email уже существует");
      }
      if (msg.includes("invalid email")) {
        return badRequest("Неверный формат email");
      }
      if (msg.includes("password")) {
        return badRequest("Пароль должен содержать минимум 8 символов");
      }
      return serverError("Ошибка создания пользователя");
    }

    const authUser = authData.user;
    console.log("Auth user created:", authUser.id);

    // Create user record
    const { data: newUser, error: createUserError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authUser.id,
        email,
        first_name,
        last_name,
        middle_name,
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
      console.error("User record creation failed:", JSON.stringify(createUserError));
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      const userLabel = email || `${first_name} ${last_name}`.trim() || "неизвестный пользователь";
      return serverError(`Ошибка создания пользователя: ${userLabel}. Обратитесь к администратору.`);
    }

    console.log("User record created:", newUser.id);

    // Create role entry
    const { error: createRoleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.id,
      role,
    });

    if (createRoleError) {
      console.error("Role creation failed:", JSON.stringify(createRoleError));
      await supabaseAdmin.from("users").delete().eq("id", newUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      const userLabel = email || `${first_name} ${last_name}`.trim() || "неизвестный пользователь";
      return serverError(`Ошибка создания роли для пользователя: ${userLabel}. Обратитесь к администратору.`);
    }

    console.log("Role created successfully");

    // Log admin action
    const { error: logError } = await supabaseAdmin.rpc("log_admin_action", {
      _admin_id: callingUser.id,
      _action_type: "user_created",
      _target_user_id: newUser.id,
      _details: { email, role },
    });
    if (logError) console.error("Failed to log admin action:", logError);

    console.log("=== USER CREATION COMPLETED ===");

    return jsonOk({
      success: true,
      user: { id: newUser.id, email: newUser.email, role },
    });
  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return serverError("Внутренняя ошибка сервера. Обратитесь к администратору.");
  }
});
