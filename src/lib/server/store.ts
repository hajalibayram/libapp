import {
  getMemoryBook,
  getMemoryBooks,
  getMemoryCsv,
  getMemoryState,
  getMemoryUser,
  runMemoryManualChange,
  runMemoryScan,
  runMemoryUndo
} from "./memoryStore.ts";
import {
  getSupabaseBook,
  getSupabaseCsv,
  getSupabaseFilteredBooks,
  getSupabaseState,
  getSupabaseUser,
  runSupabaseManualChange,
  runSupabaseScan,
  runSupabaseUndo
} from "./supabaseStore.ts";
import type { AppUser, ScanMode } from "../core.ts";

export function usingSupabaseStore(): boolean {
  return process.env.BOOKSHOP_STORAGE === "supabase";
}

export async function getStoreState() {
  return usingSupabaseStore() ? getSupabaseState() : getMemoryState();
}

export async function getStoreUser(userId: string | null | undefined): Promise<AppUser | null> {
  return usingSupabaseStore() ? getSupabaseUser(userId) : getMemoryUser(userId);
}

export async function runStoreScan(isbn: string, mode: ScanMode, user: AppUser) {
  return usingSupabaseStore() ? runSupabaseScan(isbn, mode, user) : runMemoryScan(isbn, mode, user);
}

export async function runStoreManualChange(bookId: string, mode: ScanMode, user: AppUser) {
  return usingSupabaseStore() ? runSupabaseManualChange(bookId, mode, user) : runMemoryManualChange(bookId, mode, user);
}

export async function runStoreUndo(transactionId: string, user: AppUser) {
  return usingSupabaseStore() ? runSupabaseUndo(transactionId, user) : runMemoryUndo(transactionId, user);
}

export async function getStoreBooks(query = "", stock = "all") {
  return usingSupabaseStore() ? getSupabaseFilteredBooks(query, stock) : getMemoryBooks(query, stock);
}

export async function getStoreBook(bookId: string) {
  return usingSupabaseStore() ? getSupabaseBook(bookId) : getMemoryBook(bookId);
}

export async function getStoreCsv() {
  return usingSupabaseStore() ? getSupabaseCsv() : getMemoryCsv();
}
