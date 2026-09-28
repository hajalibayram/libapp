import {
  getDemoBook,
  getDemoBooks,
  getDemoCsv,
  getDemoState,
  getDemoUser,
  resetDemoState,
  runDemoManualChange,
  runDemoScan,
  runDemoUndo
} from "./demoStore.ts";
import {
  getSupabaseBook,
  getSupabaseCsv,
  getSupabaseFilteredBooks,
  getSupabaseState,
  getSupabaseUser,
  resetSupabaseState,
  runSupabaseManualChange,
  runSupabaseScan,
  runSupabaseUndo
} from "./supabaseStore.ts";
import type { DemoUser, ScanMode } from "../core.ts";

export function usingSupabaseStore(): boolean {
  return process.env.BOOKSHOP_STORAGE === "supabase";
}

export async function getStoreState() {
  return usingSupabaseStore() ? getSupabaseState() : getDemoState();
}

export async function getStoreUser(userId: string | null | undefined): Promise<DemoUser | null> {
  return usingSupabaseStore() ? getSupabaseUser(userId) : getDemoUser(userId);
}

export async function resetStoreState() {
  return usingSupabaseStore() ? resetSupabaseState() : resetDemoState();
}

export async function runStoreScan(isbn: string, mode: ScanMode, user: DemoUser) {
  return usingSupabaseStore() ? runSupabaseScan(isbn, mode, user) : runDemoScan(isbn, mode, user);
}

export async function runStoreManualChange(bookId: string, mode: ScanMode, user: DemoUser) {
  return usingSupabaseStore() ? runSupabaseManualChange(bookId, mode, user) : runDemoManualChange(bookId, mode, user);
}

export async function runStoreUndo(transactionId: string, user: DemoUser) {
  return usingSupabaseStore() ? runSupabaseUndo(transactionId, user) : runDemoUndo(transactionId, user);
}

export async function getStoreBooks(query = "", stock = "all") {
  return usingSupabaseStore() ? getSupabaseFilteredBooks(query, stock) : getDemoBooks(query, stock);
}

export async function getStoreBook(bookId: string) {
  return usingSupabaseStore() ? getSupabaseBook(bookId) : getDemoBook(bookId);
}

export async function getStoreCsv() {
  return usingSupabaseStore() ? getSupabaseCsv() : getDemoCsv();
}
