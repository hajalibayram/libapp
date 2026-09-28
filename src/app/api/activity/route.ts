import { NextResponse } from "next/server";
import { getStoreState } from "@/lib/server/store";

export async function GET() {
  const state = await getStoreState();
  return NextResponse.json({ transactions: state.transactions });
}
