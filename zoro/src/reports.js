import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { major, reportTotals } from "../dist/report-data.js";
import { minor, emptyState } from "../dist/ledger.js";

const forest = "FF214E43";
const money = (n, c) =>
  major(n, c).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
function categories(rows) {
  const groups = new Map();
  for (const r of rows.filter((r) => r.kind === "expense")) {
    const key = r.currency + " · " + (r.category || "Other");
    groups.set(key, (groups.get(key) || 0) + major(r.amount, r.currency));
  }
  return [...groups].sort((a, b) => b[1] - a[1]);
}
function logoCanvas() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d8edbc";
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = "#214e43";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const x of [24, 45, 66]) {
    ctx.beginPath();
    ctx.moveTo(x - 5, 15);
    ctx.lineTo(x + 7, 65);
    ctx.moveTo(x - 4, 68);
    ctx.lineTo(x + 16, 62);
    ctx.moveTo(x + 7, 65);
    ctx.lineTo(x + 10, 82);
    ctx.stroke();
  }
  return canvas;
}
function header(book, sheet, label, count) {
  sheet.mergeCells("A1:A2");
  sheet.mergeCells(1, 2, 1, count);
  sheet.mergeCells(2, 2, 2, count);
  sheet.getCell("B1").value = "ZORO  |  FINANCIAL REPORT";
  sheet.getCell("B2").value = label;
  for (const n of [1, 2]) {
    const row = sheet.getRow(n);
    row.height = n === 1 ? 34 : 25;
    row.font = {
      name: "Calibri",
      size: n === 1 ? 18 : 10,
      bold: n === 1,
      color: { argb: "FFFFFFFF" },
    };
    for (let c = 1; c <= count; c++)
      row.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: forest },
      };
  }
  const canvas = logoCanvas();
  if (canvas) {
    const id = book.addImage({ base64: canvas.toDataURL(), extension: "png" });
    sheet.addImage(id, {
      tl: { col: 0.1, row: 0.15 },
      ext: { width: 48, height: 48 },
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:4",
  };
  sheet.headerFooter.oddFooter =
    "Zoro | Private financial report     Page &P of &N";
}
function table(sheet, headers, rows, widths) {
  sheet.columns = widths.map((width) => ({ width }));
  const h = sheet.getRow(4);
  h.values = headers;
  h.height = 26;
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.eachCell(
    (c) =>
      (c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: forest },
      }),
  );
  rows.forEach((values, i) => {
    const row = sheet.getRow(i + 5);
    row.values = values;
    row.height = 30;
    row.eachCell((c) => {
      c.font = { name: "Calibri", size: 11, color: { argb: "FF223D35" } };
      c.alignment = { vertical: "middle", wrapText: true };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: i % 2 ? "FFF0F5F1" : "FFFFFFFF" },
      };
      c.border = { bottom: { style: "hair", color: { argb: "FFDDE7DF" } } };
    });
  });
}
export async function excelReport(rows, label) {
  const book = new ExcelJS.Workbook();
  book.creator = "Zoro";
  book.created = new Date();
  const summary = book.addWorksheet("Summary");
  header(book, summary, label, 5);
  table(
    summary,
    ["Currency", "Money in", "Expenses", "With receipts", "Net movement"],
    reportTotals(rows).map((t) => [
      t.currency,
      major(t.income, t.currency),
      major(t.expenses, t.currency),
      major(t.receiptedExpenses, t.currency),
      major(t.income - t.expenses, t.currency),
    ]),
    [18, 24, 24, 24, 24],
  );
  for (let i = 5; i <= summary.rowCount; i++)
    for (let c = 2; c <= 5; c++)
      summary.getCell(i, c).numFmt = "#,##0.00;[Red](#,##0.00)";
  const detail = book.addWorksheet("Transactions");
  header(book, detail, label, 10);
  table(
    detail,
    [
      "Date",
      "Shop / source",
      "Account",
      "Currency",
      "Amount",
      "Type",
      "Category",
      "Receipts",
      "Note",
      "Entry reference",
    ],
    rows.map((r) => [
      r.date,
      r.shop,
      r.account,
      r.currency,
      major(r.amount, r.currency),
      r.kind,
      r.category,
      r.receiptCount,
      r.note,
      r.reference,
    ]),
    [15, 28, 24, 12, 18, 14, 22, 12, 42, 40],
  );
  for (let i = 5; i <= detail.rowCount; i++)
    detail.getCell("E" + i).numFmt = "#,##0.00;[Red](#,##0.00)";
  detail.autoFilter = { from: "A4", to: "J" + Math.max(4, detail.rowCount) };
  const spending = book.addWorksheet("Spending");
  header(book, spending, label, 4);
  const groups = categories(rows);
  table(
    spending,
    [
      "Currency / category",
      "Expenses",
      "Share within currency",
      "Spending graph",
    ],
    groups.map(([name, value]) => {
      const total = groups
        .filter((g) => g[0].slice(0, 3) === name.slice(0, 3))
        .reduce((n, g) => n + g[1], 0);
      const share = total ? value / total : 0;
      return [
        name,
        value,
        share,
        "█".repeat(Math.max(1, Math.round(share * 28))),
      ];
    }),
    [35, 22, 25, 40],
  );
  for (let i = 5; i <= spending.rowCount; i++) {
    spending.getCell("B" + i).numFmt = "#,##0.00";
    spending.getCell("C" + i).numFmt = "0.0%";
  }
  if (typeof document !== "undefined" && groups.length) {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 80 + groups.length * 48;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#214e43";
    ctx.font = "bold 23px sans-serif";
    ctx.fillText("Spending share by category · grouped by currency", 25, 35);
    groups.forEach(([name, value], i) => {
      const total = groups
        .filter((g) => g[0].slice(0, 3) === name.slice(0, 3))
        .reduce((n, g) => n + g[1], 0);
      const y = 65 + i * 48;
      ctx.fillStyle = "#223d35";
      ctx.font = "16px sans-serif";
      ctx.fillText(name.slice(0, 30), 25, y + 20);
      ctx.fillStyle = "#315e4e";
      ctx.fillRect(305, y, Math.max(2, (value / total) * 520), 27);
      ctx.fillStyle = "#223d35";
      ctx.fillText(((value / total) * 100).toFixed(1) + "%", 840, y + 20);
    });
    const id = book.addImage({ base64: canvas.toDataURL(), extension: "png" });
    spending.addImage(id, {
      tl: { col: 0, row: groups.length + 7 },
      ext: { width: 800, height: canvas.height * 0.8 },
    });
  }
  return book.xlsx.writeBuffer();
}
export async function pdfReport(rows, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.25, 0.21),
    green = rgb(0.13, 0.31, 0.26);
  const safe = (v) =>
    String(v ?? "")
      .replaceAll("·", "|")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "?");
  function text(p, v, x, y, size = 9, strong = false) {
    p.drawText(safe(v), { x, y, size, font: strong ? bold : font, color: ink });
  }
  function newPage(title) {
    const p = doc.addPage([842, 595]);
    p.drawRectangle({ x: 0, y: 505, width: 842, height: 90, color: green });
    p.drawRectangle({
      x: 30,
      y: 528,
      width: 48,
      height: 48,
      color: rgb(0.85, 0.93, 0.74),
    });
    for (const x of [41, 54, 67]) {
      p.drawLine({
        start: { x: x - 3, y: 568 },
        end: { x: x + 5, y: 539 },
        thickness: 2,
        color: green,
      });
      p.drawLine({
        start: { x: x - 1, y: 537 },
        end: { x: x + 11, y: 541 },
        thickness: 2,
        color: green,
      });
      p.drawLine({
        start: { x: x + 5, y: 539 },
        end: { x: x + 7, y: 530 },
        thickness: 2,
        color: green,
      });
    }
    p.drawText("ZORO", {
      x: 96,
      y: 555,
      size: 24,
      font: bold,
      color: rgb(1, 1, 1),
    });
    p.drawText(title, { x: 96, y: 536, size: 12, font, color: rgb(1, 1, 1) });
    p.drawText(safe(label).slice(0, 145), {
      x: 30,
      y: 515,
      size: 8,
      font,
      color: rgb(1, 1, 1),
    });
    return p;
  }
  let page = newPage("Financial summary"),
    y = 474;
  for (const t of reportTotals(rows)) {
    text(
      page,
      t.currency +
        "   Income " +
        money(t.income, t.currency) +
        "   Expenses " +
        money(t.expenses, t.currency) +
        "   With receipts " +
        money(t.receiptedExpenses, t.currency),
      30,
      y,
      11,
      true,
    );
    y -= 27;
    if (y < 100) {
      page = newPage("Financial summary continued");
      y = 474;
    }
  }
  text(
    page,
    "Spending share by category · percentages within each currency",
    30,
    y - 8,
    11,
    true,
  );
  y -= 35;
  const groups = categories(rows);
  for (const [name, value] of groups) {
    const total = groups
      .filter((g) => g[0].slice(0, 3) === name.slice(0, 3))
      .reduce((n, g) => n + g[1], 0);
    if (y < 65) {
      page = newPage("Spending by category");
      y = 474;
    }
    text(page, name.slice(0, 40), 30, y, 10);
    page.drawRectangle({
      x: 275,
      y: y - 5,
      width: Math.max(2, (value / total) * 380),
      height: 15,
      color: green,
    });
    text(
      page,
      ((value / total) * 100).toFixed(1) + "%  " + value.toFixed(2),
      680,
      y,
      10,
      true,
    );
    y -= 29;
  }
  const xs = [30, 96, 230, 345, 400, 490, 610, 680, 812];
  const headers = [
    "Date",
    "Shop / source",
    "Account",
    "CCY",
    "Amount",
    "Category",
    "Type",
    "Receipts",
  ];
  function transactionPage() {
    const p = newPage("Transactions");
    p.drawRectangle({ x: 30, y: 457, width: 782, height: 27, color: green });
    headers.forEach((h, i) =>
      p.drawText(h, {
        x: xs[i] + 4,
        y: 467,
        size: 9,
        font: bold,
        color: rgb(1, 1, 1),
      }),
    );
    return p;
  }
  function wrap(value, width) {
    const result = [];
    let current = "";
    for (const character of safe(value)) {
      if (font.widthOfTextAtSize(current + character, 8) > width && current) {
        result.push(current);
        current = "";
      }
      current += character;
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  }
  page = transactionPage();
  y = 457;
  for (const [index, r] of rows.entries()) {
    const values = [
      r.date,
      r.shop,
      r.account,
      r.currency,
      money(r.amount, r.currency),
      r.category,
      r.kind,
      String(r.receiptCount),
    ];
    const lines = values.map((v, i) => wrap(v, xs[i + 1] - xs[i] - 9));
    const meta = wrap(
      (r.note ? "Note: " + r.note + " | " : "") + "Reference: " + r.reference,
      770,
    );
    const height =
      Math.max(...lines.map((v) => v.length)) * 12 + meta.length * 12 + 16;
    if (height > 350)
      throw Error(
        "An entry is too long for PDF. Shorten its note or export Excel.",
      );
    if (y - height < 40) {
      page = transactionPage();
      y = 457;
    }
    page.drawRectangle({
      x: 30,
      y: y - height,
      width: 782,
      height,
      color: index % 2 ? rgb(0.94, 0.96, 0.94) : rgb(1, 1, 1),
    });
    lines.forEach((ls, i) =>
      ls.forEach((line, n) => text(page, line, xs[i] + 4, y - 14 - n * 12, 8)),
    );
    const offset = Math.max(...lines.map((v) => v.length)) * 12;
    meta.forEach((line, n) =>
      text(page, line, 34, y - offset - 14 - n * 12, 8),
    );
    y -= height;
  }
  doc
    .getPages()
    .forEach((p, i) =>
      text(
        p,
        "Zoro | Private financial report | Page " +
          (i + 1) +
          " of " +
          doc.getPageCount(),
        30,
        18,
        8,
      ),
    );
  return doc.save();
}
export async function backupExcel(state) {
  const book = new ExcelJS.Workbook();
  book.creator = "Zoro";
  const cover = book.addWorksheet("Backup");
  header(book, cover, "Wallet backup | " + new Date().toISOString(), 4);
  table(
    cover,
    ["Section", "Records"],
    ["accounts", "entries", "receipts", "debts"].map((key) => [
      key,
      state[key].length,
    ]),
    [28, 22, 22, 22],
  );
  cover.getCell("A11").value =
    "Contains private data and receipt images. Store securely.";
  const sheet = book.addWorksheet("Zoro restore data");
  sheet.addRow(["Zoro backup", 1]);
  const payload = JSON.stringify({ version: 1, state });
  for (let i = 0; i < payload.length; i += 28000)
    sheet.addRow([payload.slice(i, i + 28000)]);
  return book.xlsx.writeBuffer();
}
export async function readBackup(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Zoro restore data");
  if (!sheet || sheet.getCell("A1").value !== "Zoro backup")
    throw Error(
      "Choose a full Excel backup from Settings → Data management. Financial reports contain transactions only.",
    );
  if (sheet.rowCount > 4000) throw Error("Backup is too large.");
  let json = "";
  for (let i = 2; i <= sheet.rowCount; i++) {
    const value = sheet.getCell(i, 1).value;
    if (typeof value !== "string") throw Error("Invalid backup data.");
    json += value;
  }
  const payload = JSON.parse(json);
  if (payload.version !== 1) throw Error("Unsupported backup version.");
  return payload.state;
}
export async function importTransactions(buffer, state) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Transactions");
  if (
    !sheet ||
    sheet.getCell("A4").value !== "Date" ||
    sheet.getCell("J4").value !== "Entry reference"
  )
    throw Error("Choose a Zoro financial report with a Transactions sheet.");
  if (sheet.rowCount > 20004)
    throw Error("This report has too many transactions.");
  const next = structuredClone(state || emptyState());
  const existing = new Set(next.entries.map((e) => e.id));
  let added = 0;
  for (let row = 5; row <= sheet.rowCount; row++) {
    const values = Array.from(
      { length: 10 },
      (_, i) => sheet.getCell(row, i + 1).value,
    );
    if (values.every((v) => v === null)) continue;
    if (values.some((v) => v && typeof v === "object"))
      throw Error("Formula and rich-text cells cannot be imported.");
    const [date, shop, name, currency, amount, kind, category, , note, id] =
      values;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      !["expense", "income"].includes(kind)
    )
      throw Error("Invalid transaction row " + row);
    if (existing.has(id)) continue;
    let account = next.accounts.find(
      (a) => a.name === name && a.currency === currency,
    );
    if (!account) {
      account = {
        id: crypto.randomUUID(),
        name,
        provider: "Imported account",
        currency,
        kind: "Account",
        opening: 0,
        last4: "",
        colour: "#214e43",
        pattern: "orbit",
      };
      next.accounts.push(account);
    }
    next.entries.push({
      id,
      date,
      shop,
      account: account.id,
      amount: minor(amount, currency),
      kind,
      category: category || "Other",
      note: note || "",
    });
    existing.add(id);
    added++;
  }
  return { state: next, added };
}
