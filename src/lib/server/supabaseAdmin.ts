import { createClient } from "@supabase/supabase-js";

export function hasSupabaseConfig(): boolean {
  return Boolean(
    getSupabaseUrl() &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY) &&
      getSupabaseServiceKey()
  );
}

export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server configuration");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function getSupabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}
