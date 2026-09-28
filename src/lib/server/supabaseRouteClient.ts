import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl } from "./supabaseAdmin.ts";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export function createSupabaseRouteClient(request: NextRequest) {
  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    throw new Error("Missing Supabase public auth configuration");
  }

  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value
        }));
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers);
      }
    }
  });

  function applyAuthCookies(response: NextResponse) {
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    for (const [key, value] of Object.entries(pendingHeaders)) {
      response.headers.set(key, value);
    }

    return response;
  }

  return { supabase, applyAuthCookies };
}
