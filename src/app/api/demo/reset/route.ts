import { NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { resetStoreState } from "@/lib/server/store";

export async function POST() {
  const state = await resetStoreState();
  return NextResponse.json({ state, stats: dashboardStats(state) });
}
