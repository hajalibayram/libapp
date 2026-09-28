import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);
  return applyAuthCookies(NextResponse.json({ user }));
}
