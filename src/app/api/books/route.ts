import { NextRequest, NextResponse } from "next/server";
import { getDemoBooks } from "@/lib/server/demoStore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const stock = searchParams.get("stock") || "all";

  return NextResponse.json({ books: getDemoBooks(query, stock) });
}
