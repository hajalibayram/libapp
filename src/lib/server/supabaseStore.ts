import {
  canonicalIsbn,
  demoUsers,
  exportInventoryCsv,
  findBookById,
  findBookByIsbn,
  searchBooks,
  seededMetadata
} from "../core.ts";
import type {
  Book,
  BookMetadata,
  DemoState,
  DemoUser,
  InventoryTransaction,
  Role,
  ScanMode,
  ScanResult
} from "../core.ts";
import { lookupBookMetadata } from "../metadata/service.ts";
import { createSupabaseAdminClient } from "./supabaseAdmin.ts";

type RpcResult = {
  status: string;
  bookId?: string;
  transactionId?: string;
  before?: number;
  after?: number;
};

type BookRow = {
  id: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string | null;
  publisher: string | null;
  publication_date: string | null;
  language: string | null;
  description: string | null;
  cover_url: string | null;
  metadata_source: string | null;
  created_at: string;
  updated_at: string;
  inventory?: { quantity: number; updated_at: string } | Array<{ quantity: number; updated_at: string }> | null;
  book_authors?: Array<{ authors?: { name: string } | Array<{ name: string }> | null }>;
};

type TransactionRow = {
  id: string;
  book_id: string;
  user_id: string;
  action: "ADD" | "REMOVE" | "CORRECTION" | "UNDO";
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reverses_transaction_id: string | null;
  created_at: string;
  profiles?: { name: string } | Array<{ name: string }> | null;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export async function getSupabaseState(): Promise<DemoState> {
  const [users, books, transactions] = await Promise.all([getSupabaseUsers(), getSupabaseBooks(), getSupabaseTransactions()]);

  return {
    books,
    transactions,
    users,
    createdAt: new Date().toISOString()
  };
}

export async function getSupabaseUser(userId: string | null | undefined): Promise<DemoUser | null> {
  if (!userId) return null;

  const supabase = createSupabaseAdminClient();
  const demoUser = demoUsers.find((user) => user.id === userId);

  let query = supabase.from("profiles").select("id,name,email,role,active").eq("active", true).limit(1);

  if (isUuid(userId)) {
    query = query.eq("id", userId);
  } else if (demoUser) {
    query = query.eq("email", demoUser.email);
  } else {
    query = query.eq("email", userId);
  }

  const { data, error } = await query.maybeSingle<ProfileRow>();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function resetSupabaseState(): Promise<DemoState> {
  if (process.env.ALLOW_SUPABASE_RESET !== "true") {
    return getSupabaseState();
  }

  const supabase = createSupabaseAdminClient();
  const deletes: Array<{ table: string; column: string }> = [
    { table: "inventory_transactions", column: "id" },
    { table: "inventory", column: "book_id" },
    { table: "book_authors", column: "book_id" },
    { table: "authors", column: "id" },
    { table: "books", column: "id" }
  ];

  for (const item of deletes) {
    const { error } = await supabase.from(item.table).delete().neq(item.column, "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }

  return getSupabaseState();
}

export async function runSupabaseScan(isbnInput: string, mode: ScanMode, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  const isbn = canonicalIsbn(isbnInput);
  if (!isbn) {
    const state = await getSupabaseState();
    return { result: { status: "INVALID_ISBN" }, state };
  }

  const stateBefore = await getSupabaseState();
  const existing = findBookByIsbn(stateBefore, isbn);

  if (mode === "REMOVE") {
    if (!existing) return { result: { status: "NOT_IN_INVENTORY", isbn: isbn.scanned }, state: stateBefore };
    return runSupabaseRemove(existing.id, user);
  }

  const metadata = existing ? metadataFromBook(existing) : seededMetadata[isbn.isbn13] || (await lookupMetadataSafely(isbn.scanned, isbn));
  if (!metadata?.title) {
    const state = await getSupabaseState();
    return { result: { status: "NOT_FOUND", isbn: isbn.scanned }, state };
  }

  return runSupabaseAdd(metadata, user);
}

export async function runSupabaseManualChange(bookId: string, mode: ScanMode, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  const state = await getSupabaseState();
  const book = findBookById(state, bookId);

  if (!book) {
    return { result: { status: "NOT_IN_INVENTORY" }, state };
  }

  return mode === "ADD" ? runSupabaseAdd(metadataFromBook(book), user) : runSupabaseRemove(book.id, user);
}

export async function runSupabaseUndo(transactionId: string, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("inventory_undo", {
    p_user_id: user.id,
    p_transaction_id: transactionId
  });

  if (error) throw error;

  return resultFromRpc(data as RpcResult, "UNDO");
}

export async function getSupabaseFilteredBooks(query = "", stock = "all") {
  return searchBooks(await getSupabaseState(), query, stock);
}

export async function getSupabaseBook(bookId: string) {
  return findBookById(await getSupabaseState(), bookId);
}

export async function getSupabaseCsv(): Promise<string> {
  return exportInventoryCsv(await getSupabaseState());
}

async function runSupabaseAdd(metadata: BookMetadata, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("inventory_add", {
    p_user_id: user.id,
    p_isbn13: metadata.isbn13 || null,
    p_isbn10: metadata.isbn10 || null,
    p_title: metadata.title,
    p_subtitle: metadata.subtitle || null,
    p_authors: metadata.authors?.length ? metadata.authors : ["Unknown author"],
    p_publisher: metadata.publisher || null,
    p_publication_date: metadata.publicationDate || null,
    p_language: metadata.language || null,
    p_description: metadata.description || null,
    p_cover_url: metadata.coverUrl || null,
    p_metadata_source: metadata.source || "unknown"
  });

  if (error) throw error;
  return resultFromRpc(data as RpcResult, "ADD");
}

async function runSupabaseRemove(bookId: string, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("inventory_remove", {
    p_user_id: user.id,
    p_book_id: bookId
  });

  if (error) throw error;
  return resultFromRpc(data as RpcResult, "REMOVE");
}

async function resultFromRpc(rpc: RpcResult, action: "ADD" | "REMOVE" | "UNDO"): Promise<{ result: ScanResult; state: DemoState }> {
  const state = await getSupabaseState();

  if (rpc.status !== "SUCCESS") {
    const book = rpc.bookId ? findBookById(state, rpc.bookId) : null;
    return {
      result: {
        status: rpc.status as Exclude<ScanResult["status"], "SUCCESS">,
        book: book ? publicBook(book) : undefined,
        inventory: typeof rpc.before === "number" && typeof rpc.after === "number" ? { before: rpc.before, after: rpc.after } : undefined
      },
      state
    };
  }

  const book = rpc.bookId ? findBookById(state, rpc.bookId) : null;
  const transaction = rpc.transactionId ? state.transactions.find((item) => item.id === rpc.transactionId) : null;

  if (!book || !transaction || !rpc.transactionId || typeof rpc.before !== "number" || typeof rpc.after !== "number") {
    return { result: { status: "LOOKUP_FAILED" }, state };
  }

  return {
    result: {
      status: "SUCCESS",
      action,
      book: publicBook(book),
      inventory: { before: rpc.before, after: rpc.after },
      transactionId: rpc.transactionId,
      transaction
    },
    state
  };
}

async function getSupabaseUsers(): Promise<DemoUser[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("profiles").select("id,name,email,role,active").order("name", { ascending: true });
  if (error) throw error;
  return ((data || []) as ProfileRow[]).map(mapProfile);
}

async function getSupabaseBooks(): Promise<Book[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("books")
    .select(
      "id,isbn13,isbn10,title,subtitle,publisher,publication_date,language,description,cover_url,metadata_source,created_at,updated_at,inventory(quantity,updated_at),book_authors(authors(name))"
    )
    .order("title", { ascending: true });

  if (error) throw error;
  return ((data || []) as unknown as BookRow[]).map(mapBook);
}

async function getSupabaseTransactions(): Promise<InventoryTransaction[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("id,book_id,user_id,action,quantity_delta,quantity_before,quantity_after,reverses_transaction_id,created_at,profiles(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as unknown as TransactionRow[]).map(mapTransaction);
}

async function lookupMetadataSafely(scanned: string, isbn: NonNullable<ReturnType<typeof canonicalIsbn>>): Promise<BookMetadata | null> {
  try {
    return await lookupBookMetadata(scanned, isbn);
  } catch {
    return null;
  }
}

function metadataFromBook(book: Book): BookMetadata {
  return {
    isbn13: book.isbn13 || "",
    isbn10: book.isbn10,
    title: book.title,
    subtitle: book.subtitle,
    authors: book.authors,
    publisher: book.publisher,
    publicationDate: book.publicationDate,
    language: book.language,
    description: book.description,
    coverUrl: book.coverUrl,
    source: book.metadataSource || "local"
  };
}

function mapBook(row: BookRow): Book {
  const inventory = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
  const authors = (row.book_authors || [])
    .map((item) => firstNested(item.authors)?.name)
    .filter((name): name is string => Boolean(name));

  return {
    id: row.id,
    isbn13: row.isbn13,
    isbn10: row.isbn10,
    title: row.title,
    subtitle: row.subtitle,
    authors: authors.length ? authors : ["Unknown author"],
    publisher: row.publisher,
    publicationDate: row.publication_date,
    language: row.language,
    description: row.description,
    coverUrl: row.cover_url,
    metadataSource: row.metadata_source || "unknown",
    quantity: inventory?.quantity || 0,
    createdAt: row.created_at,
    updatedAt: inventory?.updated_at || row.updated_at
  };
}

function mapTransaction(row: TransactionRow): InventoryTransaction {
  return {
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    userName: firstNested(row.profiles)?.name || "Unknown user",
    action: row.action,
    quantityDelta: row.quantity_delta,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    reversesTransactionId: row.reverses_transaction_id,
    createdAt: row.created_at
  };
}

function mapProfile(row: ProfileRow): DemoUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active
  };
}

function firstNested<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function publicBook(book: Book): ScanResult extends { book: infer T } ? T : never {
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
  } as ScanResult extends { book: infer T } ? T : never;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
