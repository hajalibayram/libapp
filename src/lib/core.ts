export type Role = "VOLUNTEER" | "ADMIN";
export type ScanMode = "ADD" | "REMOVE";
export type TransactionAction = "ADD" | "REMOVE" | "CORRECTION" | "UNDO";
export type ResultStatus =
  | "SUCCESS"
  | "INVALID_ISBN"
  | "NOT_FOUND"
  | "LOOKUP_FAILED"
  | "NOT_IN_INVENTORY"
  | "OUT_OF_STOCK"
  | "CANNOT_UNDO"
  | "ALREADY_UNDONE";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type BookMetadata = {
  isbn13: string;
  isbn10?: string | null;
  title: string;
  subtitle?: string | null;
  authors: string[];
  publisher?: string | null;
  publicationDate?: string | null;
  language?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  source: string;
};

export type Book = {
  id: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationDate: string | null;
  language: string | null;
  description: string | null;
  coverUrl: string | null;
  metadataSource: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransaction = {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  action: TransactionAction;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reversesTransactionId: string | null;
  createdAt: string;
};

export type AppState = {
  books: Book[];
  transactions: InventoryTransaction[];
  users: AppUser[];
  createdAt: string;
};

export type CanonicalIsbn = {
  scanned: string;
  isbn10: string | null;
  isbn13: string;
};

export type ScanResult =
  | {
      status: "SUCCESS";
      action: TransactionAction;
      book: PublicBook;
      inventory: { before: number; after: number };
      transactionId: string;
      transaction: InventoryTransaction;
    }
  | {
      status: Exclude<ResultStatus, "SUCCESS">;
      isbn?: string;
      book?: PublicBook;
      inventory?: { before: number; after: number };
    };

export type PublicBook = Omit<Book, "quantity" | "createdAt" | "updatedAt">;

export const seedUsers: AppUser[] = [
  { id: "user-volunteer", name: "Volunteer User", email: "volunteer@bookshop.test", role: "VOLUNTEER", active: true },
  { id: "user-admin", name: "Admin User", email: "admin@bookshop.test", role: "ADMIN", active: true }
];

export const seededMetadata: Record<string, BookMetadata> = {
  "9780141187761": {
    isbn13: "9780141187761",
    isbn10: null,
    title: "1984",
    subtitle: null,
    authors: ["George Orwell"],
    publisher: "Penguin Classics",
    publicationDate: "2000",
    language: "en",
    description: "A dystopian novel about surveillance, language, and political control.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141187761-M.jpg",
    source: "seed"
  },
  "9780241197790": {
    isbn13: "9780241197790",
    isbn10: null,
    title: "The Trial",
    subtitle: null,
    authors: ["Franz Kafka"],
    publisher: "Penguin Classics",
    publicationDate: "2015",
    language: "en",
    description: "A novel about a man arrested and prosecuted by an inaccessible authority.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780241197790-M.jpg",
    source: "seed"
  },
  "9780141198064": {
    isbn13: "9780141198064",
    isbn10: null,
    title: "The Stranger",
    subtitle: null,
    authors: ["Albert Camus"],
    publisher: "Penguin Classics",
    publicationDate: "2013",
    language: "en",
    description: "A short novel about alienation, guilt, and absurdity.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780141198064-M.jpg",
    source: "seed"
  },
  "9780140455465": {
    isbn13: "9780140455465",
    isbn10: null,
    title: "The Master and Margarita",
    subtitle: null,
    authors: ["Mikhail Bulgakov"],
    publisher: "Penguin Classics",
    publicationDate: "2007",
    language: "en",
    description: "A satirical novel moving between Soviet Moscow and biblical Jerusalem.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780140455465-M.jpg",
    source: "seed"
  }
};

export function createInitialState(): AppState {
  const now = new Date().toISOString();
  const books = [
    bookFromMetadata(seededMetadata["9780141187761"], 3, now),
    bookFromMetadata(seededMetadata["9780241197790"], 2, now),
    bookFromMetadata(seededMetadata["9780141198064"], 0, now)
  ];

  return {
    books,
    transactions: [],
    users: seedUsers,
    createdAt: now
  };
}

export function normalizeIsbn(input: string): string {
  return String(input || "").trim().replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn10(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, char, index) => {
    const value = char === "X" ? 10 : Number(char);
    return total + value * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = isbn
    .slice(0, 12)
    .split("")
    .reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

export function isValidIsbn(input: string): boolean {
  const isbn = normalizeIsbn(input);
  return isbn.length === 10 ? isValidIsbn10(isbn) : isValidIsbn13(isbn);
}

export function isbn10ToIsbn13(input: string): string | null {
  const isbn10 = normalizeIsbn(input);
  if (!isValidIsbn10(isbn10)) return null;
  const prefix = `978${isbn10.slice(0, 9)}`;
  const sum = prefix.split("").reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return `${prefix}${(10 - (sum % 10)) % 10}`;
}

export function canonicalIsbn(input: string): CanonicalIsbn | null {
  const isbn = normalizeIsbn(input);
  if (!isValidIsbn(isbn)) return null;
  if (isbn.length === 10) {
    const isbn13 = isbn10ToIsbn13(isbn);
    return isbn13 ? { scanned: isbn, isbn10: isbn, isbn13 } : null;
  }
  return { scanned: isbn, isbn10: null, isbn13: isbn };
}

export function isValidScanIsbnInput(input: string): boolean {
  return Boolean(canonicalIsbn(input));
}

export async function scanInventory(
  state: AppState,
  rawIsbn: string,
  mode: ScanMode,
  user: AppUser,
  lookupMetadata?: (scanned: string, isbn: CanonicalIsbn) => Promise<BookMetadata | null>
): Promise<ScanResult> {
  const isbn = isValidScanIsbnInput(rawIsbn) ? canonicalIsbn(rawIsbn) : null;

  if (!isbn || !["ADD", "REMOVE"].includes(mode)) {
    return { status: "INVALID_ISBN" };
  }

  const existing = findBookByIsbn(state, isbn);

  if (mode === "REMOVE") {
    if (!existing) return { status: "NOT_IN_INVENTORY", isbn: isbn.scanned };
    if (existing.quantity <= 0) {
      return {
        status: "OUT_OF_STOCK",
        book: publicBook(existing),
        inventory: { before: 0, after: 0 }
      };
    }
    return applyChange(state, existing, -1, "REMOVE", user);
  }

  if (existing) return applyChange(state, existing, 1, "ADD", user);

  let metadata: BookMetadata | undefined = seededMetadata[isbn.isbn13];
  if (!metadata && lookupMetadata) {
    try {
      metadata = (await lookupMetadata(isbn.scanned, isbn)) ?? undefined;
    } catch {
      return { status: "LOOKUP_FAILED", isbn: isbn.scanned };
    }
  }

  if (!metadata?.title) {
    return { status: "NOT_FOUND", isbn: isbn.scanned };
  }

  const now = new Date().toISOString();
  const book = bookFromMetadata(
    {
      ...metadata,
      isbn13: metadata.isbn13 || isbn.isbn13,
      isbn10: metadata.isbn10 || isbn.isbn10 || null
    },
    0,
    now
  );
  state.books.push(book);
  return applyChange(state, book, 1, "ADD", user);
}

export function undoTransaction(state: AppState, transactionId: string, user: AppUser): ScanResult {
  const original = state.transactions.find((transaction) => transaction.id === transactionId);
  if (!original || original.action === "UNDO") {
    return { status: "CANNOT_UNDO" };
  }
  if (state.transactions.some((transaction) => transaction.reversesTransactionId === transactionId)) {
    return { status: "ALREADY_UNDONE" };
  }

  const book = state.books.find((item) => item.id === original.bookId);
  if (!book) return { status: "CANNOT_UNDO" };

  const delta = -original.quantityDelta;
  if (book.quantity + delta < 0) return { status: "CANNOT_UNDO" };
  return applyChange(state, book, delta, "UNDO", user, original.id);
}

export function searchBooks(state: AppState, query = "", stock = "all"): Book[] {
  const needle = query.trim().toLowerCase();
  const canonicalQuery = canonicalIsbn(query);
  const isbnNeedles = Array.from(
    new Set([normalizeIsbn(query), canonicalQuery?.scanned, canonicalQuery?.isbn10, canonicalQuery?.isbn13].filter((value): value is string => Boolean(value)))
  ).map((value) => value.toLowerCase());
  return state.books
    .filter((book) => {
      if (stock === "in" && book.quantity <= 0) return false;
      if (stock === "out" && book.quantity !== 0) return false;
      if (!needle) return true;
      const textHaystack = [book.title, book.subtitle, book.isbn13, book.isbn10, book.publisher, ...book.authors]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const isbnHaystack = [book.isbn13, book.isbn10]
        .filter(Boolean)
        .map((value) => normalizeIsbn(value || ""))
        .join(" ")
        .toLowerCase();

      return textHaystack.includes(needle) || isbnNeedles.some((isbnNeedle) => isbnHaystack.includes(isbnNeedle));
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function dashboardStats(state: AppState): { totalTitles: number; totalBooks: number; outOfStock: number } {
  return {
    totalTitles: state.books.filter((book) => book.quantity > 0).length,
    totalBooks: state.books.reduce((total, book) => total + book.quantity, 0),
    outOfStock: state.books.filter((book) => book.quantity === 0).length
  };
}

export function exportInventoryCsv(state: AppState): string {
  const columns = ["ISBN-13", "ISBN-10", "Title", "Authors", "Publisher", "Publication Date", "Language", "Quantity"];
  const rows = state.books
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((book) => [
      book.isbn13 || "",
      book.isbn10 || "",
      book.title,
      book.authors.join("; "),
      book.publisher || "",
      book.publicationDate || "",
      book.language || "",
      String(book.quantity)
    ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function findBookById(state: AppState, id: string): Book | null {
  return state.books.find((book) => book.id === id) || null;
}

export function findBookByIsbn(state: AppState, isbnInfo: string | CanonicalIsbn): Book | null {
  const normalized = typeof isbnInfo === "string" ? canonicalIsbn(isbnInfo) : isbnInfo;
  if (!normalized) return null;
  return (
    state.books.find((book) => {
      return (
        (normalized.isbn13 && book.isbn13 === normalized.isbn13) ||
        (normalized.isbn10 && book.isbn10 === normalized.isbn10) ||
        book.isbn13 === normalized.scanned ||
        book.isbn10 === normalized.scanned
      );
    }) || null
  );
}

function applyChange(
  state: AppState,
  book: Book,
  delta: number,
  action: TransactionAction,
  user: AppUser,
  reversesTransactionId: string | null = null
): ScanResult {
  const before = book.quantity;
  const after = before + delta;
  if (after < 0) {
    return {
      status: "OUT_OF_STOCK",
      book: publicBook(book),
      inventory: { before, after: before }
    };
  }

  const now = new Date().toISOString();
  book.quantity = after;
  book.updatedAt = now;

  const transaction: InventoryTransaction = {
    id: newId(),
    bookId: book.id,
    userId: user.id,
    userName: user.name,
    action,
    quantityDelta: delta,
    quantityBefore: before,
    quantityAfter: after,
    reversesTransactionId,
    createdAt: now
  };
  state.transactions.unshift(transaction);

  return {
    status: "SUCCESS",
    action,
    book: publicBook(book),
    inventory: { before, after },
    transactionId: transaction.id,
    transaction
  };
}

function bookFromMetadata(metadata: BookMetadata, quantity: number, now: string): Book {
  const isbn = canonicalIsbn(metadata.isbn13 || metadata.isbn10 || "");
  return {
    id: `book-${metadata.isbn13 || isbn?.isbn13 || newId()}`,
    isbn13: metadata.isbn13 || isbn?.isbn13 || null,
    isbn10: metadata.isbn10 || isbn?.isbn10 || null,
    title: metadata.title,
    subtitle: metadata.subtitle || null,
    authors: Array.isArray(metadata.authors) && metadata.authors.length ? metadata.authors : ["Unknown author"],
    publisher: metadata.publisher || null,
    publicationDate: metadata.publicationDate || null,
    language: metadata.language || null,
    description: metadata.description || null,
    coverUrl: metadata.coverUrl || null,
    metadataSource: metadata.source || "unknown",
    quantity,
    createdAt: now,
    updatedAt: now
  };
}

function publicBook(book: Book): PublicBook {
  return {
    id: book.id,
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    publisher: book.publisher,
    publicationDate: book.publicationDate,
    language: book.language,
    description: book.description,
    coverUrl: book.coverUrl,
    metadataSource: book.metadataSource
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
