import { NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { resetDemoState } from "@/lib/server/demoStore";

export async function POST() {
  const state = await resetDemoState();
  return NextResponse.json({ state, stats: dashboardStats(state) });
}
