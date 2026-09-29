import assert from "node:assert/strict";
import { findBookByIsbn } from "../src/lib/core.ts";
import { getMemoryCsv, getMemoryState, getMemoryUser, resetMemoryState, runMemoryScan, runMemoryUndo } from "../src/lib/server/memoryStore.ts";

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

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
