import assert from "node:assert/strict";
import {
  canonicalIsbn,
  createInitialState,
  seedUsers,
  exportInventoryCsv,
  findBookByIsbn,
  isValidIsbn10,
  isValidIsbn13,
  normalizeIsbn,
  scanInventory,
  searchBooks,
  undoTransaction
} from "../src/lib/core.ts";

const user = seedUsers[0];

await test("normalizes spaces and hyphens", () => {
  assert.equal(normalizeIsbn(" 978-0-14-118776-1 "), "9780141187761");
});

await test("validates ISBN-10 and ISBN-13 checksums", () => {
  assert.equal(isValidIsbn10("0-306-40615-2"), true);
  assert.equal(isValidIsbn10("030640615X"), false);
  assert.equal(isValidIsbn13("9780306406157"), true);
  assert.equal(isValidIsbn13("9780306406158"), false);
});

await test("rejects unsupported retail barcode", () => {
  assert.equal(canonicalIsbn("1234567890123"), null);
});

await test("existing ISBN add increments exactly once and creates transaction", async () => {
  const state = createInitialState();
  const book = findBookByIsbn(state, "9780141187761");
  assert.ok(book);
  const before = book.quantity;

  const result = await scanInventory(state, "9780141187761", "ADD", user);

  assert.equal(result.status, "SUCCESS");
  assert.equal(book.quantity, before + 1);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].action, "ADD");
});

await test("new known ISBN creates book with quantity 1", async () => {
  const state = createInitialState();

  const result = await scanInventory(state, "9780140455465", "ADD", user);
  const book = findBookByIsbn(state, "9780140455465");

  assert.equal(result.status, "SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected success");
  assert.equal(result.inventory.before, 0);
  assert.equal(result.inventory.after, 1);
  assert.equal(book?.title, "The Master and Margarita");
});

await test("metadata missing creates no book or transaction", async () => {
  const state = createInitialState();

  const result = await scanInventory(state, "9780306406157", "ADD", user, async () => null);

  assert.equal(result.status, "NOT_FOUND");
  assert.equal(findBookByIsbn(state, "9780306406157"), null);
  assert.equal(state.transactions.length, 0);
});

await test("metadata error creates no book or transaction", async () => {
  const state = createInitialState();

  const result = await scanInventory(state, "9780306406157", "ADD", user, async () => {
    throw new Error("offline");
  });

  assert.equal(result.status, "LOOKUP_FAILED");
  assert.equal(findBookByIsbn(state, "9780306406157"), null);
  assert.equal(state.transactions.length, 0);
});

await test("remove decrements in-stock ISBN exactly once", async () => {
  const state = createInitialState();
  const book = findBookByIsbn(state, "9780241197790");
  assert.ok(book);
  const before = book.quantity;

  const result = await scanInventory(state, "9780241197790", "REMOVE", user);

  assert.equal(result.status, "SUCCESS");
  assert.equal(book.quantity, before - 1);
  assert.equal(state.transactions[0].action, "REMOVE");
});

await test("remove absent ISBN does not query provider or mutate", async () => {
  const state = createInitialState();
  let called = false;

  const result = await scanInventory(state, "9780306406157", "REMOVE", user, async () => {
    called = true;
    return null;
  });

  assert.equal(result.status, "NOT_IN_INVENTORY");
  assert.equal(called, false);
  assert.equal(state.transactions.length, 0);
});

await test("zero-stock ISBN cannot become negative", async () => {
  const state = createInitialState();
  const book = findBookByIsbn(state, "9780141198064");
  assert.ok(book);

  const result = await scanInventory(state, "9780141198064", "REMOVE", user);

  assert.equal(result.status, "OUT_OF_STOCK");
  assert.equal(book.quantity, 0);
  assert.equal(state.transactions.length, 0);
});

await test("undo creates reverse transaction and leaves original", async () => {
  const state = createInitialState();
  const add = await scanInventory(state, "9780141187761", "ADD", user);
  assert.equal(add.status, "SUCCESS");

  const undo = undoTransaction(state, add.transactionId, user);

  assert.equal(undo.status, "SUCCESS");
  if (undo.status !== "SUCCESS") throw new Error("Expected success");
  assert.equal(undo.action, "UNDO");
  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions[0].reversesTransactionId, add.transactionId);
});

await test("same transaction cannot be undone twice", async () => {
  const state = createInitialState();
  const add = await scanInventory(state, "9780141187761", "ADD", user);
  assert.equal(add.status, "SUCCESS");

  undoTransaction(state, add.transactionId, user);
  const secondUndo = undoTransaction(state, add.transactionId, user);

  assert.equal(secondUndo.status, "ALREADY_UNDONE");
});

await test("search matches title author and ISBN", () => {
  const state = createInitialState();

  assert.equal(searchBooks(state, "1984").length, 1);
  assert.equal(searchBooks(state, "Kafka").length, 1);
  assert.equal(searchBooks(state, "9780141198064").length, 1);
});

await test("CSV export omits price and location fields", () => {
  const csv = exportInventoryCsv(createInitialState());

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
