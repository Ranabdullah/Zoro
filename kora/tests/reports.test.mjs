import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import {
  excelReport,
  pdfReport,
  backupExcel,
  readBackup,
  importTransactions,
} from "../src/reports.js";
import { validateBackup, removeData } from "../dist/data-management.js";
const state = {
  accounts: [
    {
      id: "a",
      name: "Euro",
      provider: "Test",
      currency: "EUR",
      opening: 10000,
      kind: "Card",
      last4: "1234",
    },
  ],
  entries: [
    {
      id: "e",
      account: "a",
      amount: 1234,
      kind: "expense",
      date: "2026-11-11",
      shop: "=SUM(A1)",
      category: "Food",
      note: "Receipt",
    },
  ],
  receipts: [],
  debts: [],
};
const rows = [
  {
    ...state.entries[0],
    reference: "e",
    account: "Euro",
    currency: "EUR",
    receiptCount: 1,
  },
];
test("styled reports preserve numeric data and text; transaction reports import idempotently", async () => {
  const buffer = await excelReport(rows, "November 2026");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Transactions");
  assert.equal(sheet.getCell("A4").value, "Date");
  assert.equal(sheet.getCell("E5").value, 12.34);
  assert.equal(sheet.getCell("B5").value, "=SUM(A1)");
  assert.equal(sheet.getCell("A1").fill.fgColor.argb, "FF214E43");
  assert.ok(book.getWorksheet("Spending"));
  const first = await importTransactions(buffer, {
    accounts: [],
    entries: [],
    receipts: [],
    debts: [],
  });
  assert.equal(first.added, 1);
  assert.equal(first.state.entries[0].amount, 1234);
  assert.equal((await importTransactions(buffer, first.state)).added, 0);
});
test("full Excel backups round trip and invalid or duplicate relationships are rejected", async () => {
  const restored = validateBackup(
    await readBackup(
      await backupExcel({
        ...state,
        name: "Personal",
        currency: "NGN",
        receipts: [
          {
            id: "r",
            entry: "e",
            shop: "Test",
            date: "2026-11-11",
            image: "data:image/jpeg;base64,/9j/",
          },
        ],
      }),
    ),
  );
  assert.equal(restored.name, "Personal");
  assert.equal(restored.currency, "NGN");
  assert.equal(restored.receipts[0].image, "data:image/jpeg;base64,/9j/");
  assert.equal(
    validateBackup(await readBackup(await backupExcel(state))).entries[0].shop,
    "=SUM(A1)",
  );
  assert.throws(() =>
    validateBackup({ ...state, entries: [...state.entries, ...state.entries] }),
  );
  assert.throws(() =>
    validateBackup({
      ...state,
      entries: [{ ...state.entries[0], account: "missing" }],
    }),
  );
  assert.throws(() =>
    validateBackup({
      ...state,
      receipts: [{ id: "r", image: "javascript:alert(1)" }],
    }),
  );
});
test("section deletion preserves valid links and PDF paginates a long report", async () => {
  const original = { ...state, receipts: [{ id: "r", entry: "e" }] };
  const removed = removeData(original, "accounts", "a");
  assert.equal(removed.entries.length, 0);
  assert.equal(removed.receipts[0].entry, null);
  assert.equal(original.entries.length, 1);
  const doc = await PDFDocument.load(
    await pdfReport(
      Array.from({ length: 80 }, (_, i) => ({
        ...rows[0],
        reference: "entry-" + i,
      })),
      "November",
    ),
  );
  assert.ok(doc.getPageCount() > 2);
});
