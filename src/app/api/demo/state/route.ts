import { NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getDemoState } from "@/lib/server/demoStore";

export async function GET() {
  const state = getDemoState();
  return NextResponse.json({ state, stats: dashboardStats(state) });
}
