import { NextResponse } from "next/server";
import { dashboardStats } from "@/lib/core";
import { getStoreState } from "@/lib/server/store";

export async function GET() {
  const state = await getStoreState();
  return NextResponse.json({ state, stats: dashboardStats(state) });
}
