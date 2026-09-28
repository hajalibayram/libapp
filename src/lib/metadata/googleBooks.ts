import type { BookMetadata, CanonicalIsbn } from "../core.ts";

type GoogleBooksVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    language?: string;
    description?: string;
    imageLinks?: { thumbnail?: string };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

export async function lookupGoogleBooks(scanned: string, isbn: CanonicalIsbn): Promise<BookMetadata | null> {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(scanned)}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) throw new Error(`Google Books lookup failed with ${response.status}`);

  const data = (await response.json()) as GoogleBooksResponse;
  const volume = data.items?.[0]?.volumeInfo;
  if (!volume?.title) return null;

  const identifiers = volume.industryIdentifiers || [];

  return {
    isbn13: identifiers.find((item) => item.type === "ISBN_13")?.identifier || isbn.isbn13,
    isbn10: identifiers.find((item) => item.type === "ISBN_10")?.identifier || isbn.isbn10,
    title: volume.title,
    subtitle: volume.subtitle || null,
    authors: volume.authors?.length ? volume.authors : ["Unknown author"],
    publisher: volume.publisher || null,
    publicationDate: volume.publishedDate || null,
    language: volume.language || null,
    description: volume.description || null,
    coverUrl: volume.imageLinks?.thumbnail?.replace(/^http:/, "https:") || null,
    source: "google-books"
  };
}
