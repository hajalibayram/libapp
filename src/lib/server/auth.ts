import { NextRequest, NextResponse } from "next/server";
import { AppUser } from "../core.ts";
import { getStoreUser } from "./store.ts";
import { createSupabaseRouteClient } from "./supabaseRouteClient.ts";

export async function getAuthenticatedUser(request: NextRequest): Promise<{
  user: AppUser | null;
  applyAuthCookies: (response: NextResponse) => NextResponse;
}> {
  const { supabase, applyAuthCookies } = createSupabaseRouteClient(request);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, applyAuthCookies };
  }

  return {
    user: await getStoreUser(data.user.id),
    applyAuthCookies
  };
}
