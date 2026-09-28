import assert from "node:assert/strict";
import { findBookByIsbn } from "../src/lib/core.ts";
import { getDemoCsv, getDemoState, getDemoUser, resetDemoState, runDemoScan, runDemoUndo } from "../src/lib/server/demoStore.ts";

const volunteer = getDemoUser("user-volunteer");
assert.ok(volunteer);

await test("server store scan mutates shared demo state", async () => {
  await resetDemoState();

  const { result, state } = await runDemoScan("9780141187761", "ADD", volunteer);
  const book = findBookByIsbn(state, "9780141187761");

  assert.equal(result.status, "SUCCESS");
  assert.equal(book?.quantity, 4);
  assert.equal(state.transactions.length, 1);
});

await test("server store undo creates reverse transaction", async () => {
  await resetDemoState();

  const scan = await runDemoScan("9780141187761", "ADD", volunteer);
  assert.equal(scan.result.status, "SUCCESS");

  const undo = await runDemoUndo(scan.result.transactionId, volunteer);
  const book = findBookByIsbn(undo.state, "9780141187761");

  assert.equal(undo.result.status, "SUCCESS");
  assert.equal(book?.quantity, 3);
  assert.equal(undo.state.transactions.length, 2);
});

await test("server store serializes concurrent scans", async () => {
  await resetDemoState();

  await Promise.all(Array.from({ length: 5 }, () => runDemoScan("9780141187761", "ADD", volunteer)));

  const state = getDemoState();
  const book = findBookByIsbn(state, "9780141187761");

  assert.equal(book?.quantity, 8);
  assert.equal(state.transactions.length, 5);
});

await test("server CSV export preserves MVP columns", async () => {
  await resetDemoState();

  const csv = getDemoCsv();

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
