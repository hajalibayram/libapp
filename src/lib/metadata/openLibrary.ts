import type { BookMetadata, CanonicalIsbn } from "../core.ts";

type OpenLibraryAuthor = {
  key?: string;
};

type OpenLibraryBook = {
  title?: string;
  subtitle?: string;
  authors?: OpenLibraryAuthor[];
  publishers?: string[];
  publish_date?: string;
  languages?: Array<{ key?: string }>;
  description?: string | { value?: string };
  covers?: number[];
};

export async function lookupOpenLibrary(scanned: string, isbn: CanonicalIsbn): Promise<BookMetadata | null> {
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(scanned)}.json`, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Library lookup failed with ${response.status}`);

  const data = (await response.json()) as OpenLibraryBook;
  if (!data.title) return null;

  const authors = await lookupAuthors(data.authors || []);

  return {
    isbn13: isbn.isbn13,
    isbn10: isbn.isbn10,
    title: data.title,
    subtitle: data.subtitle || null,
    authors: authors.length ? authors : ["Unknown author"],
    publisher: data.publishers?.[0] || null,
    publicationDate: data.publish_date || null,
    language: data.languages?.[0]?.key?.split("/").pop() || null,
    description: typeof data.description === "string" ? data.description : data.description?.value || null,
    coverUrl: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn.isbn13}-M.jpg`,
    source: "open-library"
  };
}

async function lookupAuthors(authors: OpenLibraryAuthor[]): Promise<string[]> {
  const names = await Promise.all(
    authors.slice(0, 4).map(async (author) => {
      if (!author.key) return null;
      try {
        const response = await fetch(`https://openlibrary.org${author.key}.json`, {
          headers: { accept: "application/json" },
          next: { revalidate: 60 * 60 * 24 * 30 }
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { name?: string };
        return data.name || null;
      } catch {
        return null;
      }
    })
  );

  return names.filter((name): name is string => Boolean(name));
}
