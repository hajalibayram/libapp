import {
  createInitialState,
  demoUsers,
  exportInventoryCsv,
  findBookById,
  scanInventory,
  searchBooks,
  undoTransaction
} from "../core.ts";
import type { DemoState, DemoUser, ScanMode, ScanResult } from "../core.ts";
import { lookupBookMetadata } from "../metadata/service.ts";

type GlobalDemoStore = {
  state?: DemoState;
  queue?: Promise<unknown>;
};

const globalStore = globalThis as typeof globalThis & {
  __volunteerBookshopDemoStore?: GlobalDemoStore;
};

function store(): GlobalDemoStore {
  globalStore.__volunteerBookshopDemoStore ||= {};
  globalStore.__volunteerBookshopDemoStore.state ||= createInitialState();
  globalStore.__volunteerBookshopDemoStore.queue ||= Promise.resolve();
  return globalStore.__volunteerBookshopDemoStore;
}

export function getDemoState(): DemoState {
  return cloneState(store().state || createInitialState());
}

export function getDemoUser(userId: string | null | undefined): DemoUser | null {
  if (!userId) return null;
  return demoUsers.find((user) => user.id === userId && user.active) || null;
}

export async function resetDemoState(): Promise<DemoState> {
  return withMutation(async (state) => {
    const nextState = createInitialState();
    store().state = nextState;
    return cloneState(nextState);
  });
}

export async function runDemoScan(isbn: string, mode: ScanMode, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  return withMutation(async (state) => {
    const result = await scanInventory(state, isbn, mode, user, lookupBookMetadata);
    return { result, state: cloneState(state) };
  });
}

export async function runDemoManualChange(bookId: string, mode: ScanMode, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  return withMutation(async (state) => {
    const book = findBookById(state, bookId);
    if (!book) {
      return { result: { status: "NOT_IN_INVENTORY" } as ScanResult, state: cloneState(state) };
    }
    const result = await scanInventory(state, book.isbn13 || book.isbn10 || "", mode, user, lookupBookMetadata);
    return { result, state: cloneState(state) };
  });
}

export async function runDemoUndo(transactionId: string, user: DemoUser): Promise<{ result: ScanResult; state: DemoState }> {
  return withMutation(async (state) => {
    const result = undoTransaction(state, transactionId, user);
    return { result, state: cloneState(state) };
  });
}

export function getDemoBooks(query = "", stock = "all") {
  return searchBooks(getDemoState(), query, stock);
}

export function getDemoBook(bookId: string) {
  return findBookById(getDemoState(), bookId);
}

export function getDemoCsv(): string {
  return exportInventoryCsv(getDemoState());
}

async function withMutation<T>(callback: (state: DemoState) => Promise<T> | T): Promise<T> {
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

function cloneState(state: DemoState): DemoState {
  return JSON.parse(JSON.stringify(state)) as DemoState;
}
