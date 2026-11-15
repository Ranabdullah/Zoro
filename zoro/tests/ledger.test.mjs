import test from "node:test";
import assert from "node:assert/strict";
import {
  minor,
  balance,
  addEntry,
  emptyState,
  format,
  toEuro,
} from "../dist/ledger.js";
const state = () => ({
  ...emptyState(),
  accounts: [
    { id: "eur", currency: "EUR", opening: 10000 },
    { id: "ngn", currency: "NGN", opening: 500000 },
  ],
});
test("shop expense reduces only the selected account; removing it reverses balance", () => {
  const s = addEntry(state(), {
    id: "x",
    account: "eur",
    amount: 1234,
    kind: "expense",
  });
  assert.equal(balance(s, "eur"), 8766);
  assert.equal(balance(s, "ngn"), 500000);
  assert.equal(balance({ ...s, entries: [] }, "eur"), 10000);
});
test("income adds to the balance without mutating state", () => {
  const before = state(),
    after = addEntry(before, { account: "ngn", amount: 20000, kind: "income" });
  assert.equal(balance(after, "ngn"), 520000);
  assert.equal(before.entries.length, 0);
});
test("money uses integer minor units and rejects fractional minor units", () => {
  assert.equal(minor("48.65", "EUR"), 4865);
  assert.equal(minor("100", "XOF"), 100);
  assert.throws(() => minor("1.234", "EUR"));
  assert.throws(() => minor("1.5", "XOF"));
  assert.throws(() => minor("-10"));
  assert.throws(() => minor("NaN"));
  assert.equal(format(4865, "EUR"), "€48.65");
});
test("entries cannot use unknown accounts, zero amounts or arbitrary types", () => {
  assert.throws(() =>
    addEntry(state(), { account: "missing", amount: 100, kind: "expense" }),
  );
  assert.throws(() =>
    addEntry(state(), { account: "eur", amount: 0, kind: "expense" }),
  );
  assert.throws(() =>
    addEntry(state(), { account: "eur", amount: 100, kind: "other" }),
  );
});
test("euro estimates divide by foreign units per euro without mixing minor units", () => {
  assert.equal(toEuro(15000000, "NGN", { NGN: { rate: 1500 } }), 10000);
  assert.equal(toEuro(65596, "XOF", { XOF: { rate: 655.96 } }), 10000);
  assert.equal(toEuro(1234, "EUR", {}), 1234);
  assert.equal(toEuro(100, "KES", {}), null);
  assert.equal(toEuro(100, "KES", { KES: { rate: 0 } }), null);
});
