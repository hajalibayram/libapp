import assert from "node:assert/strict";
import { findBookByIsbn } from "../src/lib/core.ts";
import { getMemoryCsv, getMemoryState, getMemoryUser, resetMemoryState, runMemoryScan, runMemoryUndo } from "../src/lib/server/memoryStore.ts";
import { usingSupabaseStore } from "../src/lib/server/store.ts";

const volunteer = getMemoryUser("user-volunteer");
assert.ok(volunteer);

await test("server store scan mutates shared application state", async () => {
  await resetMemoryState();

  const { result, state } = await runMemoryScan("9780141187761", "ADD", volunteer);
  const book = findBookByIsbn(state, "9780141187761");

  assert.equal(result.status, "SUCCESS");
  assert.equal(book?.quantity, 4);
  assert.equal(state.transactions.length, 1);
});

await test("server store undo creates reverse transaction", async () => {
  await resetMemoryState();

  const scan = await runMemoryScan("9780141187761", "ADD", volunteer);
  assert.equal(scan.result.status, "SUCCESS");

  const undo = await runMemoryUndo(scan.result.transactionId, volunteer);
  const book = findBookByIsbn(undo.state, "9780141187761");

  assert.equal(undo.result.status, "SUCCESS");
  assert.equal(book?.quantity, 3);
  assert.equal(undo.state.transactions.length, 2);
});

await test("server store serializes concurrent scans", async () => {
  await resetMemoryState();

  await Promise.all(Array.from({ length: 5 }, () => runMemoryScan("9780141187761", "ADD", volunteer)));

  const state = getMemoryState();
  const book = findBookByIsbn(state, "9780141187761");

  assert.equal(book?.quantity, 8);
  assert.equal(state.transactions.length, 5);
});

await test("server CSV export preserves MVP columns", async () => {
  await resetMemoryState();

  const csv = getMemoryCsv();

  assert.match(csv, /ISBN-13,ISBN-10,Title,Authors,Publisher,Publication Date,Language,Quantity/);
  assert.doesNotMatch(csv.toLowerCase(), /price|shelf|location/);
});

await test("production storage selection cannot fall back to memory", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousStorage = process.env.BOOKSHOP_STORAGE;
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    env["BOOKSHOP_STORAGE"] = "memory";
    env["NODE_ENV"] = "production";

    assert.throws(() => usingSupabaseStore(), /not allowed in production/);
  } finally {
    restoreEnv("BOOKSHOP_STORAGE", previousStorage);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
