import { NextRequest, NextResponse } from "next/server";
import { getDemoCsv, getDemoUser } from "@/lib/server/demoStore";

export async function GET(request: NextRequest) {
  const user = getDemoUser(new URL(request.url).searchParams.get("userId"));

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403 });
  }

  return new NextResponse(getDemoCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="bookshop-inventory-demo.csv"'
    }
  });
}
