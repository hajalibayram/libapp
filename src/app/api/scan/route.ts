import { NextRequest, NextResponse } from "next/server";
import { ScanMode, dashboardStats } from "@/lib/core";
import { getStoreUser, runStoreScan } from "@/lib/server/store";

type ScanRequest = {
  isbn?: unknown;
  mode?: unknown;
  userId?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ScanRequest;
  const user = await getStoreUser(typeof body.userId === "string" ? body.userId : null);

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  if (body.mode !== "ADD" && body.mode !== "REMOVE") {
    return NextResponse.json({ status: "INVALID_MODE" }, { status: 400 });
  }

  const { result, state } = await runStoreScan(typeof body.isbn === "string" ? body.isbn : "", body.mode as ScanMode, user);
  return NextResponse.json({ ...result, state, stats: dashboardStats(state) });
}
