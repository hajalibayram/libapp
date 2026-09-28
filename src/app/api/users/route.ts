import { NextRequest, NextResponse } from "next/server";
import { getStoreState, getStoreUser } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const user = await getStoreUser(new URL(request.url).searchParams.get("userId"));

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({ users: (await getStoreState()).users });
}
