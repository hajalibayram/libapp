import { NextRequest, NextResponse } from "next/server";
import { ScanMode, dashboardStats } from "@/lib/core";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { runStoreScan } from "@/lib/server/store";

type ScanRequest = {
  isbn?: unknown;
  mode?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ScanRequest;
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  if (body.mode !== "ADD" && body.mode !== "REMOVE") {
    return applyAuthCookies(NextResponse.json({ status: "INVALID_MODE" }, { status: 400 }));
  }

  const { result, state } = await runStoreScan(typeof body.isbn === "string" ? body.isbn : "", body.mode as ScanMode, user);
  return applyAuthCookies(NextResponse.json({ ...result, state, stats: dashboardStats(state) }));
}
