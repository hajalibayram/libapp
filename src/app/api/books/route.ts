import { NextRequest, NextResponse } from "next/server";
import { getStoreBooks } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const stock = searchParams.get("stock") || "all";

  return NextResponse.json({ books: await getStoreBooks(query, stock) });
}
