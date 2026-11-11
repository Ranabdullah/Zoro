import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { major, reportTotals } from "../dist/report-data.js";

export async function excelReport(rows, label) {
  const book = new ExcelJS.Workbook();
  book.creator = "Zoro";
  const summary = book.addWorksheet("Summary");
  summary.addRow(["ZORO | Financial report", label]);
  summary.getRow(1).height = 42;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 96;
    const context = canvas.getContext("2d");
    context.strokeStyle = "#214e43"; context.lineWidth = 6;
    for (const x of [22, 48, 74]) {
      context.beginPath(); context.moveTo(x - 8, 8); context.lineTo(x + 8, 64);
      context.moveTo(x - 5, 64); context.lineTo(x + 18, 58);
      context.moveTo(x + 8, 64); context.lineTo(x + 13, 83); context.stroke();
    }
    const image = book.addImage({base64: canvas.toDataURL("image/png"), extension: "png"});
    summary.addImage(image, {tl:{col:5,row:0},ext:{width:42,height:42}});
  }
  summary.addRow(["Currency", "Money in", "Expenses", "Expenses with receipts"]);
  for (const total of reportTotals(rows))
    summary.addRow([total.currency, ...["income", "expenses", "receiptedExpenses"].map(key => major(total[key], total.currency))]);
  const detail = book.addWorksheet("Transactions");
  detail.addRow(["Date", "Shop / source", "Account", "Currency", "Amount", "Type", "Category", "Receipt count", "Note", "Entry reference"]);
  for (const row of rows)
    detail.addRow([row.date, row.shop, row.account, row.currency, major(row.amount, row.currency), row.kind, row.category, row.receiptCount, row.note, row.reference]);
  for (const sheet of [summary, detail]) {
    sheet.views = [{state: "frozen", ySplit: sheet === summary ? 2 : 1}];
    sheet.columns.forEach((column, index) => { column.width = index === 1 || index === 8 ? 35 : 22; });
    const header = sheet.getRow(sheet === summary ? 2 : 1);
    header.font = {bold: true, color: {argb: "FFFFFFFF"}};
    header.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FF214E43"}};
  }
  detail.autoFilter = {from: "A1", to: "J" + Math.max(1, detail.rowCount)};
  summary.addRow([]);
  summary.addRow(["Receipt photos are excluded. Amounts use the original account currency."]);
  return book.xlsx.writeBuffer();
}

export async function pdfReport(rows, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page, y;
  const safe = value => String(value).normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
  function line(text, size = 10, strong = false) {
    if (y < 40) newPage();
    page.drawText(safe(text), {x: 35, y, size, font: strong ? bold : font, color: rgb(.13, .25, .21)});
    y -= size + 9;
  }
  function newPage() {
    page = doc.addPage([842, 595]); y = 555;
    for (const x of [740, 757, 774]) {
      page.drawLine({start:{x:x-5,y:568},end:{x:x+5,y:536},thickness:3,color:rgb(.13,.31,.26)});
      page.drawLine({start:{x:x-2,y:536},end:{x:x+13,y:540},thickness:3,color:rgb(.13,.31,.26)});
      page.drawLine({start:{x:x+5,y:536},end:{x:x+8,y:524},thickness:3,color:rgb(.13,.31,.26)});
    }
    line("ZORO | Financial report", 18, true);
    line(label, 10);
  }
  function wrapped(text, width = 135) {
    const value = safe(text);
    for (let index = 0; index < value.length; index += width) line(value.slice(index, index + width), 9);
  }
  newPage();
  for (const total of reportTotals(rows))
    line(total.currency + " | Income " + major(total.income, total.currency).toFixed(2) + " | Expenses " + major(total.expenses, total.currency).toFixed(2) + " | With receipts " + major(total.receiptedExpenses, total.currency).toFixed(2), 11, true);
  line("Original currencies. Receipt photos excluded. Non-Latin characters are transliterated or shown as ?.", 9);
  for (const row of rows) {
    if (y < 115) newPage();
    wrapped(row.date + " | " + row.shop + " | " + row.account);
    line(row.kind + " | " + row.currency + " " + major(row.amount, row.currency).toFixed(2) + " | Receipts " + row.receiptCount, 10, true);
    if (row.note) wrapped(row.note);
    wrapped("Reference: " + row.reference);
    y -= 5;
  }
  return doc.save();
}
