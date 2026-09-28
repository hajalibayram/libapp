import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getStoreBook } from "@/lib/server/store";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, applyAuthCookies } = await getAuthenticatedUser(request);

  if (!user) {
    return applyAuthCookies(NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 }));
  }

  const { id } = await context.params;
  const book = await getStoreBook(decodeURIComponent(id));

  if (!book) {
    return applyAuthCookies(NextResponse.json({ status: "NOT_FOUND" }, { status: 404 }));
  }

  return applyAuthCookies(NextResponse.json({ book }));
}
