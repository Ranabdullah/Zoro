import test from "node:test";
import assert from "node:assert/strict";
import { backendConfig } from "../dist/backend-config.js";
import { reportRows, reportTotals } from "../dist/report-data.js";
test("user backend settings accept only Supabase HTTPS and publishable keys", () => {
  const url = "https://abcdefghijklmnopqrst.supabase.co";
  assert.equal(
    backendConfig(url + "/", "sb_publishable_abcdefghijklmno").url,
    url,
  );
  for (const bad of [
    "sb_secret_abcdefghijklmno",
    "eyJservice.role",
    "database-password",
  ])
    assert.throws(() => backendConfig(url, bad));
  for (const bad of ["http://localhost", url + ".evil.example", url + "/path"])
    assert.throws(() => backendConfig(bad, "sb_publishable_abcdefghijklmno"));
});
test("receipt report filters count each transaction once and exclude income and unattached photos", () => {
  const state = {
    accounts: [{ id: "a", name: "Euro", currency: "EUR" }],
    entries: [
      {
        id: "e",
        date: "2026-11-12",
        kind: "expense",
        account: "a",
        amount: 1234,
      },
      {
        id: "i",
        date: "2026-11-12",
        kind: "income",
        account: "a",
        amount: 5000,
      },
      {
        id: "n",
        date: "2026-11-12",
        kind: "expense",
        account: "a",
        amount: 200,
      },
    ],
    receipts: [{ entry: "e" }, { entry: "e" }, { entry: "i" }, { entry: null }],
  };
  const rows = reportRows(state, { scope: "receipts" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receiptCount, 2);
  assert.equal(reportTotals(rows)[0].receiptedExpenses, 1234);
});
