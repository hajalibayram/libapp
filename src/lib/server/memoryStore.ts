import {
  createInitialState,
  seedUsers,
  exportInventoryCsv,
  findBookById,
  scanInventory,
  searchBooks,
  undoTransaction
} from "../core.ts";
import type { AppState, AppUser, ScanMode, ScanResult } from "../core.ts";
import { lookupBookMetadata } from "../metadata/service.ts";

type GlobalMemoryStore = {
  state?: AppState;
  queue?: Promise<unknown>;
};

const globalStore = globalThis as typeof globalThis & {
  __volunteerBookshopAppStore?: GlobalMemoryStore;
};

function store(): GlobalMemoryStore {
  globalStore.__volunteerBookshopAppStore ||= {};
  globalStore.__volunteerBookshopAppStore.state ||= createInitialState();
  globalStore.__volunteerBookshopAppStore.queue ||= Promise.resolve();
  return globalStore.__volunteerBookshopAppStore;
}

export function getMemoryState(): AppState {
  return cloneState(store().state || createInitialState());
}

export function getMemoryUser(userId: string | null | undefined): AppUser | null {
  if (!userId) return null;
  return seedUsers.find((user) => user.id === userId && user.active) || null;
}

export async function resetMemoryState(): Promise<AppState> {
  return withMutation(async (state) => {
    const nextState = createInitialState();
    store().state = nextState;
    return cloneState(nextState);
  });
}

export async function runMemoryScan(isbn: string, mode: ScanMode, user: AppUser): Promise<{ result: ScanResult; state: AppState }> {
  return withMutation(async (state) => {
    const result = await scanInventory(state, isbn, mode, user, lookupBookMetadata);
    return { result, state: cloneState(state) };
  });
}

export async function runMemoryManualChange(bookId: string, mode: ScanMode, user: AppUser): Promise<{ result: ScanResult; state: AppState }> {
  return withMutation(async (state) => {
    const book = findBookById(state, bookId);
    if (!book) {
      return { result: { status: "NOT_IN_INVENTORY" } as ScanResult, state: cloneState(state) };
    }
    const result = await scanInventory(state, book.isbn13 || book.isbn10 || "", mode, user, lookupBookMetadata);
    return { result, state: cloneState(state) };
  });
}

export async function runMemoryUndo(transactionId: string, user: AppUser): Promise<{ result: ScanResult; state: AppState }> {
  return withMutation(async (state) => {
    const result = undoTransaction(state, transactionId, user);
    return { result, state: cloneState(state) };
  });
}

export function getMemoryBooks(query = "", stock = "all") {
  return searchBooks(getMemoryState(), query, stock);
}

export function getMemoryBook(bookId: string) {
  return findBookById(getMemoryState(), bookId);
}

export function getMemoryCsv(): string {
  return exportInventoryCsv(getMemoryState());
}

async function withMutation<T>(callback: (state: AppState) => Promise<T> | T): Promise<T> {
  const current = store();
  const previous = current.queue || Promise.resolve();

  let release!: () => void;
  current.queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    current.state ||= createInitialState();
    return await callback(current.state);
  } finally {
    release();
  }
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}
