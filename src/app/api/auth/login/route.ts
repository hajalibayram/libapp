import { NextRequest, NextResponse } from "next/server";
import { getStoreUser } from "@/lib/server/store";
import { createSupabaseRouteClient } from "@/lib/server/supabaseRouteClient";

type LoginRequest = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as LoginRequest;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ status: "MISSING_CREDENTIALS" }, { status: 400 });
  }

  const { supabase, applyAuthCookies } = createSupabaseRouteClient(request);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ status: "INVALID_LOGIN" }, { status: 401 });
  }

  const user = await getStoreUser(data.user.id);

  if (!user || !user.active) {
    return NextResponse.json({ status: "PROFILE_NOT_ACTIVE" }, { status: 403 });
  }

  return applyAuthCookies(NextResponse.json({ user }));
}
