import { NextRequest, NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getDemoUser, runDemoUndo } from "@/lib/server/demoStore";

type UndoRequest = {
  userId?: unknown;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => ({}))) as UndoRequest;
  const user = getDemoUser(typeof body.userId === "string" ? body.userId : null);

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const { result, state } = await runDemoUndo(decodeURIComponent(id), user);
  return NextResponse.json({ ...result, state, stats: dashboardStats(state) });
}
