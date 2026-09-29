import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getStoreCsv } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  if (user.role !== "ADMIN") {
    return applyAuthCookies(NextResponse.json({ status: "FORBIDDEN" }, { status: 403 }));
  }

  return applyAuthCookies(new NextResponse(await getStoreCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="bookshop-inventory.csv"'
    }
  }));
}
