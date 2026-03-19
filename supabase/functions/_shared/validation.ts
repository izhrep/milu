/**
 * Shared input validation & sanitization helpers for Edge Functions.
 * Import as: import { isUUID, isEmail, ... } from "../_shared/validation.ts";
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Control chars U+0000-U+001F, U+007F, zero-width chars
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F\u200B\u200C\u200D\uFEFF]/g;

const ALLOWED_ROLES = ["admin", "hr", "manager", "employee", "hr_bp"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Validators ----------

export function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 255 && EMAIL_RE.test(normalized);
}

export function isAllowedRole(value: unknown): value is AllowedRole {
  return typeof value === "string" && (ALLOWED_ROLES as readonly string[]).includes(value);
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

// ---------- Sanitizers ----------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strip control/zero-width chars, trim, enforce max length */
export function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS_RE, "").trim().slice(0, maxLength);
}

// ---------- Response helpers ----------

export function badRequest(message = "Invalid input"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function unauthorized(message = "Unauthorized"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function forbidden(message = "Access denied"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function serverError(message = "Internal server error"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Validate an optional UUID field. Returns error Response or null if valid. */
export function validateOptionalUUID(value: unknown, fieldName: string): Response | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isUUID(value)) {
    console.error(`Invalid UUID for ${fieldName}:`, typeof value);
    return badRequest("Invalid input");
  }
  return null;
}

/** Validate a required UUID field. Returns error Response or null if valid. */
export function validateRequiredUUID(value: unknown, fieldName: string): Response | null {
  if (!value) {
    console.error(`Missing required UUID field: ${fieldName}`);
    return badRequest("Invalid input");
  }
  if (!isUUID(value)) {
    console.error(`Invalid UUID for ${fieldName}:`, typeof value);
    return badRequest("Invalid input");
  }
  return null;
}
