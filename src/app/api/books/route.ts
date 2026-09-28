import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getStoreBooks } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const stock = searchParams.get("stock") || "all";

  return applyAuthCookies(NextResponse.json({ books: await getStoreBooks(query, stock) }));
}
