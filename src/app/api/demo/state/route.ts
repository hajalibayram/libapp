import { NextRequest, NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getStoreState } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  const state = await getStoreState();
  return applyAuthCookies(NextResponse.json({ state, stats: dashboardStats(state) }));
}
