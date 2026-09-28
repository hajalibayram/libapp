import { NextRequest, NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getStoreUser, runStoreUndo } from "@/lib/server/store";

type UndoRequest = {
  userId?: unknown;
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => ({}))) as UndoRequest;
  const user = await getStoreUser(typeof body.userId === "string" ? body.userId : null);

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await context.params;
  const { result, state } = await runStoreUndo(decodeURIComponent(id), user);
  return NextResponse.json({ ...result, state, stats: dashboardStats(state) });
}
