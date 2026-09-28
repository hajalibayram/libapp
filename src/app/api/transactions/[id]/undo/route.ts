import { NextRequest, NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { runStoreUndo } from "@/lib/server/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  const { id } = await context.params;
  const { result, state } = await runStoreUndo(decodeURIComponent(id), user);
  return applyAuthCookies(NextResponse.json({ ...result, state, stats: dashboardStats(state) }));
}
