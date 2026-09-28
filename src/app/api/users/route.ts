import { NextRequest, NextResponse } from "next/server";
import { getDemoState, getDemoUser } from "@/lib/server/demoStore";

export async function GET(request: NextRequest) {
  const user = getDemoUser(new URL(request.url).searchParams.get("userId"));

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({ users: getDemoState().users });
}
