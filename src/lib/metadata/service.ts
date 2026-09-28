import type { BookMetadata, CanonicalIsbn } from "../core.ts";
import { lookupGoogleBooks } from "./googleBooks.ts";
import { lookupOpenLibrary } from "./openLibrary.ts";

export async function lookupBookMetadata(scanned: string, isbn: CanonicalIsbn): Promise<BookMetadata | null> {
  const openLibrary = await lookupOpenLibrary(scanned, isbn);
  if (openLibrary) return openLibrary;
  return lookupGoogleBooks(scanned, isbn);
}
