import { NextRequest, NextResponse } from "next/server";
import { getDemoBook } from "@/lib/server/demoStore";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const book = getDemoBook(decodeURIComponent(id));

  if (!book) {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ book });
}
