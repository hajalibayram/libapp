import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/server/supabaseRouteClient";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthCookies } = createSupabaseRouteClient(request);
  await supabase.auth.signOut();
  return applyAuthCookies(NextResponse.json({ status: "OK" }));
}
