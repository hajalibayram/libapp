import { NextRequest, NextResponse } from "next/server";
import { getStoreCsv, getStoreUser } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const user = await getStoreUser(new URL(request.url).searchParams.get("userId"));

  if (!user) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403 });
  }

  return new NextResponse(await getStoreCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="bookshop-inventory-demo.csv"'
    }
  });
}
