import { NextResponse } from "next/server";
import { getDemoState } from "@/lib/server/demoStore";

export async function GET() {
  const state = getDemoState();
  return NextResponse.json({ transactions: state.transactions });
}
