import { NextRequest, NextResponse } from "next/server";
import { getStoreBook } from "@/lib/server/store";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const book = await getStoreBook(decodeURIComponent(id));

  if (!book) {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ book });
}
