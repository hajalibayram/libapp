import { NextRequest, NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { resetStoreState } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  if (user.role !== "ADMIN") {
    return applyAuthCookies(NextResponse.json({ status: "FORBIDDEN" }, { status: 403 }));
  }

  const state = await resetStoreState();
  return applyAuthCookies(NextResponse.json({ state, stats: dashboardStats(state) }));
}
